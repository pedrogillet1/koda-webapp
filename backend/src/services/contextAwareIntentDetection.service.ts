/**
 * ============================================================================
 * CONTEXT-AWARE INTENT DETECTION SERVICE
 * ============================================================================
 *
 * Advanced 6-stage intent detection pipeline with:
 * - Negation detection (don't, never, stop)
 * - Completeness validation (missing objects)
 * - Entity extraction (filenames, folders, topics)
 * - Pronoun resolution using conversation history
 * - Primary intent detection with disambiguation
 * - Multi-intent detection (and, then, also)
 *
 * Verb Disambiguation:
 * - "show" → preview vs listing vs content
 * - "find" → file search vs content query
 * - "what" → 5 different contexts
 * - "list" → enumerate vs show content
 * - "open" → navigate vs view content
 *
 * Languages: English, Portuguese, Spanish
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedEntity {
  type: 'filename' | 'folder' | 'topic' | 'date' | 'number' | 'person' | 'organization';
  value: string;
  confidence: number;
  originalText: string;
}

export interface ResolvedPronoun {
  pronoun: string;
  resolvedTo: string;
  confidence: number;
  source: 'previous_query' | 'assistant_response' | 'entity_mention';
}

export interface DetectedIntent {
  primary: IntentCategory;
  subIntent?: string;
  confidence: number;
  requiresDocuments: boolean;
  requiresDatabase: boolean;
  isRefusal: boolean;
  disambiguation?: string;
}

export interface MultiIntentResult {
  intents: DetectedIntent[];
  connector: 'and' | 'then' | 'also' | 'or' | null;
  executionOrder: 'parallel' | 'sequential' | 'single';
}

export interface ContextAwareIntentResult {
  // Stage 1: Negation
  hasNegation: boolean;
  negationType?: 'prohibition' | 'reversal' | 'cessation';
  negatedAction?: string;

  // Stage 2: Completeness
  isComplete: boolean;
  missingElements?: string[];
  clarificationNeeded?: string;

  // Stage 3: Entities
  entities: ExtractedEntity[];

  // Stage 4: Pronoun Resolution
  resolvedPronouns: ResolvedPronoun[];
  resolvedQuery: string;

  // Stage 5: Primary Intent
  primaryIntent: DetectedIntent;

  // Stage 6: Multi-Intent
  multiIntent: MultiIntentResult;

  // Meta
  confidence: number;
  processingTimeMs: number;
  language: 'en' | 'pt' | 'es';
  originalQuery: string;
}

export type IntentCategory =
  | 'greeting'
  | 'capability'
  | 'document_content'    // RAG search for information
  | 'document_preview'    // Show file preview
  | 'document_listing'    // List documents in folder
  | 'file_search'         // Find file by name
  | 'file_action'         // Create, move, rename, delete
  | 'folder_navigation'   // Open folder, navigate
  | 'metadata_query'      // How many files, where is X
  | 'comparison'          // Compare documents
  | 'explanation'         // Why, how, explain
  | 'calculation'         // Calculate, sum, total from docs
  | 'synthesis'           // Across all documents
  | 'refusal'             // Can't do / won't do
  | 'general';            // Default fallback

// ============================================================================
// NEGATION PATTERNS (Stage 1)
// ============================================================================

const NEGATION_PATTERNS = {
  prohibition: {
    en: [
      /\b(don't|do not|cannot|can't|won't|will not|shouldn't|should not|must not|mustn't)\b/i,
      /\b(never|no way|not allowed|forbidden|prohibited)\b/i,
    ],
    pt: [
      /\b(não|nunca|jamais|nem|de jeito nenhum|de forma alguma)\b/i,
      /\b(proibido|não pode|não devo|não quero)\b/i,
    ],
    es: [
      /\b(no|nunca|jamás|ni|de ninguna manera|de ningún modo)\b/i,
      /\b(prohibido|no puedo|no debo|no quiero)\b/i,
    ],
  },
  reversal: {
    en: [/\b(undo|reverse|go back|cancel|revert)\b/i],
    pt: [/\b(desfazer|reverter|voltar|cancelar)\b/i],
    es: [/\b(deshacer|revertir|volver|cancelar)\b/i],
  },
  cessation: {
    en: [/\b(stop|halt|cease|end|quit|exit)\b/i],
    pt: [/\b(parar|cessar|terminar|encerrar|sair)\b/i],
    es: [/\b(parar|cesar|terminar|salir|detener)\b/i],
  },
};

// ============================================================================
// INCOMPLETENESS PATTERNS (Stage 2)
// ============================================================================

const INCOMPLETE_PATTERNS = {
  // Verbs that require objects
  missingObject: {
    en: [
      { pattern: /^(show|display|view)$/i, needs: 'what to show' },
      { pattern: /^(find|search|locate)$/i, needs: 'what to find' },
      { pattern: /^(delete|remove|erase)$/i, needs: 'what to delete' },
      { pattern: /^(move|transfer)$/i, needs: 'what to move and where' },
      { pattern: /^(rename)$/i, needs: 'what to rename and new name' },
      { pattern: /^(create|make|new)$/i, needs: 'what to create' },
      { pattern: /^(compare)$/i, needs: 'what to compare' },
      { pattern: /^(explain|describe|summarize)$/i, needs: 'what to explain' },
    ],
    pt: [
      { pattern: /^(mostre|mostrar|exibir)$/i, needs: 'o que mostrar' },
      { pattern: /^(encontre|encontrar|buscar|procurar)$/i, needs: 'o que encontrar' },
      { pattern: /^(delete|apagar|excluir|remover)$/i, needs: 'o que apagar' },
      { pattern: /^(mover|transferir)$/i, needs: 'o que mover e para onde' },
      { pattern: /^(renomear)$/i, needs: 'o que renomear e novo nome' },
      { pattern: /^(criar|fazer|novo)$/i, needs: 'o que criar' },
      { pattern: /^(comparar)$/i, needs: 'o que comparar' },
      { pattern: /^(explicar|descrever|resumir)$/i, needs: 'o que explicar' },
    ],
    es: [
      { pattern: /^(mostrar|muestra|ver)$/i, needs: 'qué mostrar' },
      { pattern: /^(encontrar|buscar|localizar)$/i, needs: 'qué encontrar' },
      { pattern: /^(eliminar|borrar|quitar)$/i, needs: 'qué eliminar' },
      { pattern: /^(mover|transferir)$/i, needs: 'qué mover y adónde' },
      { pattern: /^(renombrar)$/i, needs: 'qué renombrar y nuevo nombre' },
      { pattern: /^(crear|hacer|nuevo)$/i, needs: 'qué crear' },
      { pattern: /^(comparar)$/i, needs: 'qué comparar' },
      { pattern: /^(explicar|describir|resumir)$/i, needs: 'qué explicar' },
    ],
  },
  // Phrases that are too vague
  vague: {
    en: [
      /^(something|anything|stuff|things)$/i,
      /^(help|help me)$/i,
      /^(do it|fix it|make it work)$/i,
    ],
    pt: [
      /^(algo|alguma coisa|coisas)$/i,
      /^(ajuda|me ajuda|ajude-me)$/i,
      /^(faça isso|conserta|faz funcionar)$/i,
    ],
    es: [
      /^(algo|alguna cosa|cosas)$/i,
      /^(ayuda|ayúdame)$/i,
      /^(hazlo|arréglalo|haz que funcione)$/i,
    ],
  },
};

// ============================================================================
// ENTITY EXTRACTION PATTERNS (Stage 3)
// ============================================================================

const ENTITY_PATTERNS = {
  filename: [
    // File extensions
    /["']([^"']+\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|json))["']/i,
    /\b([a-zA-Z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|json))\b/i,
    // Quoted filenames
    /(?:file|document|arquivo|documento|archivo)\s+["']([^"']+)["']/i,
    /["']([^"']{3,50})["']\s+(?:file|document|arquivo|documento|archivo)/i,
    // Named patterns
    /(?:called|named|chamado|chamada|llamado|llamada)\s+["']?([^"'\s,]+)["']?/i,
  ],
  folder: [
    // Folder references
    /(?:folder|pasta|carpeta)\s+["']([^"']+)["']/i,
    /["']([^"']+)["']\s+(?:folder|pasta|carpeta)/i,
    /(?:in|into|to|na|para|en)\s+(?:the\s+)?(?:folder|pasta|carpeta)\s+["']?([^"'\s,]+)["']?/i,
  ],
  topic: [
    // About X patterns
    /(?:about|regarding|concerning|on|sobre|acerca de)\s+["']?([^"'?.!]+?)["']?(?:\?|$|\.)/i,
    // Topic after verbs
    /(?:explain|describe|summarize|analyze|explicar|descrever|resumir|analisar)\s+(.+?)(?:\?|$|\.)/i,
  ],
  date: [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}\b/i,
    /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?\d{4}\b/i,
    /\b(Q[1-4]\s*\d{4}|FY\s*\d{4})\b/i,
  ],
  number: [
    /\$[\d,]+(?:\.\d{2})?/,
    /[\d,]+(?:\.\d+)?%/,
    /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|mil|milhão|milhões|bilhão|bilhões|millón|millones)\b/i,
  ],
  person: [
    /(?:from|by|by\s+author|de|por)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  ],
  organization: [
    /(?:from|by|at|de|por|em)\s+([A-Z][A-Za-z]+(?:\s+(?:Inc|Corp|LLC|Ltd|SA|LTDA))?\.?)/,
  ],
};

// ============================================================================
// PRONOUN PATTERNS (Stage 4)
// ============================================================================

const PRONOUN_PATTERNS = {
  en: {
    document: [/\b(it|this|that|the document|the file|this one|that one)\b/i],
    folder: [/\b(it|this|that|the folder|this folder|that folder)\b/i],
    topic: [/\b(it|this|that|this topic|that topic|the topic)\b/i],
    plural: [/\b(they|them|these|those|the documents|the files)\b/i],
  },
  pt: {
    document: [/\b(ele|ela|isso|este|esta|esse|essa|o documento|o arquivo)\b/i],
    folder: [/\b(ela|essa|esta|a pasta)\b/i],
    topic: [/\b(isso|este|esta|esse|essa|o assunto|o tema)\b/i],
    plural: [/\b(eles|elas|esses|essas|estes|estas|os documentos|os arquivos)\b/i],
  },
  es: {
    document: [/\b(él|ella|esto|este|esta|ese|esa|el documento|el archivo)\b/i],
    folder: [/\b(ella|esa|esta|la carpeta)\b/i],
    topic: [/\b(esto|este|esta|ese|esa|el tema|el asunto)\b/i],
    plural: [/\b(ellos|ellas|estos|estas|esos|esas|los documentos|los archivos)\b/i],
  },
};

// ============================================================================
// VERB DISAMBIGUATION PATTERNS (Stage 5)
// ============================================================================

const VERB_DISAMBIGUATION = {
  show: {
    // "Show" disambiguation
    preview: {
      en: [
        /show\s+(?:me\s+)?(?:the\s+)?(?:content|contents|preview)\s+(?:of\s+)?/i,
        /show\s+(?:me\s+)?what(?:'s|\s+is)\s+(?:in|inside)/i,
        /show\s+(?:me\s+)?(?:the\s+)?first\s+(?:page|few\s+lines)/i,
      ],
      pt: [
        /mostre?\s+(?:me\s+)?(?:o\s+)?(?:conteúdo|preview)\s+(?:de|do|da)?/i,
        /mostre?\s+(?:me\s+)?o\s+que\s+(?:tem|há)\s+(?:no|na)/i,
      ],
      es: [
        /muestra?\s+(?:me\s+)?(?:el\s+)?(?:contenido|vista\s+previa)\s+(?:de)?/i,
        /muestra?\s+(?:me\s+)?(?:lo\s+)?que\s+(?:hay|tiene)\s+(?:en)?/i,
      ],
    },
    listing: {
      en: [
        /show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(?:files|documents|folders)/i,
        /show\s+(?:me\s+)?what\s+(?:files|documents)\s+(?:I\s+have|are\s+there)/i,
        /show\s+(?:me\s+)?(?:the\s+)?list/i,
      ],
      pt: [
        /mostre?\s+(?:me\s+)?(?:todos?\s+)?(?:os\s+)?(?:meus?\s+)?(?:arquivos|documentos|pastas)/i,
        /mostre?\s+(?:me\s+)?(?:a\s+)?lista/i,
      ],
      es: [
        /muestra?\s+(?:me\s+)?(?:todos?\s+)?(?:mis?\s+)?(?:archivos|documentos|carpetas)/i,
        /muestra?\s+(?:me\s+)?(?:la\s+)?lista/i,
      ],
    },
    content: {
      en: [
        /show\s+(?:me\s+)?(?:information|info|data|details)\s+(?:about|on|regarding)/i,
        /show\s+(?:me\s+)?what\s+(?:the\s+)?(?:document|documents)\s+(?:say|says)/i,
        /show\s+(?:me\s+)?(?:the\s+)?(?:revenue|sales|data|results|findings)/i,
      ],
      pt: [
        /mostre?\s+(?:me\s+)?(?:informações?|info|dados|detalhes)\s+(?:sobre|de)/i,
        /mostre?\s+(?:me\s+)?o\s+que\s+(?:o\s+)?(?:documento|documentos)\s+(?:diz|dizem)/i,
      ],
      es: [
        /muestra?\s+(?:me\s+)?(?:información|info|datos|detalles)\s+(?:sobre|de)/i,
        /muestra?\s+(?:me\s+)?(?:lo\s+)?que\s+(?:el\s+)?(?:documento|documentos)\s+(?:dice|dicen)/i,
      ],
    },
  },
  find: {
    // "Find" disambiguation
    fileSearch: {
      en: [
        /find\s+(?:the\s+)?(?:file|document)\s+(?:named|called)/i,
        /find\s+(?:where\s+)?(?:the\s+)?[\w.-]+\.(?:pdf|docx?|xlsx?|pptx?)/i,
        /find\s+(?:the\s+)?location\s+of/i,
      ],
      pt: [
        /encontr(?:ar|e)\s+(?:o\s+)?(?:arquivo|documento)\s+(?:chamado|com\s+nome)/i,
        /encontr(?:ar|e)\s+(?:onde\s+)?(?:está?\s+)?[\w.-]+\.(?:pdf|docx?|xlsx?|pptx?)/i,
      ],
      es: [
        /encontr(?:ar|a)\s+(?:el\s+)?(?:archivo|documento)\s+(?:llamado|con\s+nombre)/i,
        /encontr(?:ar|a)\s+(?:dónde\s+)?(?:está?\s+)?[\w.-]+\.(?:pdf|docx?|xlsx?|pptx?)/i,
      ],
    },
    contentQuery: {
      en: [
        /find\s+(?:information|info|data|details)\s+(?:about|on|regarding)/i,
        /find\s+(?:out\s+)?(?:what|where|when|why|how)/i,
        /find\s+(?:the\s+)?(?:answer|solution|reason)/i,
        /find\s+(?:anything|something)\s+(?:about|related\s+to)/i,
      ],
      pt: [
        /encontr(?:ar|e)\s+(?:informações?|info|dados|detalhes)\s+(?:sobre|de)/i,
        /descobr(?:ir|a)\s+(?:o\s+que|onde|quando|por\s+que|como)/i,
      ],
      es: [
        /encontr(?:ar|a)\s+(?:información|info|datos|detalles)\s+(?:sobre|de)/i,
        /descubr(?:ir|a)\s+(?:qué|dónde|cuándo|por\s+qué|cómo)/i,
      ],
    },
  },
  what: {
    // "What" disambiguation
    definition: {
      en: [/what\s+is\s+(?:a|an|the)\s+\w+\??$/i],
      pt: [/o\s+que\s+é\s+(?:um|uma|o|a)\s+\w+\??$/i],
      es: [/qué\s+es\s+(?:un|una|el|la)\s+\w+\??$/i],
    },
    contentAbout: {
      en: [
        /what\s+(?:is|are)\s+.+\s+about/i,
        /what\s+does\s+.+\s+(?:say|mention|contain|include)/i,
        /what\s+(?:information|info|data)\s+(?:is|are)\s+(?:in|about)/i,
      ],
      pt: [
        /o\s+que\s+(?:é|são)\s+.+\s+sobre/i,
        /o\s+que\s+.+\s+(?:diz|menciona|contém|inclui)/i,
      ],
      es: [
        /qué\s+(?:es|son)\s+.+\s+sobre/i,
        /qué\s+(?:dice|menciona|contiene|incluye)/i,
      ],
    },
    listing: {
      en: [
        /what\s+(?:files|documents|folders)\s+(?:do\s+I\s+have|are\s+there|exist)/i,
        /what(?:'s|\s+is)\s+(?:in|inside)\s+(?:the\s+)?(?:folder|directory)/i,
      ],
      pt: [
        /(?:quais?|que)\s+(?:arquivos|documentos|pastas)\s+(?:eu\s+tenho|existem|há)/i,
        /o\s+que\s+(?:tem|há)\s+(?:na|no)\s+(?:pasta|diretório)/i,
      ],
      es: [
        /(?:cuáles?|qué)\s+(?:archivos|documentos|carpetas)\s+(?:tengo|hay|existen)/i,
        /qué\s+(?:hay|tiene)\s+(?:en\s+)?(?:la\s+)?(?:carpeta|directorio)/i,
      ],
    },
    quantity: {
      en: [/what\s+(?:is\s+the\s+)?(?:total|amount|number|count|sum)/i],
      pt: [/qual\s+(?:é\s+)?(?:o\s+)?(?:total|quantidade|número|soma)/i],
      es: [/cuál\s+(?:es\s+)?(?:el\s+)?(?:total|cantidad|número|suma)/i],
    },
    explanation: {
      en: [/what\s+(?:causes?|leads?\s+to|results?\s+in|explains?)/i],
      pt: [/o\s+que\s+(?:causa|leva\s+a|resulta\s+em|explica)/i],
      es: [/qué\s+(?:causa|lleva\s+a|resulta\s+en|explica)/i],
    },
  },
  list: {
    // "List" disambiguation
    enumerate: {
      en: [
        /list\s+(?:all\s+)?(?:my\s+)?(?:files|documents|folders)/i,
        /list\s+(?:the\s+)?(?:contents|items)\s+(?:of|in)/i,
      ],
      pt: [
        /list(?:ar|e)\s+(?:todos?\s+)?(?:os\s+)?(?:meus?\s+)?(?:arquivos|documentos|pastas)/i,
        /list(?:ar|e)\s+(?:o\s+)?(?:conteúdo|itens)\s+(?:de|em)/i,
      ],
      es: [
        /list(?:ar|a)\s+(?:todos?\s+)?(?:mis?\s+)?(?:archivos|documentos|carpetas)/i,
        /list(?:ar|a)\s+(?:el\s+)?(?:contenido|ítems)\s+(?:de|en)/i,
      ],
    },
    showContent: {
      en: [
        /list\s+(?:the\s+)?(?:main|key|important)\s+(?:points|items|findings)/i,
        /list\s+(?:all\s+)?(?:the\s+)?(?:topics|themes|subjects)/i,
      ],
      pt: [
        /list(?:ar|e)\s+(?:os\s+)?(?:principais|importantes)\s+(?:pontos|itens|achados)/i,
        /list(?:ar|e)\s+(?:todos?\s+)?(?:os\s+)?(?:tópicos|temas|assuntos)/i,
      ],
      es: [
        /list(?:ar|a)\s+(?:los\s+)?(?:principales|importantes)\s+(?:puntos|ítems|hallazgos)/i,
        /list(?:ar|a)\s+(?:todos?\s+)?(?:los\s+)?(?:temas|asuntos|tópicos)/i,
      ],
    },
  },
  open: {
    // "Open" disambiguation
    navigate: {
      en: [
        /open\s+(?:the\s+)?(?:folder|directory)/i,
        /open\s+(?:and\s+)?(?:go\s+to|navigate\s+to)/i,
      ],
      pt: [
        /abr(?:ir|a)\s+(?:a\s+)?(?:pasta|diretório)/i,
        /abr(?:ir|a)\s+(?:e\s+)?(?:ir\s+para|navegar\s+para)/i,
      ],
      es: [
        /abr(?:ir|a|e)\s+(?:la\s+)?(?:carpeta|directorio)/i,
        /abr(?:ir|a|e)\s+(?:e\s+)?(?:ir\s+a|navegar\s+a)/i,
      ],
    },
    viewContent: {
      en: [
        /open\s+(?:the\s+)?(?:file|document)/i,
        /open\s+(?:and\s+)?(?:read|view|show)/i,
      ],
      pt: [
        /abr(?:ir|a)\s+(?:o\s+)?(?:arquivo|documento)/i,
        /abr(?:ir|a)\s+(?:e\s+)?(?:ler|ver|mostrar)/i,
      ],
      es: [
        /abr(?:ir|a|e)\s+(?:el\s+)?(?:archivo|documento)/i,
        /abr(?:ir|a|e)\s+(?:y\s+)?(?:leer|ver|mostrar)/i,
      ],
    },
  },
};

// ============================================================================
// MULTI-INTENT PATTERNS (Stage 6)
// ============================================================================

const MULTI_INTENT_CONNECTORS = {
  and: {
    en: [/\s+and\s+(?:also\s+)?/i, /\s*,\s*and\s+/i],
    pt: [/\s+e\s+(?:também\s+)?/i, /\s*,\s*e\s+/i],
    es: [/\s+y\s+(?:también\s+)?/i, /\s*,\s*y\s+/i],
  },
  then: {
    en: [/\s+then\s+/i, /\s+after\s+that\s+/i, /\s+afterwards?\s+/i],
    pt: [/\s+então\s+/i, /\s+depois\s+/i, /\s+em\s+seguida\s+/i],
    es: [/\s+entonces\s+/i, /\s+después\s+/i, /\s+luego\s+/i],
  },
  also: {
    en: [/\s+also\s+/i, /\s+additionally\s+/i, /\s+plus\s+/i],
    pt: [/\s+também\s+/i, /\s+além\s+disso\s+/i, /\s+mais\s+/i],
    es: [/\s+también\s+/i, /\s+además\s+/i, /\s+más\s+/i],
  },
  or: {
    en: [/\s+or\s+/i, /\s+otherwise\s+/i],
    pt: [/\s+ou\s+/i, /\s+senão\s+/i],
    es: [/\s+o\s+/i, /\s+sino\s+/i],
  },
};

// ============================================================================
// REFUSAL PATTERNS
// ============================================================================

const REFUSAL_PATTERNS = {
  en: [
    /\b(send|compose|write|draft)\s+(?:an?\s+)?(?:email|message|letter|text)/i,
    /\b(call|phone|dial|contact)\s+(?:someone|anyone)/i,
    /\b(book|reserve|schedule)\s+(?:a\s+)?(?:flight|hotel|meeting|appointment)/i,
    /\b(order|buy|purchase)\s+(?:something|anything)/i,
    /\b(hack|crack|break\s+into|access\s+illegally)/i,
    /\b(create|generate)\s+(?:fake|false|fraudulent)/i,
  ],
  pt: [
    /\b(enviar|envie|escrever|escreva|redigir|redija)\s+(?:um\s+)?(?:email|e-mail|mensagem|carta)/i,
    /\b(ligar|telefonar|contatar)\s+(?:para\s+)?(?:alguém)/i,
    /\b(reservar|agendar|marcar)\s+(?:um\s+)?(?:voo|hotel|reunião|consulta)/i,
    /\b(comprar|pedir|encomendar)\s+(?:algo|alguma\s+coisa)/i,
  ],
  es: [
    /\b(enviar|envía|escribir|escribe|redactar|redacta)\s+(?:un\s+)?(?:email|correo|mensaje|carta)/i,
    /\b(llamar|telefonear|contactar)\s+(?:a\s+)?(?:alguien)/i,
    /\b(reservar|agendar|programar)\s+(?:un\s+)?(?:vuelo|hotel|reunión|cita)/i,
    /\b(comprar|pedir|ordenar)\s+(?:algo)/i,
  ],
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class ContextAwareIntentDetectionService {
  /**
   * Main entry point - runs all 6 stages of intent detection
   */
  detectIntent(
    query: string,
    conversationHistory: ConversationMessage[] = []
  ): ContextAwareIntentResult {
    const startTime = Date.now();
    const language = this.detectLanguage(query);

    console.log(`🎯 [INTENT] Analyzing: "${query.substring(0, 50)}..." (${language})`);

    // Stage 1: Negation Detection
    const negationResult = this.detectNegation(query, language);

    // Stage 2: Completeness Validation
    const completenessResult = this.validateCompleteness(query, language);

    // Stage 3: Entity Extraction
    const entities = this.extractEntities(query);

    // Stage 4: Pronoun Resolution
    const pronounResult = this.resolvePronouns(query, conversationHistory, entities, language);

    // Stage 5: Primary Intent Detection
    const primaryIntent = this.detectPrimaryIntent(
      pronounResult.resolvedQuery,
      entities,
      language
    );

    // Stage 6: Multi-Intent Detection
    const multiIntent = this.detectMultiIntent(pronounResult.resolvedQuery, language);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(
      primaryIntent.confidence,
      completenessResult.isComplete,
      entities.length,
      pronounResult.resolvedPronouns.length > 0
    );

    const result: ContextAwareIntentResult = {
      // Stage 1
      hasNegation: negationResult.hasNegation,
      negationType: negationResult.negationType,
      negatedAction: negationResult.negatedAction,

      // Stage 2
      isComplete: completenessResult.isComplete,
      missingElements: completenessResult.missingElements,
      clarificationNeeded: completenessResult.clarificationNeeded,

      // Stage 3
      entities,

      // Stage 4
      resolvedPronouns: pronounResult.resolvedPronouns,
      resolvedQuery: pronounResult.resolvedQuery,

      // Stage 5
      primaryIntent,

      // Stage 6
      multiIntent,

      // Meta
      confidence,
      processingTimeMs: Date.now() - startTime,
      language,
      originalQuery: query,
    };

    console.log(`   ✅ Intent: ${primaryIntent.primary} (${(confidence * 100).toFixed(0)}%) in ${result.processingTimeMs}ms`);

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 1: NEGATION DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  private detectNegation(
    query: string,
    language: 'en' | 'pt' | 'es'
  ): { hasNegation: boolean; negationType?: 'prohibition' | 'reversal' | 'cessation'; negatedAction?: string } {
    for (const [type, patterns] of Object.entries(NEGATION_PATTERNS)) {
      const langPatterns = patterns[language] || patterns.en;
      for (const pattern of langPatterns) {
        const match = query.match(pattern);
        if (match) {
          return {
            hasNegation: true,
            negationType: type as 'prohibition' | 'reversal' | 'cessation',
            negatedAction: match[0],
          };
        }
      }
    }
    return { hasNegation: false };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 2: COMPLETENESS VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  private validateCompleteness(
    query: string,
    language: 'en' | 'pt' | 'es'
  ): { isComplete: boolean; missingElements?: string[]; clarificationNeeded?: string } {
    const trimmedQuery = query.trim();
    const words = trimmedQuery.split(/\s+/);

    // Check for single-word commands that need objects
    if (words.length === 1) {
      const missingObjectPatterns = INCOMPLETE_PATTERNS.missingObject[language] || INCOMPLETE_PATTERNS.missingObject.en;
      for (const item of missingObjectPatterns) {
        if (item.pattern.test(trimmedQuery)) {
          return {
            isComplete: false,
            missingElements: ['object'],
            clarificationNeeded: item.needs,
          };
        }
      }
    }

    // Check for vague queries
    const vaguePatterns = INCOMPLETE_PATTERNS.vague[language] || INCOMPLETE_PATTERNS.vague.en;
    for (const pattern of vaguePatterns) {
      if (pattern.test(trimmedQuery)) {
        return {
          isComplete: false,
          missingElements: ['specificity'],
          clarificationNeeded: 'Please be more specific about what you need.',
        };
      }
    }

    return { isComplete: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 3: ENTITY EXTRACTION
  // ══════════════════════════════════════════════════════════════════════════

  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(query)) !== null) {
          const value = match[1] || match[0];
          if (value && value.length > 1) {
            entities.push({
              type: type as ExtractedEntity['type'],
              value: value.trim(),
              confidence: 0.85,
              originalText: match[0],
            });
          }
        }
      }
    }

    // Deduplicate by value
    const seen = new Set<string>();
    return entities.filter((e) => {
      const key = `${e.type}:${e.value.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 4: PRONOUN RESOLUTION
  // ══════════════════════════════════════════════════════════════════════════

  private resolvePronouns(
    query: string,
    history: ConversationMessage[],
    entities: ExtractedEntity[],
    language: 'en' | 'pt' | 'es'
  ): { resolvedPronouns: ResolvedPronoun[]; resolvedQuery: string } {
    const resolved: ResolvedPronoun[] = [];
    let resolvedQuery = query;

    // Get recent context
    const recentHistory = history.slice(-4);
    const recentMentions = this.extractRecentMentions(recentHistory);

    const pronounPatterns = PRONOUN_PATTERNS[language] || PRONOUN_PATTERNS.en;

    // Check each pronoun type
    for (const [type, patterns] of Object.entries(pronounPatterns)) {
      for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match) {
          const pronoun = match[0];
          let resolvedTo: string | null = null;
          let source: 'previous_query' | 'assistant_response' | 'entity_mention' = 'previous_query';

          // Try to resolve from entities first
          if (type === 'document' && recentMentions.documents.length > 0) {
            resolvedTo = recentMentions.documents[0];
            source = 'entity_mention';
          } else if (type === 'folder' && recentMentions.folders.length > 0) {
            resolvedTo = recentMentions.folders[0];
            source = 'entity_mention';
          } else if (type === 'topic' && recentMentions.topics.length > 0) {
            resolvedTo = recentMentions.topics[0];
            source = 'entity_mention';
          }

          if (resolvedTo) {
            resolved.push({
              pronoun,
              resolvedTo,
              confidence: 0.8,
              source,
            });
            resolvedQuery = resolvedQuery.replace(pronoun, resolvedTo);
          }
        }
      }
    }

    return { resolvedPronouns: resolved, resolvedQuery };
  }

  private extractRecentMentions(history: ConversationMessage[]): {
    documents: string[];
    folders: string[];
    topics: string[];
  } {
    const documents: string[] = [];
    const folders: string[] = [];
    const topics: string[] = [];

    for (const msg of history) {
      const content = msg.content;

      // Extract document mentions
      const docMatches = content.match(/\b[\w-]+\.(?:pdf|docx?|xlsx?|pptx?)\b/gi);
      if (docMatches) documents.push(...docMatches);

      // Extract folder mentions
      const folderMatches = content.match(/(?:folder|pasta|carpeta)\s+["']([^"']+)["']/gi);
      if (folderMatches) {
        for (const m of folderMatches) {
          const name = m.match(/["']([^"']+)["']/)?.[1];
          if (name) folders.push(name);
        }
      }

      // Extract topic mentions (from "about X" patterns)
      const topicMatches = content.match(/(?:about|regarding|sobre|acerca\s+de)\s+([^?.!,]+)/gi);
      if (topicMatches) {
        for (const m of topicMatches) {
          const topic = m.replace(/^(?:about|regarding|sobre|acerca\s+de)\s+/i, '').trim();
          if (topic.length > 2) topics.push(topic);
        }
      }
    }

    return {
      documents: Array.from(new Set(documents)).slice(0, 3),
      folders: Array.from(new Set(folders)).slice(0, 3),
      topics: Array.from(new Set(topics)).slice(0, 3),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 5: PRIMARY INTENT DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  private detectPrimaryIntent(
    query: string,
    entities: ExtractedEntity[],
    language: 'en' | 'pt' | 'es'
  ): DetectedIntent {
    const lowerQuery = query.toLowerCase().trim();

    // Check for refusal patterns first
    if (this.isRefusalQuery(query, language)) {
      return {
        primary: 'refusal',
        confidence: 0.95,
        requiresDocuments: false,
        requiresDatabase: false,
        isRefusal: true,
        disambiguation: 'Action not supported',
      };
    }

    // Check greeting
    if (this.isGreeting(lowerQuery)) {
      return {
        primary: 'greeting',
        confidence: 0.99,
        requiresDocuments: false,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Check capability
    if (this.isCapabilityQuery(lowerQuery)) {
      return {
        primary: 'capability',
        confidence: 0.98,
        requiresDocuments: false,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Check file actions
    const fileAction = this.detectFileAction(query);
    if (fileAction) {
      return {
        primary: 'file_action',
        subIntent: fileAction,
        confidence: 0.95,
        requiresDocuments: false,
        requiresDatabase: true,
        isRefusal: false,
      };
    }

    // Disambiguate verbs
    const disambiguation = this.disambiguateVerb(query, language);
    if (disambiguation) {
      return disambiguation;
    }

    // Check metadata queries
    if (this.isMetadataQuery(lowerQuery)) {
      return {
        primary: 'metadata_query',
        confidence: 0.90,
        requiresDocuments: false,
        requiresDatabase: true,
        isRefusal: false,
      };
    }

    // Check comparison
    if (this.isComparisonQuery(lowerQuery)) {
      return {
        primary: 'comparison',
        confidence: 0.92,
        requiresDocuments: true,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Check synthesis (across documents)
    if (this.isSynthesisQuery(lowerQuery)) {
      return {
        primary: 'synthesis',
        confidence: 0.88,
        requiresDocuments: true,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Check calculation
    if (this.isCalculationQuery(lowerQuery)) {
      return {
        primary: 'calculation',
        confidence: 0.85,
        requiresDocuments: true,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Check explanation
    if (this.isExplanationQuery(lowerQuery)) {
      return {
        primary: 'explanation',
        confidence: 0.82,
        requiresDocuments: true,
        requiresDatabase: false,
        isRefusal: false,
      };
    }

    // Default to document content query
    return {
      primary: 'document_content',
      confidence: 0.70,
      requiresDocuments: true,
      requiresDatabase: false,
      isRefusal: false,
    };
  }

  private disambiguateVerb(query: string, language: 'en' | 'pt' | 'es'): DetectedIntent | null {
    // Check "show" disambiguation
    for (const [subIntent, langPatterns] of Object.entries(VERB_DISAMBIGUATION.show)) {
      const patterns = langPatterns[language] || langPatterns.en;
      if (patterns.some((p: RegExp) => p.test(query))) {
        if (subIntent === 'preview') {
          return {
            primary: 'document_preview',
            subIntent: 'preview',
            confidence: 0.90,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'show → preview',
          };
        }
        if (subIntent === 'listing') {
          return {
            primary: 'document_listing',
            subIntent: 'listing',
            confidence: 0.90,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'show → listing',
          };
        }
        if (subIntent === 'content') {
          return {
            primary: 'document_content',
            subIntent: 'content',
            confidence: 0.90,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'show → content query',
          };
        }
      }
    }

    // Check "find" disambiguation
    for (const [subIntent, langPatterns] of Object.entries(VERB_DISAMBIGUATION.find)) {
      const patterns = langPatterns[language] || langPatterns.en;
      if (patterns.some((p: RegExp) => p.test(query))) {
        if (subIntent === 'fileSearch') {
          return {
            primary: 'file_search',
            subIntent: 'file_search',
            confidence: 0.92,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'find → file search',
          };
        }
        if (subIntent === 'contentQuery') {
          return {
            primary: 'document_content',
            subIntent: 'content_query',
            confidence: 0.88,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'find → content query',
          };
        }
      }
    }

    // Check "what" disambiguation
    for (const [subIntent, langPatterns] of Object.entries(VERB_DISAMBIGUATION.what)) {
      const patterns = langPatterns[language] || langPatterns.en;
      if (patterns.some((p: RegExp) => p.test(query))) {
        if (subIntent === 'definition') {
          return {
            primary: 'explanation',
            subIntent: 'definition',
            confidence: 0.88,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'what → definition',
          };
        }
        if (subIntent === 'contentAbout') {
          return {
            primary: 'document_content',
            subIntent: 'content_about',
            confidence: 0.90,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'what → content about',
          };
        }
        if (subIntent === 'listing') {
          return {
            primary: 'metadata_query',
            subIntent: 'listing',
            confidence: 0.92,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'what → listing',
          };
        }
        if (subIntent === 'quantity') {
          return {
            primary: 'calculation',
            subIntent: 'quantity',
            confidence: 0.88,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'what → quantity',
          };
        }
        if (subIntent === 'explanation') {
          return {
            primary: 'explanation',
            subIntent: 'cause',
            confidence: 0.85,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'what → explanation',
          };
        }
      }
    }

    // Check "list" disambiguation
    for (const [subIntent, langPatterns] of Object.entries(VERB_DISAMBIGUATION.list)) {
      const patterns = langPatterns[language] || langPatterns.en;
      if (patterns.some((p: RegExp) => p.test(query))) {
        if (subIntent === 'enumerate') {
          return {
            primary: 'metadata_query',
            subIntent: 'enumerate',
            confidence: 0.92,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'list → enumerate files',
          };
        }
        if (subIntent === 'showContent') {
          return {
            primary: 'document_content',
            subIntent: 'list_points',
            confidence: 0.88,
            requiresDocuments: true,
            requiresDatabase: false,
            isRefusal: false,
            disambiguation: 'list → content points',
          };
        }
      }
    }

    // Check "open" disambiguation
    for (const [subIntent, langPatterns] of Object.entries(VERB_DISAMBIGUATION.open)) {
      const patterns = langPatterns[language] || langPatterns.en;
      if (patterns.some((p: RegExp) => p.test(query))) {
        if (subIntent === 'navigate') {
          return {
            primary: 'folder_navigation',
            subIntent: 'navigate',
            confidence: 0.92,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'open → navigate folder',
          };
        }
        if (subIntent === 'viewContent') {
          return {
            primary: 'document_preview',
            subIntent: 'view',
            confidence: 0.88,
            requiresDocuments: false,
            requiresDatabase: true,
            isRefusal: false,
            disambiguation: 'open → view content',
          };
        }
      }
    }

    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE 6: MULTI-INTENT DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  private detectMultiIntent(query: string, language: 'en' | 'pt' | 'es'): MultiIntentResult {
    // Default single intent
    const defaultResult: MultiIntentResult = {
      intents: [],
      connector: null,
      executionOrder: 'single',
    };

    // Check for connectors
    for (const [connectorType, langPatterns] of Object.entries(MULTI_INTENT_CONNECTORS)) {
      const patterns = langPatterns[language] || langPatterns.en;
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          const parts = query.split(pattern);
          if (parts.length >= 2) {
            return {
              intents: parts.map((part) => this.detectPrimaryIntent(part.trim(), [], language)),
              connector: connectorType as 'and' | 'then' | 'also' | 'or',
              executionOrder: connectorType === 'then' ? 'sequential' : 'parallel',
            };
          }
        }
      }
    }

    return defaultResult;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ══════════════════════════════════════════════════════════════════════════

  private detectLanguage(query: string): 'en' | 'pt' | 'es' {
    // Portuguese indicators
    const ptIndicators = /\b(oi|olá|tudo|bem|você|qual|quais|onde|quanto|como|porque|fazer|mostrar|documento|arquivo|pasta)\b/i;
    if (ptIndicators.test(query)) return 'pt';

    // Spanish indicators
    const esIndicators = /\b(hola|qué|cuál|cuáles|dónde|cuánto|cómo|porque|hacer|mostrar|documento|archivo|carpeta)\b/i;
    if (esIndicators.test(query)) return 'es';

    return 'en';
  }

  private isGreeting(query: string): boolean {
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening|day)|howdy)[\s!.?]*$/i,
      /^(oi|olá|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem)[\s!.?]*$/i,
      /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?)[\s!.?]*$/i,
    ];
    return greetingPatterns.some((p) => p.test(query));
  }

  private isCapabilityQuery(query: string): boolean {
    const capabilityPatterns = [
      /^what\s*(can|do)\s*(you|koda)\s*do[\s!.?]*$/i,
      /^(help|ajuda|ayuda)[\s!.?]*$/i,
      /^what\s*are\s*your\s*(capabilities|features)[\s!.?]*$/i,
      /^o\s*que\s*voc[eê]\s*pode\s*fazer[\s!.?]*$/i,
      /^qu[eé]\s*puedes?\s*hacer[\s!.?]*$/i,
    ];
    return capabilityPatterns.some((p) => p.test(query));
  }

  private isRefusalQuery(query: string, language: 'en' | 'pt' | 'es'): boolean {
    const patterns = REFUSAL_PATTERNS[language] || REFUSAL_PATTERNS.en;
    return patterns.some((p) => p.test(query));
  }

  private detectFileAction(query: string): string | null {
    const patterns = {
      create_folder: /(?:create|make|new|criar|hacer)\s+(?:a\s+)?(?:folder|pasta|carpeta)/i,
      move_file: /(?:move|mover)\s+.+\s+(?:to|para|a)\s+/i,
      rename: /(?:rename|renomear|renombrar)\s+/i,
      delete: /(?:delete|remove|apagar|excluir|eliminar)\s+(?:the\s+)?(?:file|folder|document)/i,
    };

    for (const [action, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) return action;
    }
    return null;
  }

  private isMetadataQuery(query: string): boolean {
    return /\b(where\s+is|how\s+many\s+(?:files|documents)|list\s+all\s+(?:files|documents|folders)|what\s+files\s+do\s+i\s+have)\b/i.test(query);
  }

  private isComparisonQuery(query: string): boolean {
    return /\b(compare|comparison|difference|vs\.?|versus|between.*and|contrast|comparar|diferença|diferencia)\b/i.test(query);
  }

  private isSynthesisQuery(query: string): boolean {
    return /\b(across\s+all|all\s+(?:my\s+)?documents|everything|synthesize|combine|todos?\s+(?:os\s+)?documentos)\b/i.test(query);
  }

  private isCalculationQuery(query: string): boolean {
    return /\b(total|sum|calculate|average|how\s+much|quanto|cuánto|soma|calcular)\b/i.test(query);
  }

  private isExplanationQuery(query: string): boolean {
    return /\b(why|explain|what\s+is|how\s+does|tell\s+me\s+about|por\s*que|explique|qué\s+es|cómo)\b/i.test(query);
  }

  private calculateOverallConfidence(
    intentConfidence: number,
    isComplete: boolean,
    entityCount: number,
    hasPronounResolution: boolean
  ): number {
    let confidence = intentConfidence;

    // Reduce confidence if incomplete
    if (!isComplete) {
      confidence *= 0.7;
    }

    // Boost if we extracted entities
    if (entityCount > 0) {
      confidence = Math.min(1, confidence + 0.05 * entityCount);
    }

    // Reduce slightly if we had to resolve pronouns (uncertainty)
    if (hasPronounResolution) {
      confidence *= 0.95;
    }

    return Math.round(confidence * 100) / 100;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Convert to simple intent format for backwards compatibility
   */
  toSimpleIntent(result: ContextAwareIntentResult): {
    type: string;
    needsDocuments: boolean;
    confidence: number;
    extractedValue?: string;
  } {
    const typeMap: Record<IntentCategory, string> = {
      greeting: 'greeting',
      capability: 'capability',
      document_content: 'general',
      document_preview: 'data',
      document_listing: 'metadata',
      file_search: 'metadata',
      file_action: 'file_action',
      folder_navigation: 'metadata',
      metadata_query: 'metadata',
      comparison: 'comparison',
      explanation: 'explanation',
      calculation: 'data',
      synthesis: 'comparison',
      refusal: 'general',
      general: 'general',
    };

    return {
      type: typeMap[result.primaryIntent.primary] || 'general',
      needsDocuments: result.primaryIntent.requiresDocuments,
      confidence: result.confidence,
      extractedValue: result.entities[0]?.value,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const contextAwareIntentDetection = new ContextAwareIntentDetectionService();
export default contextAwareIntentDetection;
