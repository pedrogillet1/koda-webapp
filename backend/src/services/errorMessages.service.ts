/**
 * Error Messages Service
 * Provides varied, natural error messages to avoid robotic repetition
 *
 * PURPOSE: Users reported that seeing the same error message repeatedly
 * feels robotic and buggy. This service provides 8+ varied templates
 * for each error scenario, randomly selected to feel more natural.
 */

export interface NotFoundContext {
  query: string;
  documentCount: number;
  hasSpecificDocument?: boolean;
  documentName?: string;
  language?: 'en' | 'pt' | 'es' | 'fr';
}

export class ErrorMessagesService {
  /**
   * Get a varied "not found" message based on context
   */
  static getNotFoundMessage(context: NotFoundContext): string {
    const templates = this.getNotFoundTemplates(context);

    // Randomly select one template
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  /**
   * Templates for "information not found" scenarios
   */
  private static getNotFoundTemplates(context: NotFoundContext): string[] {
    const { documentCount, hasSpecificDocument, documentName, language = 'en' } = context;

    // Handle different languages
    if (language === 'pt') {
      return this.getPortugueseNotFoundTemplates(context);
    }
    if (language === 'es') {
      return this.getSpanishNotFoundTemplates(context);
    }

    // No documents uploaded
    if (documentCount === 0) {
      return [
        "I don't have any documents to search through yet. Upload some files and I'll be ready to help!",
        "Looks like you haven't uploaded any documents yet. Once you do, I can help answer your questions!",
        "I'd love to help, but there aren't any documents in your workspace yet. Upload some files and let's get started!",
        "No documents here yet! Upload your files and I'll be able to answer questions about them.",
      ];
    }

    // Base templates (natural, conversational)
    const baseTemplates = [
      // Casual, helpful
      "Hmm, I couldn't find that specific information in your documents. Could you rephrase your question or point me to a particular document?",

      // Direct, friendly
      "I don't see that information in the documents I have. Want to try asking in a different way, or mention a specific file?",

      // Empathetic, solution-oriented
      "I searched through your documents but didn't find what you're looking for. Try mentioning the document name or section if you know it.",

      // Conversational, natural
      "I'm not finding that info right now. Sometimes rephrasing helps—maybe try asking about a specific document or topic?",

      // Honest, helpful
      "I don't have that information in the documents you've uploaded. If you know which file it's in, mentioning the name might help.",

      // Warm, supportive
      "I couldn't locate that in your current documents. Can you tell me which document or section you think it's in?",

      // Practical, direct
      "That specific detail isn't showing up in my search. Try narrowing it down—like mentioning a document name or chapter.",

      // Friendly, collaborative
      "I'm drawing a blank on that one. Want to try rephrasing, or let me know if there's a particular file I should focus on?",

      // Additional natural variants
      "I looked through your documents but couldn't find that. Could you be more specific about what you're looking for?",

      "That information doesn't seem to be in your current documents. Maybe try asking about it differently?",
    ];

    // Context-specific additions
    if (hasSpecificDocument && documentName) {
      baseTemplates.push(
        `I looked through "${documentName}" but couldn't find that information. Could you check if it's in a different section or document?`,

        `I searched "${documentName}" pretty thoroughly, but that detail isn't there. Want to try rephrasing, or check another file?`,

        `Hmm, I went through "${documentName}" and didn't see that. It might be phrased differently—want to try asking another way?`,

        `I couldn't find that in "${documentName}". Maybe it's in a different document, or try asking with different keywords?`,
      );
    }

    if (documentCount === 1) {
      baseTemplates.push(
        "I only have one document to work with right now. If the answer isn't in there, try uploading the file that contains this information.",

        "I checked your document but didn't find that. If it's in a different file, uploading it would help!",

        "That's not in the document I have. If you have other files with this info, upload them and I'll take a look.",
      );
    }

    return baseTemplates;
  }

  /**
   * Portuguese templates
   */
  private static getPortugueseNotFoundTemplates(context: NotFoundContext): string[] {
    const { documentCount, documentName, hasSpecificDocument } = context;

    if (documentCount === 0) {
      return [
        "Ainda não tenho nenhum documento para pesquisar. Faça upload de alguns arquivos e poderei ajudar!",
        "Parece que você ainda não fez upload de nenhum documento. Envie seus arquivos e vamos começar!",
        "Adoraria ajudar, mas não há documentos no seu workspace ainda. Faça upload e começamos!",
      ];
    }

    const templates = [
      "Hmm, não encontrei essa informação específica nos seus documentos. Pode reformular a pergunta ou indicar um documento específico?",
      "Não estou encontrando isso nos documentos que tenho. Quer tentar perguntar de outra forma?",
      "Pesquisei seus documentos mas não achei o que você procura. Tente mencionar o nome do documento ou seção.",
      "Essa informação não apareceu na minha busca. Talvez mencionar um documento ou capítulo específico ajude.",
      "Não encontrei isso nos seus documentos atuais. Pode me dizer em qual documento ou seção você acha que está?",
    ];

    if (hasSpecificDocument && documentName) {
      templates.push(
        `Procurei em "${documentName}" mas não encontrei essa informação. Pode verificar se está em outra seção?`,
        `Hmm, não achei isso em "${documentName}". Talvez esteja escrito de forma diferente?`,
      );
    }

    return templates;
  }

  /**
   * Spanish templates
   */
  private static getSpanishNotFoundTemplates(context: NotFoundContext): string[] {
    const { documentCount, documentName, hasSpecificDocument } = context;

    if (documentCount === 0) {
      return [
        "Todavía no tengo documentos para buscar. ¡Sube algunos archivos y podré ayudarte!",
        "Parece que aún no has subido ningún documento. ¡Envía tus archivos y empezamos!",
        "Me encantaría ayudar, pero no hay documentos en tu espacio todavía. ¡Sube algunos y comenzamos!",
      ];
    }

    const templates = [
      "Hmm, no encontré esa información en tus documentos. ¿Puedes reformular la pregunta o indicar un documento específico?",
      "No veo esa información en los documentos que tengo. ¿Quieres intentar preguntar de otra manera?",
      "Busqué en tus documentos pero no encontré lo que buscas. Intenta mencionar el nombre del documento o sección.",
      "Esa información no aparece en mi búsqueda. Tal vez mencionar un documento específico ayude.",
      "No encontré eso en tus documentos actuales. ¿Puedes decirme en qué documento o sección crees que está?",
    ];

    if (hasSpecificDocument && documentName) {
      templates.push(
        `Busqué en "${documentName}" pero no encontré esa información. ¿Puede estar en otra sección?`,
        `Hmm, no encontré eso en "${documentName}". ¿Tal vez está escrito de forma diferente?`,
      );
    }

    return templates;
  }

  /**
   * Get a varied "low confidence" warning message
   */
  static getLowConfidenceMessage(confidenceScore: number, language: string = 'en'): string {
    const percentage = Math.round(confidenceScore * 100);

    if (language === 'pt') {
      const templates = [
        `Encontrei algo, mas não tenho tanta certeza (cerca de ${percentage}% de confiança). Aqui está o que achei:`,
        `Aviso: não estou muito confiante sobre isso (${percentage}%). Aqui está o que encontrei:`,
        `Tenho uma resposta, mas recomendo verificar (confiança: ${percentage}%):`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    if (language === 'es') {
      const templates = [
        `Encontré algo, pero no estoy muy seguro (confianza: ${percentage}%). Aquí está lo que encontré:`,
        `Aviso: no estoy muy confiado sobre esto (${percentage}%). Aquí está lo que encontré:`,
        `Tengo una respuesta, pero recomiendo verificar (confianza: ${percentage}%):`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      `I found some information, but I'm only about ${percentage}% confident. Here's what I found, but you might want to double-check:`,

      `Just a heads up—I'm not super confident about this answer (around ${percentage}% sure). Here's my best guess:`,

      `I found something, but take it with a grain of salt (confidence: ${percentage}%). Here's what I think:`,

      `Fair warning: I'm only ${percentage}% sure about this. Here's what I found:`,

      `I have an answer, but I'd recommend verifying it (I'm ${percentage}% confident):`,

      `This might not be exactly right (${percentage}% confidence), but here's what I found:`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get a varied "Excel not readable" message
   */
  static getExcelErrorMessage(fileName: string, language: string = 'en'): string {
    if (language === 'pt') {
      const templates = [
        `Estou tendo dificuldade em ler os dados de "${fileName}". Tente perguntar sobre uma planilha ou coluna específica.`,
        `"${fileName}" não está cooperando. Tente ser mais específico—como "O que tem na coluna B?" ou "Mostre a planilha de Receitas."`,
        `Estou com dificuldade em processar "${fileName}". Se puder indicar uma planilha ou intervalo de células específico, pode ajudar!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      `I'm having trouble reading the data in "${fileName}". Excel files can be tricky—could you try asking about a specific sheet or column?`,

      `Hmm, "${fileName}" isn't cooperating. Try being more specific—like "What's in column B?" or "Show me the Revenue sheet."`,

      `I'm struggling to parse "${fileName}". If you can point me to a specific sheet name or cell range, that might help!`,

      `"${fileName}" is giving me trouble. Excel files work best when you ask about specific sheets or columns—want to try that?`,

      `I can see "${fileName}" but I'm having trouble finding that data. Try mentioning the sheet name (like "Budget 2025") or a specific column.`,

      `The Excel file "${fileName}" is a bit tricky to read. Could you specify which sheet or section you're interested in?`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get a varied "section not found" message
   */
  static getSectionNotFoundMessage(sectionNumber: string, documentName?: string, language: string = 'en'): string {
    const doc = documentName ? `"${documentName}"` : "your documents";

    if (language === 'pt') {
      const templates = [
        `Não encontrei a seção ${sectionNumber} em ${doc}. Pode verificar o número da seção ou tentar buscar por palavras-chave?`,
        `A seção ${sectionNumber} não aparece em ${doc}. Quer tentar um número diferente ou buscar pelo conteúdo?`,
        `Hmm, não vejo a seção ${sectionNumber} em ${doc}. Talvez perguntar sobre o conteúdo diretamente funcione melhor?`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      `I couldn't find section ${sectionNumber} in ${doc}. Could you double-check the section number, or try searching for keywords instead?`,

      `Section ${sectionNumber} isn't showing up in ${doc}. Want to try a different section number, or search by topic?`,

      `Hmm, I don't see section ${sectionNumber} in ${doc}. Maybe try asking about the content directly instead of the section number?`,

      `I looked for section ${sectionNumber} in ${doc} but came up empty. Try rephrasing without the section number and I'll search by content.`,

      `Section ${sectionNumber} isn't in ${doc} as far as I can tell. If you know what topic it covers, asking about that might work better!`,

      `I can't locate section ${sectionNumber} in ${doc}. The section might be numbered differently—want to try describing what you're looking for?`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get a varied "general error" message for unexpected failures
   */
  static getGeneralErrorMessage(language: string = 'en'): string {
    if (language === 'pt') {
      const templates = [
        "Algo deu errado do meu lado. Por favor, tente novamente em alguns segundos.",
        "Ops! Encontrei um problema inesperado. Pode tentar novamente?",
        "Desculpe, algo não funcionou como esperado. Tente mais uma vez?",
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    if (language === 'es') {
      const templates = [
        "Algo salió mal de mi lado. Por favor, intenta de nuevo en unos segundos.",
        "¡Ups! Encontré un problema inesperado. ¿Puedes intentar de nuevo?",
        "Lo siento, algo no funcionó como esperaba. ¿Intentas otra vez?",
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      "Something went wrong on my end. Please try again in a few seconds.",
      "Oops! I ran into an unexpected issue. Could you try that again?",
      "Sorry, something didn't work as expected. Want to give it another shot?",
      "I hit a snag trying to process that. Mind trying again?",
      "Something unexpected happened. Let's try that again!",
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Get a varied "rate limited" message
   */
  static getRateLimitedMessage(language: string = 'en'): string {
    if (language === 'pt') {
      const templates = [
        "Você está enviando muitas perguntas rapidamente. Aguarde um momento antes de tentar novamente.",
        "Calma aí! Preciso de alguns segundos para processar. Tente novamente em breve.",
        "Muitas solicitações de uma vez. Espere alguns segundos e tente de novo.",
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      "You're sending questions faster than I can keep up! Give me a moment, then try again.",
      "Whoa, that's a lot of requests! Wait a few seconds and try again.",
      "I need a moment to catch up. Please wait a bit before sending another question.",
      "Too many questions at once! Take a breather and try again in a few seconds.",
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

export const errorMessagesService = new ErrorMessagesService();
export default ErrorMessagesService;
