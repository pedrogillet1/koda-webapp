/**
 * Fallback Response Service
 *
 * Provides dynamic, LLM-generated fallback responses when:
 * - File not found
 * - Folder not found
 * - Empty folder
 * - No documents matching query
 * - Low confidence results
 *
 * FORMATTING REQUIREMENTS (Added 2025-12-08):
 * - All responses MUST use **bold** for key terms
 * - All responses MUST use bullet points (•) for lists
 */

import geminiClient from './geminiClient.service';

export interface FallbackContext {
  query: string;
  userId: string;
  language: string;
  scenario: 'file_not_found' | 'folder_not_found' | 'empty_folder' | 'no_documents' | 'low_confidence';
  searchedTerm?: string;
  suggestedAlternatives?: string[];
  availableDocuments?: Array<{ filename: string; id: string }>;
  availableFolders?: Array<{ name: string; id: string }>;
  documentCount?: number;
}

export interface FallbackResponse {
  message: string;
  suggestions: string[];
  uiActions?: Array<{
    type: 'show_files' | 'show_folders' | 'search_tip' | 'upload_prompt';
    data?: any;
  }>;
}

const LANGUAGE_PROMPTS: Record<string, Record<string, string>> = {
  file_not_found: {
    en: `The user asked about a file that doesn't exist.
Query: "{query}", Searched: "{searchedTerm}", Alternatives: {alternatives}

Generate a helpful response. **FORMATTING REQUIREMENTS:**
- Use **bold** for the file name (e.g., **"{searchedTerm}"**)
- Use bullet points (•) for listing suggestions
- Keep it concise (2-3 sentences + bullet list)

Example: **I couldn't find "{searchedTerm}"** in your documents.
This might happen because:
• The file name is different
• It hasn't been uploaded yet`,

    pt: `O usuário perguntou sobre um arquivo que não existe.
Consulta: "{query}", Pesquisou: "{searchedTerm}", Alternativas: {alternatives}

Gere uma resposta útil. **REQUISITOS DE FORMATAÇÃO:**
- Use **negrito** para o nome do arquivo
- Use marcadores (•) para listar sugestões
- Seja conciso (2-3 frases + lista)

Exemplo: **Não encontrei "{searchedTerm}"** nos seus documentos.
Isso pode acontecer porque:
• O nome é diferente
• Ainda não foi carregado`,

    es: `El usuario preguntó sobre un archivo que no existe.
Consulta: "{query}", Buscó: "{searchedTerm}", Alternativas: {alternatives}

Genera una respuesta útil. **REQUISITOS DE FORMATO:**
- Usa **negrita** para el nombre del archivo
- Usa viñetas (•) para listar sugerencias
- Sé conciso (2-3 oraciones + lista)`
  },

  folder_not_found: {
    en: `User asked about a folder that doesn't exist.
Query: "{query}", Folder: "{searchedTerm}", Available: {alternatives}

**FORMATTING:** Use **bold** for folder name, bullet points (•) for alternatives.`,

    pt: `Usuário perguntou sobre uma pasta que não existe.
Consulta: "{query}", Pasta: "{searchedTerm}", Disponíveis: {alternatives}

**FORMATAÇÃO:** Use **negrito** para nome da pasta, marcadores (•) para alternativas.`,

    es: `Usuario preguntó sobre una carpeta que no existe.
Consulta: "{query}", Carpeta: "{searchedTerm}", Disponibles: {alternatives}

**FORMATO:** Usa **negrita** para nombre de carpeta, viñetas (•) para alternativas.`
  },

  empty_folder: {
    en: `User asked about an empty folder.
Query: "{query}", Folder: "{searchedTerm}"

**FORMATTING:** Use **bold** for folder name, bullet points (•) for suggestions.`,

    pt: `Usuário perguntou sobre uma pasta vazia.
Consulta: "{query}", Pasta: "{searchedTerm}"

**FORMATAÇÃO:** Use **negrito** para nome da pasta, marcadores (•) para sugestões.`,

    es: `Usuario preguntó sobre una carpeta vacía.
Consulta: "{query}", Carpeta: "{searchedTerm}"

**FORMATO:** Usa **negrita** para nombre de carpeta, viñetas (•) para sugerencias.`
  },

  no_documents: {
    en: `User has no documents uploaded yet.
Query: "{query}"

Generate welcoming response. **FORMATTING:** Use **bold** for actions, bullet points (•) for capabilities.`,

    pt: `Usuário ainda não tem documentos.
Consulta: "{query}"

Gere resposta acolhedora. **FORMATAÇÃO:** Use **negrito** para ações, marcadores (•) para capacidades.`,

    es: `Usuario no tiene documentos.
Consulta: "{query}"

Genera respuesta acogedora. **FORMATO:** Usa **negrita** para acciones, viñetas (•) para capacidades.`
  },

  low_confidence: {
    en: `Found documents with low confidence.
Query: "{query}", Matches: {alternatives}

**FORMATTING:** Use **bold** for document names, bullet points (•) for matches.`,

    pt: `Encontramos documentos com baixa confiança.
Consulta: "{query}", Correspondências: {alternatives}

**FORMATAÇÃO:** Use **negrito** para nomes, marcadores (•) para correspondências.`,

    es: `Encontramos documentos con baja confianza.
Consulta: "{query}", Coincidencias: {alternatives}

**FORMATO:** Usa **negrita** para nombres, viñetas (•) para coincidencias.`
  }
};

const STATIC_FALLBACKS: Record<string, Record<string, string>> = {
  file_not_found: {
    en: `**I couldn't find "{searchedTerm}"** in your documents.

This might happen because:
• The file name is slightly different
• It hasn't been uploaded yet
• It's in a different folder`,
    pt: `**Não encontrei "{searchedTerm}"** nos seus documentos.

Isso pode acontecer porque:
• O nome do arquivo é diferente
• Ainda não foi carregado
• Está em outra pasta`,
    es: `**No encontré "{searchedTerm}"** en tus documentos.

Esto puede pasar porque:
• El nombre del archivo es diferente
• Aún no ha sido subido
• Está en otra carpeta`
  },
  folder_not_found: {
    en: `**I couldn't find the folder "{searchedTerm}"**.

You can:
• Check the folder name spelling
• Create a new folder with this name`,
    pt: `**Não encontrei a pasta "{searchedTerm}"**.

Você pode:
• Verificar a ortografia do nome
• Criar uma nova pasta`,
    es: `**No encontré la carpeta "{searchedTerm}"**.

Puedes:
• Verificar la ortografía
• Crear una nueva carpeta`
  },
  empty_folder: {
    en: `The folder **"{searchedTerm}"** exists but is **empty**.

**What you can do:**
• Upload documents to this folder
• Check other folders`,
    pt: `A pasta **"{searchedTerm}"** existe mas está **vazia**.

**O que você pode fazer:**
• Fazer upload de documentos
• Verificar outras pastas`,
    es: `La carpeta **"{searchedTerm}"** existe pero está **vacía**.

**Lo que puedes hacer:**
• Subir documentos
• Revisar otras carpetas`
  },
  no_documents: {
    en: `**You haven't uploaded any documents yet!**

Once you upload files, I can help you:
• Search and find information
• Analyze documents
• Answer questions`,
    pt: `**Você ainda não tem documentos!**

Depois de fazer upload, posso:
• Buscar informações
• Analisar documentos
• Responder perguntas`,
    es: `**¡Aún no has subido documentos!**

Una vez que subas archivos, puedo:
• Buscar información
• Analizar documentos
• Responder preguntas`
  },
  low_confidence: {
    en: `I found some documents, but I'm **not sure** they match.

Would you like to:
• **Refine your search**
• See possible matches anyway`,
    pt: `Encontrei documentos, mas **não tenho certeza** se correspondem.

Gostaria de:
• **Refinar sua busca**
• Ver possíveis correspondências`,
    es: `Encontré documentos, pero **no estoy seguro** de que coincidan.

¿Te gustaría:
• **Refinar tu búsqueda**
• Ver posibles coincidencias`
  }
};

class FallbackResponseService {
  async generateFallback(context: FallbackContext): Promise<FallbackResponse> {
    const startTime = Date.now();
    console.log(`🔄 [FALLBACK] Generating ${context.scenario} response`);

    try {
      const lang = context.language || 'en';
      const promptTemplate = LANGUAGE_PROMPTS[context.scenario]?.[lang]
        || LANGUAGE_PROMPTS[context.scenario]?.['en']
        || 'Generate a helpful response';

      let alternatives = 'None available';
      if (context.suggestedAlternatives?.length) {
        alternatives = context.suggestedAlternatives.slice(0, 5).join(', ');
      } else if (context.availableDocuments?.length) {
        alternatives = context.availableDocuments.slice(0, 5).map(d => d.filename).join(', ');
      } else if (context.availableFolders?.length) {
        alternatives = context.availableFolders.slice(0, 5).map(f => f.name).join(', ');
      }

      const prompt = promptTemplate
        .replace(/{query}/g, context.query)
        .replace(/{searchedTerm}/g, context.searchedTerm || context.query)
        .replace(/{alternatives}/g, alternatives);

      const model = geminiClient.getModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      });

      const result = await model.generateContent(prompt);
      const message = result.response.text() || this.getStaticFallback(context);

      console.log(`✅ [FALLBACK] Generated in ${Date.now() - startTime}ms`);

      return {
        message,
        suggestions: this.buildSuggestions(context),
        uiActions: this.buildUIActions(context)
      };
    } catch (error: any) {
      console.error('❌ [FALLBACK] Generation failed:', error.message);
      return {
        message: this.getStaticFallback(context),
        suggestions: this.buildSuggestions(context),
        uiActions: this.buildUIActions(context)
      };
    }
  }

  async generateFileNotFoundResponse(
    query: string, searchedFilename: string, userId: string, language: string,
    similarFiles?: Array<{ filename: string; id: string }>
  ): Promise<string> {
    const response = await this.generateFallback({
      query, userId, language, scenario: 'file_not_found',
      searchedTerm: searchedFilename, availableDocuments: similarFiles,
      suggestedAlternatives: similarFiles?.map(f => f.filename)
    });
    return response.message;
  }

  async generateFolderNotFoundResponse(
    query: string, searchedFolderName: string, userId: string, language: string,
    availableFolders?: Array<{ name: string; id: string }>
  ): Promise<string> {
    const response = await this.generateFallback({
      query, userId, language, scenario: 'folder_not_found',
      searchedTerm: searchedFolderName, availableFolders,
      suggestedAlternatives: availableFolders?.map(f => f.name)
    });
    return response.message;
  }

  async generateEmptyFolderResponse(
    query: string, folderName: string, userId: string, language: string
  ): Promise<string> {
    const response = await this.generateFallback({
      query, userId, language, scenario: 'empty_folder', searchedTerm: folderName
    });
    return response.message;
  }

  private getStaticFallback(context: FallbackContext): string {
    const lang = context.language || 'en';
    let template = STATIC_FALLBACKS[context.scenario]?.[lang]
      || STATIC_FALLBACKS[context.scenario]?.['en']
      || "**I couldn't find what you're looking for.**";
    return template.replace(/{searchedTerm}/g, context.searchedTerm || 'the item');
  }

  private buildSuggestions(context: FallbackContext): string[] {
    const suggestions: string[] = [];
    const lang = context.language || 'en';

    if (context.scenario === 'file_not_found' && context.availableDocuments?.length) {
      for (const doc of context.availableDocuments.slice(0, 3)) {
        suggestions.push(lang === 'pt' ? `Buscar em "${doc.filename}"` :
          lang === 'es' ? `Buscar en "${doc.filename}"` : `Search in "${doc.filename}"`);
      }
    }
    if (context.scenario === 'folder_not_found' && context.availableFolders?.length) {
      for (const folder of context.availableFolders.slice(0, 3)) {
        suggestions.push(lang === 'pt' ? `Ver pasta "${folder.name}"` :
          lang === 'es' ? `Ver carpeta "${folder.name}"` : `View folder "${folder.name}"`);
      }
    }
    if (context.scenario === 'no_documents') {
      suggestions.push(lang === 'pt' ? 'Fazer upload de documentos' :
        lang === 'es' ? 'Subir documentos' : 'Upload documents');
    }
    return suggestions;
  }

  private buildUIActions(context: FallbackContext): FallbackResponse['uiActions'] {
    const actions: FallbackResponse['uiActions'] = [];
    if (context.scenario === 'file_not_found' && context.availableDocuments) {
      actions.push({ type: 'show_files', data: { files: context.availableDocuments.slice(0, 5) } });
    }
    if (context.scenario === 'folder_not_found' && context.availableFolders) {
      actions.push({ type: 'show_folders', data: { folders: context.availableFolders.slice(0, 5) } });
    }
    if (context.scenario === 'no_documents') {
      actions.push({ type: 'upload_prompt' });
    }
    return actions;
  }
}

export const fallbackResponseService = new FallbackResponseService();
export default fallbackResponseService;
