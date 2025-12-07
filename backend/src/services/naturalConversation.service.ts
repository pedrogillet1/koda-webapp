/**
 * Natural Conversation Service
 *
 * Handles capability questions, language queries, and general conversation
 * with natural, helpful responses following Manus principles:
 * - Always helpful, never refusing
 * - Never blame the user
 * - Always offer alternatives
 * - Explain limitations positively
 *
 * Examples handled:
 * - "Do you understand Portuguese?"
 * - "Can you speak Spanish?"
 * - "What languages do you support?"
 * - "What can you do?"
 * - "How do you work?"
 */

import geminiClient from './geminiClient.service';

export interface ConversationResult {
  isConversational: boolean;
  type: 'language' | 'capability' | 'greeting' | 'help' | 'general' | null;
  response: string | null;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION PATTERNS - Flexible matching (not exact)
// ═══════════════════════════════════════════════════════════════════════════

const CONVERSATION_PATTERNS = {
  // Language capability questions
  language: [
    // English
    /\b(?:do you|can you|are you able to)\s+(?:understand|speak|support|know|read|write)\s+(?:portuguese|spanish|english|french|german|italian)/i,
    /\b(?:understand|speak|support|know)\s+(?:portuguese|spanish|english|french|german|italian)/i,
    /what\s+languages?\s+(?:do you|can you|does koda)/i,
    /(?:which|what)\s+languages?\s+(?:are|is)\s+supported/i,
    /\b(?:fala|falar|entende|entender)\s+(?:português|portugues|espanhol|inglês|ingles)/i,
    // Portuguese
    /\b(?:você|voce|vc)\s+(?:fala|entende|sabe)\s+(?:português|portugues|espanhol|inglês)/i,
    /(?:quais?|que)\s+(?:idiomas?|línguas?)\s+(?:você|voce|vc|koda)/i,
    // Spanish
    /\b(?:hablas?|entiendes?|sabes?)\s+(?:portugués|español|inglés)/i,
    /(?:qué|cuáles?)\s+(?:idiomas?|lenguas?)\s+(?:hablas?|soportas?)/i,
  ],

  // General capability questions
  capability: [
    // English - flexible patterns
    /what\s+(?:can|could)\s+(?:you|koda)\s+(?:do|help|assist)/i,
    /what\s+(?:are|is)\s+(?:your|koda'?s?)\s+(?:capabilities?|features?|abilities?|functions?)/i,
    /how\s+(?:do|does|can)\s+(?:you|koda)\s+(?:work|help|assist|function)/i,
    /(?:can|could)\s+(?:you|koda)\s+(?:help|assist|do|analyze|summarize|explain)/i,
    /what\s+(?:do you|does koda)\s+(?:do|offer)/i,
    /(?:tell|show)\s+me\s+(?:about|what)\s+(?:your|koda'?s?)\s+(?:capabilities?|features?)/i,
    /(?:are you|is koda)\s+(?:able|capable)\s+(?:of|to)/i,
    // Portuguese
    /(?:o que|que)\s+(?:você|voce|vc|koda)\s+(?:pode|consegue|sabe)\s+fazer/i,
    /(?:quais?|que)\s+(?:são|sao)\s+(?:suas?|os|as)\s+(?:capacidades?|funcionalidades?|recursos?)/i,
    /como\s+(?:você|voce|vc|koda)\s+(?:funciona|trabalha|ajuda)/i,
    // Spanish
    /(?:qué|que)\s+(?:puedes?|puede|sabes?)\s+hacer/i,
    /(?:cuáles?|cuales)\s+son\s+(?:tus|sus)\s+(?:capacidades?|funcionalidades?)/i,
    /cómo\s+(?:funcionas?|trabajas?|ayudas?)/i,
  ],

  // Greeting patterns
  greeting: [
    /^(?:hi|hello|hey|oi|olá|ola|hola|good\s+(?:morning|afternoon|evening)|bom\s+dia|boa\s+(?:tarde|noite)|buenos?\s+(?:días|dias|tardes|noches))[\s!.?]*$/i,
    /^(?:hi|hello|hey|oi|olá|hola)\s+(?:there|koda)[\s!.?]*$/i,
  ],

  // Help requests
  help: [
    /\b(?:help|ajuda|ayuda)\b/i,
    /how\s+(?:do|can)\s+i\s+(?:use|start|begin)/i,
    /(?:getting|get)\s+started/i,
    /(?:como|cómo)\s+(?:usar|começar|empezar|inicio)/i,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE TEMPLATES - Natural, conversational responses
// ═══════════════════════════════════════════════════════════════════════════

const RESPONSE_TEMPLATES = {
  language: {
    en: `Yes, I understand multiple languages!

**Languages I support:**
- **English**: Full support
- **Portuguese**: Full support (including Brazilian Portuguese)
- **Spanish**: Full support

I can:
- Answer questions in your preferred language
- Analyze documents in any of these languages
- Detect your language automatically
- Switch languages mid-conversation

My primary focus is helping you work with your documents, but I'm happy to chat in any supported language.

How can I help you today?`,

    pt: `Sim, eu entendo vários idiomas!

**Idiomas que eu suporto:**
- **Português**: Suporte completo (incluindo português brasileiro)
- **Inglês**: Suporte completo
- **Espanhol**: Suporte completo

Eu posso:
- Responder perguntas no seu idioma preferido
- Analisar documentos em qualquer um desses idiomas
- Detectar seu idioma automaticamente
- Trocar de idioma durante a conversa

Meu foco principal é ajudá-lo a trabalhar com seus documentos, mas fico feliz em conversar em qualquer idioma suportado.

Como posso ajudá-lo hoje?`,

    es: `¡Sí, entiendo varios idiomas!

**Idiomas que soporto:**
- **Español**: Soporte completo
- **Portugués**: Soporte completo (incluyendo portugués brasileño)
- **Inglés**: Soporte completo

Puedo:
- Responder preguntas en tu idioma preferido
- Analizar documentos en cualquiera de estos idiomas
- Detectar tu idioma automáticamente
- Cambiar de idioma durante la conversación

Mi enfoque principal es ayudarte a trabajar con tus documentos, pero estoy feliz de conversar en cualquier idioma soportado.

¿Cómo puedo ayudarte hoy?`,
  },

  capability: {
    en: `I'm Koda, your intelligent document assistant!

**What I can do:**

### Document Analysis
- **Search**: Find information across all your documents
- **Summarize**: Get key points from any document
- **Compare**: Analyze differences between documents
- **Extract**: Pull specific data, tables, or sections

### Cross-Document Intelligence
- **Themes**: Identify common themes across documents
- **Topics**: List all topics covered in your library
- **Trends**: Analyze patterns over time

### Calculations & Data
- **Financial**: Calculate projections, IRR, NPV
- **Data Analysis**: Process tables and spreadsheets
- **Formulas**: Execute complex calculations

### Languages
- **English**, **Portuguese**, **Spanish** - full support

**My focus is your documents** - I analyze, search, and extract information from your uploaded files. I can also answer general questions to help you work more effectively.

What would you like to explore?`,

    pt: `Sou o Koda, seu assistente inteligente de documentos!

**O que eu posso fazer:**

### Análise de Documentos
- **Pesquisar**: Encontrar informações em todos os seus documentos
- **Resumir**: Obter pontos-chave de qualquer documento
- **Comparar**: Analisar diferenças entre documentos
- **Extrair**: Puxar dados específicos, tabelas ou seções

### Inteligência Cross-Document
- **Temas**: Identificar temas comuns entre documentos
- **Tópicos**: Listar todos os tópicos cobertos em sua biblioteca
- **Tendências**: Analisar padrões ao longo do tempo

### Cálculos e Dados
- **Financeiro**: Calcular projeções, TIR, VPL
- **Análise de Dados**: Processar tabelas e planilhas
- **Fórmulas**: Executar cálculos complexos

### Idiomas
- **Português**, **Inglês**, **Espanhol** - suporte completo

**Meu foco são seus documentos** - eu analiso, pesquiso e extraio informações dos seus arquivos carregados. Também posso responder perguntas gerais para ajudá-lo a trabalhar de forma mais eficaz.

O que você gostaria de explorar?`,

    es: `¡Soy Koda, tu asistente inteligente de documentos!

**Lo que puedo hacer:**

### Análisis de Documentos
- **Buscar**: Encontrar información en todos tus documentos
- **Resumir**: Obtener puntos clave de cualquier documento
- **Comparar**: Analizar diferencias entre documentos
- **Extraer**: Obtener datos específicos, tablas o secciones

### Inteligencia Cross-Document
- **Temas**: Identificar temas comunes entre documentos
- **Tópicos**: Listar todos los temas cubiertos en tu biblioteca
- **Tendencias**: Analizar patrones a lo largo del tiempo

### Cálculos y Datos
- **Financiero**: Calcular proyecciones, TIR, VPN
- **Análisis de Datos**: Procesar tablas y hojas de cálculo
- **Fórmulas**: Ejecutar cálculos complejos

### Idiomas
- **Español**, **Portugués**, **Inglés** - soporte completo

**Mi enfoque son tus documentos** - analizo, busco y extraigo información de tus archivos cargados. También puedo responder preguntas generales para ayudarte a trabajar de manera más efectiva.

¿Qué te gustaría explorar?`,
  },

  greeting: {
    en: `Hello! I'm Koda, your document assistant.

I can help you:
- Search and analyze your documents
- Answer questions about your files
- Extract information and insights
- Perform calculations

What would you like to know?`,

    pt: `Olá! Sou o Koda, seu assistente de documentos.

Posso ajudá-lo a:
- Pesquisar e analisar seus documentos
- Responder perguntas sobre seus arquivos
- Extrair informações e insights
- Realizar cálculos

O que você gostaria de saber?`,

    es: `¡Hola! Soy Koda, tu asistente de documentos.

Puedo ayudarte a:
- Buscar y analizar tus documentos
- Responder preguntas sobre tus archivos
- Extraer información e insights
- Realizar cálculos

¿Qué te gustaría saber?`,
  },

  help: {
    en: `I'm here to help! Here's how to get started:

**Quick Commands:**
- Ask any question about your documents
- "Summarize [document name]"
- "What documents do I have?"
- "Find information about [topic]"

**Tips:**
- Upload documents (PDF, Word, Excel, images)
- Ask specific questions for best results
- I can analyze across all your documents

What would you like to try first?`,

    pt: `Estou aqui para ajudar! Veja como começar:

**Comandos Rápidos:**
- Faça qualquer pergunta sobre seus documentos
- "Resumir [nome do documento]"
- "Quais documentos eu tenho?"
- "Encontrar informações sobre [tópico]"

**Dicas:**
- Carregue documentos (PDF, Word, Excel, imagens)
- Faça perguntas específicas para melhores resultados
- Posso analisar todos os seus documentos

O que você gostaria de experimentar primeiro?`,

    es: `¡Estoy aquí para ayudar! Así es como empezar:

**Comandos Rápidos:**
- Haz cualquier pregunta sobre tus documentos
- "Resumir [nombre del documento]"
- "¿Qué documentos tengo?"
- "Encontrar información sobre [tema]"

**Consejos:**
- Sube documentos (PDF, Word, Excel, imágenes)
- Haz preguntas específicas para mejores resultados
- Puedo analizar todos tus documentos

¿Qué te gustaría probar primero?`,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DETECTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if query is a conversational/capability question
 */
export function detectConversationalQuery(query: string): ConversationResult {
  const lowerQuery = query.toLowerCase().trim();

  // Check each pattern type
  for (const [type, patterns] of Object.entries(CONVERSATION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        console.log(`✅ [CONVERSATION] Matched ${type} pattern`);
        return {
          isConversational: true,
          type: type as any,
          response: null, // Will be filled by generateResponse
          confidence: 0.9,
        };
      }
    }
  }

  return {
    isConversational: false,
    type: null,
    response: null,
    confidence: 0,
  };
}

/**
 * Detect language from query
 */
export function detectLanguage(query: string): 'en' | 'pt' | 'es' {
  const lowerQuery = query.toLowerCase();

  // Portuguese indicators
  if (/\b(você|voce|vc|qual|quais|como|onde|quando|porque|por que|fala|entende|português|portugues|documento|documentos|ajuda|obrigado|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(lowerQuery)) {
    return 'pt';
  }

  // Spanish indicators
  if (/\b(usted|tú|tu|cuál|cuáles|cómo|dónde|cuándo|porque|por qué|habla|entiende|español|documento|documentos|ayuda|gracias|hola|buenos días|buenas tardes|buenas noches)\b/i.test(lowerQuery)) {
    return 'es';
  }

  return 'en';
}

/**
 * Generate response for conversational query
 */
export function generateConversationalResponse(
  query: string,
  type: 'language' | 'capability' | 'greeting' | 'help' | 'general',
  language?: 'en' | 'pt' | 'es'
): string {
  const lang = language || detectLanguage(query);
  const templates = RESPONSE_TEMPLATES[type as keyof typeof RESPONSE_TEMPLATES];

  if (templates && templates[lang]) {
    return templates[lang];
  }

  // Fallback to English
  if (templates && templates.en) {
    return templates.en;
  }

  // Ultimate fallback
  return RESPONSE_TEMPLATES.capability.en;
}

/**
 * Handle conversational query - main entry point
 */
export async function handleConversationalQuery(
  query: string,
  options?: { language?: 'en' | 'pt' | 'es' }
): Promise<ConversationResult> {
  const detection = detectConversationalQuery(query);

  if (!detection.isConversational) {
    return detection;
  }

  const language = options?.language || detectLanguage(query);
  const response = generateConversationalResponse(query, detection.type!, language);

  return {
    ...detection,
    response,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  detectConversationalQuery,
  detectLanguage,
  generateConversationalResponse,
  handleConversationalQuery,
};

export const naturalConversationService = {
  detectConversationalQuery,
  detectLanguage,
  generateConversationalResponse,
  handleConversationalQuery,
};
