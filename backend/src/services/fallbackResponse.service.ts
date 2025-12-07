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
 * MANUS PRINCIPLES:
 * 1. Never blame the user
 * 2. Always explain WHY something happened
 * 3. Offer concrete alternatives/next steps
 * 4. Be helpful, not defensive
 */

import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Language-aware Prompt Templates
// ═══════════════════════════════════════════════════════════════════════════

const LANGUAGE_PROMPTS: Record<string, Record<string, string>> = {
  file_not_found: {
    en: `The user asked about a file that doesn't exist in their documents.
User's query: "{query}"
Searched for: "{searchedTerm}"

Generate a helpful, friendly response that:
1. Acknowledges we couldn't find the file (never blame the user)
2. Explains why this might happen (wrong name, not uploaded yet, in a different folder)
3. Offers alternatives: {alternatives}

Keep it concise (2-3 sentences). Be helpful, not apologetic.`,

    pt: `O usuário perguntou sobre um arquivo que não existe nos documentos dele.
Consulta do usuário: "{query}"
Pesquisou por: "{searchedTerm}"

Gere uma resposta útil e amigável que:
1. Reconhece que não encontramos o arquivo (nunca culpe o usuário)
2. Explica por que isso pode acontecer (nome errado, ainda não foi carregado, em outra pasta)
3. Oferece alternativas: {alternatives}

Seja conciso (2-3 frases). Seja prestativo, não apologético.`,

    es: `El usuario preguntó sobre un archivo que no existe en sus documentos.
Consulta del usuario: "{query}"
Buscó: "{searchedTerm}"

Genera una respuesta útil y amigable que:
1. Reconozca que no pudimos encontrar el archivo (nunca culpes al usuario)
2. Explique por qué podría pasar (nombre incorrecto, aún no subido, en otra carpeta)
3. Ofrezca alternativas: {alternatives}

Sé conciso (2-3 oraciones). Sé útil, no apologético.`
  },

  folder_not_found: {
    en: `The user asked about a folder that doesn't exist.
User's query: "{query}"
Searched for folder: "{searchedTerm}"

Generate a helpful response that:
1. Says the folder wasn't found
2. Lists available folders if any: {alternatives}
3. Suggests they might create it or check the name

Keep it concise (2-3 sentences).`,

    pt: `O usuário perguntou sobre uma pasta que não existe.
Consulta do usuário: "{query}"
Pesquisou pela pasta: "{searchedTerm}"

Gere uma resposta útil que:
1. Diz que a pasta não foi encontrada
2. Lista pastas disponíveis se houver: {alternatives}
3. Sugere que podem criar ou verificar o nome

Seja conciso (2-3 frases).`,

    es: `El usuario preguntó sobre una carpeta que no existe.
Consulta del usuario: "{query}"
Buscó carpeta: "{searchedTerm}"

Genera una respuesta útil que:
1. Diga que la carpeta no fue encontrada
2. Liste carpetas disponibles si hay: {alternatives}
3. Sugiera que pueden crearla o verificar el nombre

Sé conciso (2-3 oraciones).`
  },

  empty_folder: {
    en: `The user asked about content in a folder that exists but is empty.
User's query: "{query}"
Folder name: "{searchedTerm}"

Generate a helpful response that:
1. Confirms the folder exists but is empty
2. Suggests they can upload documents to it
3. Mentions they can ask about other folders if needed

Keep it concise (2-3 sentences).`,

    pt: `O usuário perguntou sobre conteúdo em uma pasta que existe mas está vazia.
Consulta do usuário: "{query}"
Nome da pasta: "{searchedTerm}"

Gere uma resposta útil que:
1. Confirma que a pasta existe mas está vazia
2. Sugere que podem fazer upload de documentos
3. Menciona que podem perguntar sobre outras pastas

Seja conciso (2-3 frases).`,

    es: `El usuario preguntó sobre contenido en una carpeta que existe pero está vacía.
Consulta del usuario: "{query}"
Nombre de carpeta: "{searchedTerm}"

Genera una respuesta útil que:
1. Confirme que la carpeta existe pero está vacía
2. Sugiera que pueden subir documentos
3. Mencione que pueden preguntar sobre otras carpetas

Sé conciso (2-3 oraciones).`
  },

  no_documents: {
    en: `The user doesn't have any documents uploaded yet.
User's query: "{query}"

Generate a welcoming response that:
1. Explains they haven't uploaded documents yet
2. Encourages them to upload files
3. Briefly mentions what kinds of questions they can ask once they do

Keep it friendly and encouraging (2-3 sentences).`,

    pt: `O usuário ainda não tem documentos carregados.
Consulta do usuário: "{query}"

Gere uma resposta acolhedora que:
1. Explica que ainda não carregaram documentos
2. Incentiva a fazer upload de arquivos
3. Menciona brevemente que tipos de perguntas podem fazer depois

Seja amigável e encorajador (2-3 frases).`,

    es: `El usuario aún no tiene documentos subidos.
Consulta del usuario: "{query}"

Genera una respuesta acogedora que:
1. Explique que aún no han subido documentos
2. Los anime a subir archivos
3. Mencione brevemente qué tipos de preguntas pueden hacer después

Sé amigable y alentador (2-3 oraciones).`
  },

  low_confidence: {
    en: `We found some documents but with low confidence they match the query.
User's query: "{query}"
Best matches found: {alternatives}
Confidence: Low

Generate a response that:
1. Shares what we found (tentatively)
2. Explains we're not confident these are what they're looking for
3. Asks if they want to refine their search

Keep it helpful (2-3 sentences).`,

    pt: `Encontramos alguns documentos mas com baixa confiança de que correspondem à consulta.
Consulta do usuário: "{query}"
Melhores correspondências: {alternatives}
Confiança: Baixa

Gere uma resposta que:
1. Compartilha o que encontramos (tentativamente)
2. Explica que não estamos confiantes de que é o que procuram
3. Pergunta se querem refinar a busca

Seja útil (2-3 frases).`,

    es: `Encontramos algunos documentos pero con baja confianza de que coinciden con la consulta.
Consulta del usuario: "{query}"
Mejores coincidencias: {alternatives}
Confianza: Baja

Genera una respuesta que:
1. Comparta lo que encontramos (tentativamente)
2. Explique que no estamos seguros de que sea lo que buscan
3. Pregunte si quieren refinar la búsqueda

Sé útil (2-3 oraciones).`
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Fallback Response Service
// ═══════════════════════════════════════════════════════════════════════════

class FallbackResponseService {
  /**
   * Generate a dynamic fallback response based on context
   */
  async generateFallback(context: FallbackContext): Promise<FallbackResponse> {
    const startTime = Date.now();
    console.log(`🔄 [FALLBACK] Generating ${context.scenario} response for: "${context.query}"`);

    try {
      // Get appropriate prompt template
      const lang = context.language || 'en';
      const promptTemplate = LANGUAGE_PROMPTS[context.scenario]?.[lang]
        || LANGUAGE_PROMPTS[context.scenario]?.['en']
        || 'Generate a helpful response for: {query}';

      // Build alternatives string
      let alternatives = 'None available';
      if (context.suggestedAlternatives && context.suggestedAlternatives.length > 0) {
        alternatives = context.suggestedAlternatives.slice(0, 5).join(', ');
      } else if (context.availableDocuments && context.availableDocuments.length > 0) {
        alternatives = context.availableDocuments.slice(0, 5).map(d => d.filename).join(', ');
      } else if (context.availableFolders && context.availableFolders.length > 0) {
        alternatives = context.availableFolders.slice(0, 5).map(f => f.name).join(', ');
      }

      // Fill in the template
      const prompt = promptTemplate
        .replace(/{query}/g, context.query)
        .replace(/{searchedTerm}/g, context.searchedTerm || context.query)
        .replace(/{alternatives}/g, alternatives);

      // Generate response with Gemini
      const model = geminiClient.getModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        }
      });

      const result = await model.generateContent(prompt);
      const message = result.response.text() || this.getStaticFallback(context);

      const latency = Date.now() - startTime;
      console.log(`✅ [FALLBACK] Generated response in ${latency}ms`);

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

  /**
   * Generate file not found response
   */
  async generateFileNotFoundResponse(
    query: string,
    searchedFilename: string,
    userId: string,
    language: string,
    similarFiles?: Array<{ filename: string; id: string }>
  ): Promise<string> {
    const response = await this.generateFallback({
      query,
      userId,
      language,
      scenario: 'file_not_found',
      searchedTerm: searchedFilename,
      availableDocuments: similarFiles,
      suggestedAlternatives: similarFiles?.map(f => f.filename)
    });
    return response.message;
  }

  /**
   * Generate folder not found response
   */
  async generateFolderNotFoundResponse(
    query: string,
    searchedFolderName: string,
    userId: string,
    language: string,
    availableFolders?: Array<{ name: string; id: string }>
  ): Promise<string> {
    const response = await this.generateFallback({
      query,
      userId,
      language,
      scenario: 'folder_not_found',
      searchedTerm: searchedFolderName,
      availableFolders,
      suggestedAlternatives: availableFolders?.map(f => f.name)
    });
    return response.message;
  }

  /**
   * Generate empty folder response
   */
  async generateEmptyFolderResponse(
    query: string,
    folderName: string,
    userId: string,
    language: string
  ): Promise<string> {
    const response = await this.generateFallback({
      query,
      userId,
      language,
      scenario: 'empty_folder',
      searchedTerm: folderName
    });
    return response.message;
  }

  /**
   * Get static fallback when LLM generation fails
   */
  private getStaticFallback(context: FallbackContext): string {
    const lang = context.language || 'en';

    const staticResponses: Record<string, Record<string, string>> = {
      file_not_found: {
        en: `I couldn't find "${context.searchedTerm}" in your documents. Make sure the file name is correct or try uploading it.`,
        pt: `Não encontrei "${context.searchedTerm}" nos seus documentos. Verifique se o nome está correto ou tente fazer upload.`,
        es: `No encontré "${context.searchedTerm}" en tus documentos. Verifica que el nombre esté correcto o intenta subirlo.`
      },
      folder_not_found: {
        en: `I couldn't find a folder called "${context.searchedTerm}". Check the folder name or create a new one.`,
        pt: `Não encontrei uma pasta chamada "${context.searchedTerm}". Verifique o nome ou crie uma nova.`,
        es: `No encontré una carpeta llamada "${context.searchedTerm}". Verifica el nombre o crea una nueva.`
      },
      empty_folder: {
        en: `The folder "${context.searchedTerm}" exists but is empty. Upload some documents to it!`,
        pt: `A pasta "${context.searchedTerm}" existe mas está vazia. Faça upload de alguns documentos!`,
        es: `La carpeta "${context.searchedTerm}" existe pero está vacía. ¡Sube algunos documentos!`
      },
      no_documents: {
        en: "You haven't uploaded any documents yet. Upload some files and I can help you search and analyze them!",
        pt: "Você ainda não tem documentos. Faça upload de alguns arquivos e posso ajudar a pesquisar e analisar!",
        es: "Aún no has subido documentos. ¡Sube algunos archivos y puedo ayudarte a buscar y analizarlos!"
      },
      low_confidence: {
        en: "I found some documents but I'm not sure they match what you're looking for. Could you be more specific?",
        pt: "Encontrei alguns documentos mas não tenho certeza de que correspondem ao que você procura. Pode ser mais específico?",
        es: "Encontré algunos documentos pero no estoy seguro de que coincidan con lo que buscas. ¿Podrías ser más específico?"
      }
    };

    return staticResponses[context.scenario]?.[lang]
      || staticResponses[context.scenario]?.['en']
      || "I couldn't find what you're looking for. Please try a different search.";
  }

  /**
   * Build suggestions based on context
   */
  private buildSuggestions(context: FallbackContext): string[] {
    const suggestions: string[] = [];
    const lang = context.language || 'en';

    if (context.scenario === 'file_not_found') {
      if (context.availableDocuments && context.availableDocuments.length > 0) {
        for (const doc of context.availableDocuments.slice(0, 3)) {
          suggestions.push(lang === 'pt' ? `Buscar em "${doc.filename}"` :
            lang === 'es' ? `Buscar en "${doc.filename}"` :
            `Search in "${doc.filename}"`);
        }
      }
    }

    if (context.scenario === 'folder_not_found') {
      if (context.availableFolders && context.availableFolders.length > 0) {
        for (const folder of context.availableFolders.slice(0, 3)) {
          suggestions.push(lang === 'pt' ? `Ver pasta "${folder.name}"` :
            lang === 'es' ? `Ver carpeta "${folder.name}"` :
            `View folder "${folder.name}"`);
        }
      }
    }

    if (context.scenario === 'no_documents') {
      suggestions.push(
        lang === 'pt' ? 'Fazer upload de documentos' :
        lang === 'es' ? 'Subir documentos' :
        'Upload documents'
      );
    }

    return suggestions;
  }

  /**
   * Build UI actions based on context
   */
  private buildUIActions(context: FallbackContext): FallbackResponse['uiActions'] {
    const actions: FallbackResponse['uiActions'] = [];

    if (context.scenario === 'file_not_found' && context.availableDocuments) {
      actions.push({
        type: 'show_files',
        data: { files: context.availableDocuments.slice(0, 5) }
      });
    }

    if (context.scenario === 'folder_not_found' && context.availableFolders) {
      actions.push({
        type: 'show_folders',
        data: { folders: context.availableFolders.slice(0, 5) }
      });
    }

    if (context.scenario === 'no_documents') {
      actions.push({ type: 'upload_prompt' });
    }

    return actions;
  }
}

export const fallbackResponseService = new FallbackResponseService();
export default fallbackResponseService;
