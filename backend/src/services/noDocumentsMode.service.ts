/**
 * ============================================================================
 * NO-DOCUMENTS MODE SERVICE
 * ============================================================================
 *
 * Handles all queries when user has zero documents
 * Provides onboarding guidance and prevents hallucinations
 */

export interface NoDocsModeResponse {
  answer: string;
  suggestions: string[];
  shouldShowUploadPrompt: boolean;
  allowBypass: boolean; // Allow general knowledge queries to bypass
}

/**
 * Generate appropriate response when user has no documents
 */
export function generateNoDocsResponse(
  query: string,
  language: 'en' | 'pt' | 'es' = 'pt'
): NoDocsModeResponse {
  const lowerQuery = query.toLowerCase();

  console.log(`[NO-DOCS-MODE] Generating response for query: "${query}" (lang: ${language})`);

  // ============================================================================
  // CASE 1: User asking about specific documents / counts
  // ============================================================================
  if (
    lowerQuery.includes('documento') ||
    lowerQuery.includes('arquivo') ||
    lowerQuery.includes('document') ||
    lowerQuery.includes('file') ||
    lowerQuery.includes('pdf') ||
    lowerQuery.includes('docx') ||
    lowerQuery.includes('xlsx') ||
    lowerQuery.includes('pptx') ||
    lowerQuery.includes('quantos') ||
    lowerQuery.includes('how many') ||
    lowerQuery.includes('cuántos') ||
    lowerQuery.includes('lista') ||
    lowerQuery.includes('list')
  ) {
    console.log('[NO-DOCS-MODE] Case 1: Document-specific query');

    const answers = {
      pt: `Você ainda não tem documentos na sua conta Koda.

**Para começar a usar o Koda:**

1. **Faça upload de documentos** clicando no botão "Upload" no canto superior direito
2. **Formatos suportados**: PDF, DOCX, PPTX, XLSX, TXT
3. **Após o upload**, você poderá fazer perguntas sobre o conteúdo dos seus documentos

O que você gostaria de fazer?`,

      en: `You don't have any documents in your Koda account yet.

**To get started with Koda:**

1. **Upload documents** by clicking the "Upload" button in the top right corner
2. **Supported formats**: PDF, DOCX, PPTX, XLSX, TXT
3. **After uploading**, you'll be able to ask questions about your document content

What would you like to do?`,

      es: `Aún no tienes documentos en tu cuenta de Koda.

**Para empezar a usar Koda:**

1. **Sube documentos** haciendo clic en el botón "Upload" en la esquina superior derecha
2. **Formatos soportados**: PDF, DOCX, PPTX, XLSX, TXT
3. **Después de subir**, podrás hacer preguntas sobre el contenido de tus documentos

¿Qué te gustaría hacer?`
    };

    const suggestions = {
      pt: ['Fazer upload de documentos', 'Ver formatos suportados', 'Conhecer os recursos do Koda'],
      en: ['Upload documents', 'View supported formats', 'Learn about Koda features'],
      es: ['Subir documentos', 'Ver formatos soportados', 'Conocer las funciones de Koda']
    };

    return {
      answer: answers[language],
      suggestions: suggestions[language],
      shouldShowUploadPrompt: true,
      allowBypass: false
    };
  }

  // ============================================================================
  // CASE 2: User asking how to use Koda / onboarding
  // ============================================================================
  if (
    lowerQuery.includes('como') ||
    lowerQuery.includes('how') ||
    lowerQuery.includes('começar') ||
    lowerQuery.includes('start') ||
    lowerQuery.includes('usar') ||
    lowerQuery.includes('use') ||
    lowerQuery.includes('funciona') ||
    lowerQuery.includes('works') ||
    lowerQuery.includes('help') ||
    lowerQuery.includes('ajuda')
  ) {
    console.log('[NO-DOCS-MODE] Case 2: Onboarding/how-to query');

    const answers = {
      pt: `Olá! Sou a Koda, sua assistente de documentos.

**Como funciona:**

**1. Upload de Documentos**
   - Clique em "Upload" no canto superior direito
   - Arraste e solte seus arquivos (PDF, DOCX, PPTX, XLSX, TXT)
   - Aguarde o processamento (geralmente alguns segundos)

**2. Faça Perguntas**
   - "Resuma o documento X"
   - "Quais são os principais pontos do relatório Y?"
   - "Compare os documentos A e B"

**3. Organize**
   - Crie pastas para organizar seus documentos
   - Use tags para facilitar a busca

**Recursos principais:**
- Busca semântica inteligente
- Resumos e análises
- Comparação entre documentos
- Extração de informações específicas

Pronto para começar? Faça upload do seu primeiro documento!`,

      en: `Hello! I'm Koda, your document assistant.

**How it works:**

**1. Upload Documents**
   - Click "Upload" in the top right corner
   - Drag and drop your files (PDF, DOCX, PPTX, XLSX, TXT)
   - Wait for processing (usually a few seconds)

**2. Ask Questions**
   - "Summarize document X"
   - "What are the main points of report Y?"
   - "Compare documents A and B"

**3. Organize**
   - Create folders to organize your documents
   - Use tags for easier searching

**Key features:**
- Smart semantic search
- Summaries and analysis
- Document comparison
- Specific information extraction

Ready to start? Upload your first document!`,

      es: `¡Hola! Soy Koda, tu asistente de documentos.

**Cómo funciona:**

**1. Subir Documentos**
   - Haz clic en "Upload" en la esquina superior derecha
   - Arrastra y suelta tus archivos (PDF, DOCX, PPTX, XLSX, TXT)
   - Espera el procesamiento (generalmente unos segundos)

**2. Haz Preguntas**
   - "Resume el documento X"
   - "¿Cuáles son los puntos principales del informe Y?"
   - "Compara los documentos A y B"

**3. Organiza**
   - Crea carpetas para organizar tus documentos
   - Usa etiquetas para facilitar la búsqueda

**Características principales:**
- Búsqueda semántica inteligente
- Resúmenes y análisis
- Comparación de documentos
- Extracción de información específica

¿Listo para empezar? ¡Sube tu primer documento!`
    };

    const suggestions = {
      pt: ['Fazer upload agora', 'Ver exemplo de uso', 'Conhecer mais recursos'],
      en: ['Upload now', 'See usage example', 'Learn more features'],
      es: ['Subir ahora', 'Ver ejemplo de uso', 'Conocer más funciones']
    };

    return {
      answer: answers[language],
      suggestions: suggestions[language],
      shouldShowUploadPrompt: true,
      allowBypass: false
    };
  }

  // ============================================================================
  // CASE 3: User asking about specific topics requiring documents
  // ============================================================================
  if (
    lowerQuery.includes('lgpd') ||
    lowerQuery.includes('gdpr') ||
    lowerQuery.includes('contrato') ||
    lowerQuery.includes('contract') ||
    lowerQuery.includes('projeto') ||
    lowerQuery.includes('project') ||
    lowerQuery.includes('análise') ||
    lowerQuery.includes('analysis') ||
    lowerQuery.includes('scrum') ||
    lowerQuery.includes('kanban') ||
    lowerQuery.includes('agile') ||
    lowerQuery.includes('mezanino') ||
    lowerQuery.includes('guarda') ||
    lowerQuery.includes('storage') ||
    lowerQuery.includes('parque') ||
    lowerQuery.includes('relatório') ||
    lowerQuery.includes('report')
  ) {
    console.log('[NO-DOCS-MODE] Case 3: Topic-specific query (requires documents)');

    const answers = {
      pt: `Para que eu possa te ajudar com isso, você precisa primeiro fazer upload dos documentos relevantes.

**Como fazer:**

1. Clique em "Upload" no canto superior direito
2. Selecione os documentos sobre o tema que você quer analisar
3. Aguarde o processamento
4. Faça sua pergunta novamente

**Dica:** Quanto mais documentos você tiver sobre o assunto, melhores serão minhas respostas!

Quer fazer upload agora?`,

      en: `To help you with that, you first need to upload the relevant documents.

**How to do it:**

1. Click "Upload" in the top right corner
2. Select the documents about the topic you want to analyze
3. Wait for processing
4. Ask your question again

**Tip:** The more documents you have on the subject, the better my answers will be!

Want to upload now?`,

      es: `Para ayudarte con eso, primero necesitas subir los documentos relevantes.

**Cómo hacerlo:**

1. Haz clic en "Upload" en la esquina superior derecha
2. Selecciona los documentos sobre el tema que quieres analizar
3. Espera el procesamiento
4. Haz tu pregunta de nuevo

**Consejo:** ¡Cuantos más documentos tengas sobre el tema, mejores serán mis respuestas!

¿Quieres subir ahora?`
    };

    const suggestions = {
      pt: ['Fazer upload de documentos', 'Ver formatos suportados'],
      en: ['Upload documents', 'View supported formats'],
      es: ['Subir documentos', 'Ver formatos soportados']
    };

    return {
      answer: answers[language],
      suggestions: suggestions[language],
      shouldShowUploadPrompt: true,
      allowBypass: false
    };
  }

  // ============================================================================
  // CASE 4: General questions - allow bypass to general knowledge
  // ============================================================================
  console.log('[NO-DOCS-MODE] Case 4: General knowledge query (allowing bypass)');

  // For general questions, we allow the RAG to continue but with no document context
  return {
    answer: '', // Empty answer means RAG should handle it
    suggestions: [],
    shouldShowUploadPrompt: false,
    allowBypass: true // Allow this to go through to general knowledge
  };
}

/**
 * Check if query explicitly requires documents
 */
export function queryRequiresDocuments(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  const documentKeywords = [
    'documento', 'arquivo', 'document', 'file',
    'pdf', 'docx', 'xlsx', 'pptx',
    'quantos', 'how many', 'cuántos',
    'lista', 'list', 'mostrar', 'show',
    'meus', 'my', 'mis',
    'pasta', 'folder', 'carpeta'
  ];

  return documentKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Check if query is a meta query about documents
 */
export function isMetaQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  const metaPatterns = [
    /quantos\s+(documentos?|arquivos?)/i,
    /how\s+many\s+(documents?|files?)/i,
    /cuántos\s+(documentos?|archivos?)/i,
    /list(ar|e)?\s+(my|meus|mis)?\s*(documentos?|arquivos?|documents?|files?)/i,
    /mostr(ar|e)?\s+(my|meus|mis)?\s*(documentos?|arquivos?|documents?|files?)/i,
    /quais\s+(são\s+)?(my|meus|mis)?\s*(documentos?|arquivos?)/i,
    /what\s+(are\s+)?(my)?\s*(documents?|files?)/i
  ];

  return metaPatterns.some(pattern => pattern.test(lowerQuery));
}

export const noDocumentsModeService = {
  generateNoDocsResponse,
  queryRequiresDocuments,
  isMetaQuery
};

export default noDocumentsModeService;
