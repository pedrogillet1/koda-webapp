/**
 * Unified Formatting Service
 *
 * This service implements ALL formatting standards from the research findings.
 * It handles all 24 output types identified in the audit with consistent,
 * natural, and readable formatting.
 *
 * Research Principles Applied:
 * - Cognitive Load Theory: Use headings, bullets, bold text to reduce extraneous load
 * - F-Pattern Scanning: Front-load important information, use visual hierarchy
 * - Koda Specification: Professional yet friendly, direct, precise, evidence-based
 * - Hybrid Model: More structured than Gemini, more natural than ChatGPT
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type OutputType =
  | 'greeting'
  | 'capabilities'
  | 'farewell'
  | 'file_listing'
  | 'folder_listing'
  | 'file_search'
  | 'file_not_found'
  | 'simple_answer'
  | 'complex_answer'
  | 'comparison'
  | 'summary'
  | 'data_extraction'
  | 'methodology'
  | 'definition'
  | 'causal'
  | 'no_documents'
  | 'insufficient_context'
  | 'ambiguous_query'
  | 'out_of_scope'
  | 'processing_error'
  | 'document_generation_confirm'
  | 'document_generation_progress'
  | 'pagination'
  | 'next_steps';

export interface FormatContext {
  outputType: OutputType;
  language: string;
  userQuery?: string;
  documentCount?: number;
  documentSize?: 'small' | 'medium' | 'large'; // < 10 pages, 10-100, > 100
  retrievedChunks?: any[];
  data?: any; // Flexible data for specific output types
  conversationHistory?: string[];
}

export interface FormattedOutput {
  content: string;
  metadata: {
    outputType: OutputType;
    language: string;
    wordCount: number;
    hasStructure: boolean; // headings, bullets, tables
    estimatedReadingTime: number; // seconds
  };
}

// ============================================================================
// FORMAT TEMPLATES (Based on Research Findings)
// ============================================================================

const FORMAT_TEMPLATES: Record<string, {
  maxWords: number;
  structure: string;
  rules: string[];
}> = {
  // Template 1: Simple Answer (1-2 sentences, direct)
  simple_answer: {
    maxWords: 50,
    structure: 'single_paragraph',
    rules: [
      'Answer the question directly in 1-2 sentences',
      'Do not add extra context unless necessary',
      'Include specific values (dates, numbers, names) when available',
      'Do not use bullet points or headings',
    ],
  },

  // Template 2: Complex Answer (summary + headings + bullets)
  complex_answer: {
    maxWords: 400,
    structure: 'summary_headings_bullets',
    rules: [
      'Start with a 1-2 sentence summary',
      'Use 2-4 headings (###) to structure the body',
      'Use bullet points for lists and key points',
      'Each bullet must be 2-3 lines long with bold key terms',
      'Paragraphs must be 3-5 sentences',
      'Front-load important information',
    ],
  },

  // Template 3: Capabilities (short paragraphs, no bullets)
  capabilities: {
    maxWords: 80,
    structure: 'short_paragraphs',
    rules: [
      'Use 2-3 short sentences ONLY',
      'Do NOT use bullet points or lists',
      'Be conversational and friendly',
      'End with a question to engage the user',
      'Keep response UNDER 80 words total',
    ],
  },

  // Template 4: File Listing (natural summary + bullets)
  file_listing: {
    maxWords: 150,
    structure: 'summary_bullets_closing',
    rules: [
      'Start with a natural language summary of the file count',
      'List files with bullet points',
      'End with a conversational closing',
      'Do not use formal labels like "Tip:" or "Next step:"',
    ],
  },

  // Template 5: Comparison (table + summary)
  comparison: {
    maxWords: 300,
    structure: 'summary_table_takeaways',
    rules: [
      'Start with a 1-sentence summary of the main difference',
      'Use a markdown table to compare key attributes',
      'End with 2-3 bullet points of key takeaways',
    ],
  },

  // Template 6: Error Message (empathetic, helpful)
  error: {
    maxWords: 40,
    structure: 'problem_solution',
    rules: [
      'Keep it to 1-2 sentences MAX',
      'Acknowledge the problem briefly',
      'Explain what went wrong or what is missing',
      'Suggest a concrete next step',
      'Do not use robotic phrases like "An error occurred"',
    ],
  },

  // Template 7: Greeting (short, friendly)
  greeting: {
    maxWords: 30,
    structure: 'single_sentence',
    rules: [
      'Keep it to 1 short sentence',
      'Be warm but not over-the-top',
      'Reference document count if available',
      'End with an open question or invitation',
      'No emojis, no exclamation at the end',
    ],
  },

  // Template 8: Farewell (brief, warm)
  farewell: {
    maxWords: 20,
    structure: 'single_sentence',
    rules: [
      'Keep it to 1 short sentence',
      'Be warm and professional',
      'Invite them to return if needed',
      'No emojis',
    ],
  },
};

// ============================================================================
// PROMPT ENGINEERING FUNCTIONS
// ============================================================================

/**
 * Generates the master formatting prompt based on output type and context
 */
function generateFormattingPrompt(context: FormatContext): string {
  const template = FORMAT_TEMPLATES[getTemplateKey(context.outputType)];

  let dataContext = '';
  if (context.data) {
    dataContext = `\nCONTEXT DATA: ${JSON.stringify(context.data, null, 2)}`;
  }

  const basePrompt = `You are Koda, a professional document AI assistant.

Your goal is to provide clear, concise, and trustworthy answers based on the user's documents.

CORE PRINCIPLES:
- Clarity first: The main answer must be understandable in 3-5 seconds
- Evidence-based: Point to file names, sections, dates when possible
- Cognitive load reduction: Use headings, bullets, bold text strategically
- Brevity for simple questions, depth for complex ones
- Respect for time: Go straight to what the user needs

LANGUAGE AND TONE:
- Professional yet friendly (70% professional, 30% casual)
- Direct: Answer the question first, then context
- Precise: Use concrete numbers, clauses, pages, names
- Calm and empathetic, never melodramatic
- Avoid robotic phrases: "Based on the provided context", "As an AI", "I hope this helps"

FORMATTING RULES FOR THIS OUTPUT TYPE (${context.outputType}):
${template.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Maximum word count: ${template.maxWords} words
Structure: ${template.structure}

LANGUAGE: Respond in ${getLanguageName(context.language)}
${context.userQuery ? `\nUSER QUERY: ${context.userQuery}` : ''}
${context.documentCount !== undefined ? `\nUSER HAS ${context.documentCount} DOCUMENTS UPLOADED` : ''}
${dataContext}

Generate the response now:`;

  return basePrompt;
}

/**
 * Get full language name from code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
  };
  return languages[code] || 'English';
}

/**
 * Maps output type to template key
 */
function getTemplateKey(outputType: OutputType): string {
  const mapping: Record<OutputType, string> = {
    greeting: 'greeting',
    capabilities: 'capabilities',
    farewell: 'farewell',
    file_listing: 'file_listing',
    folder_listing: 'file_listing',
    file_search: 'file_listing',
    file_not_found: 'error',
    simple_answer: 'simple_answer',
    complex_answer: 'complex_answer',
    comparison: 'comparison',
    summary: 'complex_answer',
    data_extraction: 'comparison',
    methodology: 'complex_answer',
    definition: 'simple_answer',
    causal: 'complex_answer',
    no_documents: 'error',
    insufficient_context: 'error',
    ambiguous_query: 'error',
    out_of_scope: 'error',
    processing_error: 'error',
    document_generation_confirm: 'simple_answer',
    document_generation_progress: 'simple_answer',
    pagination: 'simple_answer',
    next_steps: 'simple_answer',
  };

  return mapping[outputType] || 'simple_answer';
}

// ============================================================================
// MAIN FORMATTING FUNCTION
// ============================================================================

/**
 * Generates formatted output for any Koda response type
 *
 * This is the main entry point for all response generation.
 * It uses AI to generate natural, well-formatted responses based on
 * the research findings and Koda specification.
 */
export async function generateFormattedOutput(
  context: FormatContext
): Promise<FormattedOutput> {
  try {
    // Generate the formatting prompt
    const prompt = generateFormattingPrompt(context);

    // Get template to determine appropriate token limit
    const template = FORMAT_TEMPLATES[getTemplateKey(context.outputType)];
    // Estimate tokens: ~1.3 tokens per word, with some buffer
    const maxTokens = Math.min(Math.ceil(template.maxWords * 1.5), 500);

    // Get the AI model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      },
    });

    // Generate the response
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    // Check for empty response - use fallback if Gemini returned nothing
    if (!content || content.length === 0) {
      console.warn(`[UnifiedFormatting] Gemini returned empty response for ${context.outputType}, using fallback`);
      return {
        content: getFallbackResponse(context),
        metadata: {
          outputType: context.outputType,
          language: context.language,
          wordCount: 0,
          hasStructure: false,
          estimatedReadingTime: 0,
        },
      };
    }

    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const hasStructure =
      /#{1,3}\s/.test(content) || /^[-*•]\s/m.test(content) || /\|.*\|/.test(content);
    const estimatedReadingTime = Math.ceil((wordCount / 200) * 60); // 200 words per minute

    return {
      content,
      metadata: {
        outputType: context.outputType,
        language: context.language,
        wordCount,
        hasStructure,
        estimatedReadingTime,
      },
    };
  } catch (error) {
    console.error('[UnifiedFormatting] Error generating formatted output:', error);

    // Fallback to a simple, safe response
    return {
      content: getFallbackResponse(context),
      metadata: {
        outputType: context.outputType,
        language: context.language,
        wordCount: 0,
        hasStructure: false,
        estimatedReadingTime: 0,
      },
    };
  }
}

// ============================================================================
// FALLBACK RESPONSES (For Error Cases)
// ============================================================================

function getFallbackResponse(context: FormatContext): string {
  const fallbacks: Record<string, Record<string, string>> = {
    en: {
      greeting: 'Hi! What would you like to know about your documents?',
      capabilities:
        'I can answer questions about your documents, find specific information, and help you organize your files. What would you like to know?',
      farewell: 'Goodbye! Let me know if you need anything else.',
      file_listing: 'Here are your files.',
      file_not_found: "I couldn't find that file. Could you check the name?",
      no_documents: 'You have no documents uploaded yet. Upload some files to get started!',
      insufficient_context:
        "I couldn't find enough information in your documents to answer that question.",
      ambiguous_query: 'Could you clarify what you mean? I found multiple possibilities.',
      out_of_scope: "That question is outside what I can help with based on your documents.",
      processing_error: 'Something went wrong. Please try again or rephrase your question.',
      default: "I'm here to help. What would you like to know?",
    },
    pt: {
      greeting: 'Olá! O que você gostaria de saber sobre seus documentos?',
      capabilities:
        'Posso responder perguntas sobre seus documentos, encontrar informações específicas e ajudar a organizar seus arquivos. O que você gostaria de saber?',
      farewell: 'Até logo! Me avise se precisar de algo.',
      file_listing: 'Aqui estão seus arquivos.',
      file_not_found: 'Não encontrei esse arquivo. Pode verificar o nome?',
      no_documents:
        'Você ainda não tem documentos. Faça upload de alguns arquivos para começar!',
      insufficient_context:
        'Não encontrei informações suficientes nos seus documentos para responder isso.',
      ambiguous_query: 'Pode esclarecer o que você quer dizer? Encontrei várias possibilidades.',
      out_of_scope: 'Essa pergunta está fora do que posso ajudar com base nos seus documentos.',
      processing_error: 'Algo deu errado. Por favor, tente novamente ou reformule sua pergunta.',
      default: 'Estou aqui para ajudar. O que você gostaria de saber?',
    },
    es: {
      greeting: '¡Hola! ¿Qué te gustaría saber sobre tus documentos?',
      capabilities:
        'Puedo responder preguntas sobre tus documentos, encontrar información específica y ayudarte a organizar tus archivos. ¿Qué te gustaría saber?',
      farewell: '¡Adiós! Avísame si necesitas algo más.',
      file_listing: 'Aquí están tus archivos.',
      file_not_found: 'No encontré ese archivo. ¿Puedes verificar el nombre?',
      no_documents: 'No tienes documentos aún. ¡Sube algunos archivos para empezar!',
      insufficient_context:
        'No encontré suficiente información en tus documentos para responder eso.',
      ambiguous_query: '¿Puedes aclarar qué quieres decir? Encontré varias posibilidades.',
      out_of_scope:
        'Esa pregunta está fuera de lo que puedo ayudar basándome en tus documentos.',
      processing_error: 'Algo salió mal. Por favor, inténtalo de nuevo o reformula tu pregunta.',
      default: 'Estoy aquí para ayudar. ¿Qué te gustaría saber?',
    },
    fr: {
      greeting: 'Bonjour ! Que voulez-vous savoir sur vos documents ?',
      capabilities:
        'Je peux répondre à des questions sur vos documents, trouver des informations spécifiques et vous aider à organiser vos fichiers. Que voulez-vous savoir ?',
      farewell: 'Au revoir ! Faites-moi savoir si vous avez besoin de quelque chose.',
      file_listing: 'Voici vos fichiers.',
      file_not_found: "Je n'ai pas trouvé ce fichier. Pouvez-vous vérifier le nom ?",
      no_documents:
        "Vous n'avez pas encore de documents. Téléchargez des fichiers pour commencer !",
      insufficient_context:
        "Je n'ai pas trouvé assez d'informations dans vos documents pour répondre.",
      ambiguous_query:
        'Pouvez-vous clarifier ce que vous voulez dire ? J\'ai trouvé plusieurs possibilités.',
      out_of_scope:
        "Cette question est en dehors de ce que je peux aider basé sur vos documents.",
      processing_error:
        "Quelque chose s'est mal passé. Veuillez réessayer ou reformuler votre question.",
      default: 'Je suis là pour aider. Que voulez-vous savoir ?',
    },
  };

  const lang = context.language in fallbacks ? context.language : 'en';
  const type = context.outputType in fallbacks[lang] ? context.outputType : 'default';

  return fallbacks[lang][type] || fallbacks[lang]['default'];
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that the generated output meets quality standards
 */
export function validateOutput(output: FormattedOutput): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // Check for robotic phrases
  const roboticPhrases = [
    /based on the provided context/i,
    /as an AI language model/i,
    /I hope this (information )?is (helpful|useful)/i,
    /please be advised that/i,
    /processing your request/i,
    /here is the information you requested/i,
  ];

  roboticPhrases.forEach((phrase) => {
    if (phrase.test(output.content)) {
      issues.push(`Contains robotic phrase: ${phrase.source}`);
      score -= 10;
    }
  });

  // Check paragraph length (should be 3-5 sentences)
  const paragraphs = output.content
    .split('\n\n')
    .filter((p) => p.trim() && !p.startsWith('#') && !p.startsWith('-') && !p.startsWith('*'));
  const longParagraphs = paragraphs.filter((p) => {
    const sentences = p.split(/[.!?]+/).filter((s) => s.trim());
    return sentences.length > 5;
  });

  if (longParagraphs.length > 0) {
    issues.push(`${longParagraphs.length} paragraph(s) are too long (> 5 sentences)`);
    score -= 5 * longParagraphs.length;
  }

  // Check bullet point length (should be 2-3 lines)
  const bullets = output.content.match(/^[-*•]\s+.+$/gm) || [];
  const shortBullets = bullets.filter((b) => b.length < 50); // Rough estimate for 1 line

  if (shortBullets.length > bullets.length / 2) {
    issues.push(`Too many short bullets (${shortBullets.length}/${bullets.length})`);
    score -= 5;
  }

  return {
    isValid: score >= 70,
    issues,
    score: Math.max(0, score),
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export const unifiedFormattingService = {
  generateFormattedOutput,
  validateOutput,
};

export default unifiedFormattingService;
