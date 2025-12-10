/**
 * Chat Service - Complete Implementation
 *
 * This service handles all chat-related operations including:
 * - Conversation management (create, read, delete)
 * - Message sending (regular and streaming)
 * - AI response generation with Gemini
 * - Conversation title generation
 */
import * as crypto from 'crypto';

import prisma from '../config/database';
import { sendMessageToGemini, sendMessageToGeminiStreaming, generateConversationTitle } from './openai.service';
// A+ RAG: Using new modular RAG orchestrator via adapter
import ragService from './rag.service';
import cacheService from './cache.service';
import { getIO } from './websocket.service';
// DEPRECATED: Replaced by KodaMemoryEngine
// import * as memoryService from './memory.service';
import { memoryService } from './deletedServiceStubs';
import { detectLanguage } from './languageDetection.service';
import { profileService } from './profile.service';
import historyService from './history.service';
import { conversationContextService } from './deletedServiceStubs';

// ============================================================================
// MEMORY ENGINE 3.0 - Document Reference Resolution
// ============================================================================
import { documentListStateManager } from './documentListStateManager.service';
import { referenceResolutionService } from './referenceResolution.service';
// DEPRECATED: memoryInjection moved to _deprecated - using stub
import { memoryInjectionService } from './deletedServiceStubs';

// ============================================================================
// MODE-BASED RAG OPTIMIZATION
// ============================================================================
import {
  type RAGMode,
  type RAGModeConfig,
  classifyQueryMode,
  getModeConfig,
  logModeClassification,
} from './ragModes.service';

import {
  getSystemPromptForMode,
} from './systemPromptTemplates.service';

import geminiClient from './geminiClient.service';
import { handleDeepFinancialAnalysis } from './rag.service';
import OpenAI from 'openai';
import { config } from '../config/env';
import { analyticsTrackingService } from './analyticsEngine.service';
import {
  formatFileListingResponse,
  generateFolderListingResponse,
  generateShowMeResponse,
  createInlineDocumentMarker,
  detectQueryType,
  type InlineDocument,
  type InlineFolder
} from '../utils/inlineDocumentInjector';
// Note: Format enforcement is handled by rag.service.ts - no need to import here

// OpenAI client for streaming title generation
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});
import kodaMemoryEngine from './kodaMemoryEngine.service';
// ============================================================================
// ULTRA-FAST PATH: No LLM for greetings & file navigation
// ============================================================================
import { classifyFastPathIntent, type FastPathClassification } from './kodaFastPathIntent.service';

// ============================================================================
// GREETING TEMPLATES (NO LLM CALL - instant response)
// ============================================================================
const GREETING_TEMPLATES = {
  en: [
    "Hello! How can I help you today? 👋",
    "Hi there! What would you like to know? 👋",
    "Hey! I'm ready to assist you. What do you need? 👋",
  ],
  pt: [
    "Olá! Como posso ajudá-lo hoje? 👋",
    "Oi! O que você gostaria de saber? 👋",
    "E aí! Estou pronto para ajudar. O que precisa? 👋",
  ],
  es: [
    "¡Hola! ¿Cómo puedo ayudarte hoy? 👋",
    "¡Hola! ¿Qué te gustaría saber? 👋",
    "¡Hey! Estoy listo para ayudarte. ¿Qué necesitas? 👋",
  ],
};

function getGreetingResponse(language: 'en' | 'pt' | 'es'): string {
  const templates = GREETING_TEMPLATES[language] || GREETING_TEMPLATES.en;
  return templates[Math.floor(Math.random() * templates.length)];
}

// ============================================================================
// APP HELP TEMPLATES (NO LLM CALL - instant response)
// ============================================================================
const APP_HELP_TEMPLATES = {
  en: {
    general: `**What I can help you with:**

📄 **Document Management**
• Upload, organize, and search your documents
• Ask "list my files" or "show my PDFs"
• Create folders: "create folder Reports"

🔍 **Document Q&A**
• Ask questions about your uploaded documents
• "What does my contract say about..."
• "Summarize the main points of..."

📊 **Calculations**
• Basic math: "calculate 15% of 250"
• Financial: "What's my total revenue?"

💬 **Conversation**
• I remember our previous discussions
• "What did we talk about?"

Type your question or try one of these commands!`,

    upload: `**How to upload documents:**

1. Click the **📎 attachment** button in the chat
2. Select your file(s) from your device
3. Supported formats: PDF, Word, Excel, PowerPoint, images, text files

**Tips:**
• You can upload multiple files at once
• Files are processed automatically for search
• Say "create folder X" to organize your uploads`,

    search: `**How to search your documents:**

• **List all files:** "show my documents" or "list my files"
• **Filter by type:** "show my PDFs" or "list all Excel files"
• **Search content:** Just ask! "What does my contract say about payment terms?"

**Pro tips:**
• Be specific in your questions
• Mention the document name if you know it
• I can search across all your documents at once`,
  },
  pt: {
    general: `**Como posso ajudar:**

📄 **Gestão de Documentos**
• Enviar, organizar e buscar seus documentos
• Pergunte "listar meus arquivos" ou "mostrar meus PDFs"
• Criar pastas: "criar pasta Relatórios"

🔍 **Perguntas sobre Documentos**
• Faça perguntas sobre seus documentos
• "O que meu contrato diz sobre..."
• "Resuma os pontos principais de..."

📊 **Cálculos**
• Matemática básica: "calcule 15% de 250"
• Financeiro: "Qual minha receita total?"

💬 **Conversa**
• Lembro nossas discussões anteriores
• "Sobre o que conversamos?"

Digite sua pergunta ou experimente um desses comandos!`,

    upload: `**Como enviar documentos:**

1. Clique no botão **📎 anexo** no chat
2. Selecione seu(s) arquivo(s) do dispositivo
3. Formatos suportados: PDF, Word, Excel, PowerPoint, imagens, texto

**Dicas:**
• Você pode enviar vários arquivos de uma vez
• Arquivos são processados automaticamente
• Diga "criar pasta X" para organizar seus uploads`,

    search: `**Como buscar seus documentos:**

• **Listar todos:** "mostrar meus documentos" ou "listar arquivos"
• **Filtrar por tipo:** "mostrar meus PDFs" ou "listar planilhas"
• **Buscar conteúdo:** Apenas pergunte! "O que meu contrato diz sobre pagamento?"

**Dicas:**
• Seja específico nas perguntas
• Mencione o nome do documento se souber
• Posso buscar em todos os documentos de uma vez`,
  },
  es: {
    general: `**Cómo puedo ayudarte:**

📄 **Gestión de Documentos**
• Subir, organizar y buscar tus documentos
• Pregunta "listar mis archivos" o "mostrar mis PDFs"
• Crear carpetas: "crear carpeta Informes"

🔍 **Preguntas sobre Documentos**
• Haz preguntas sobre tus documentos
• "¿Qué dice mi contrato sobre..."
• "Resume los puntos principales de..."

📊 **Cálculos**
• Matemáticas básicas: "calcula 15% de 250"
• Financiero: "¿Cuál es mi ingreso total?"

💬 **Conversación**
• Recuerdo nuestras discusiones anteriores
• "¿De qué hablamos?"

¡Escribe tu pregunta o prueba uno de estos comandos!`,

    upload: `**Cómo subir documentos:**

1. Haz clic en el botón **📎 adjuntar** en el chat
2. Selecciona tu(s) archivo(s) del dispositivo
3. Formatos soportados: PDF, Word, Excel, PowerPoint, imágenes, texto

**Consejos:**
• Puedes subir varios archivos a la vez
• Los archivos se procesan automáticamente
• Di "crear carpeta X" para organizar`,

    search: `**Cómo buscar tus documentos:**

• **Listar todos:** "mostrar mis documentos" o "listar archivos"
• **Filtrar por tipo:** "mostrar mis PDFs" o "listar hojas de cálculo"
• **Buscar contenido:** ¡Solo pregunta! "¿Qué dice mi contrato sobre pagos?"

**Consejos:**
• Sé específico en tus preguntas
• Menciona el nombre del documento si lo sabes
• Puedo buscar en todos tus documentos a la vez`,
  },
};

function getAppHelpResponse(language: 'en' | 'pt' | 'es', query: string): string {
  const templates = APP_HELP_TEMPLATES[language] || APP_HELP_TEMPLATES.en;
  const lowerQuery = query.toLowerCase();

  // Detect specific help topic
  if (lowerQuery.includes('upload') || lowerQuery.includes('enviar') || lowerQuery.includes('subir')) {
    return templates.upload;
  }
  if (lowerQuery.includes('search') || lowerQuery.includes('find') || lowerQuery.includes('buscar') || lowerQuery.includes('procurar')) {
    return templates.search;
  }

  // Default to general help
  return templates.general;
}

// ============================================================================
// CALCULATION HELPER (NO LLM CALL - pure JavaScript math)
// ============================================================================
function computeCalculation(query: string, language: 'en' | 'pt' | 'es'): string {
  try {
    // Normalize the query
    let expression = query.toLowerCase()
      // Remove common prefixes
      .replace(/^(calculate|compute|calcul[ae]|cuanto\s+es|quanto\s+e|what\s+is|how\s+much\s+is)\s*/i, '')
      // Replace word operators with symbols
      .replace(/\s*(plus|mais|mas)\s*/gi, '+')
      .replace(/\s*(minus|menos)\s*/gi, '-')
      .replace(/\s*(times|vezes|por(?!\s*cento))\s*/gi, '*')
      .replace(/\s*(divided\s+by|dividido\s+(por|entre))\s*/gi, '/')
      .replace(/\s*(multiplied\s+by|multiplicado\s+por)\s*/gi, '*')
      // Replace x and × with *
      .replace(/\s*[x×]\s*/gi, '*')
      .replace(/\s*÷\s*/gi, '/')
      // Remove trailing = or ?
      .replace(/[=?]\s*$/, '')
      .trim();

    // Handle percentage: "X percent of Y" or "X% of Y"
    const percentMatch = expression.match(/(\d+\.?\d*)\s*(%|percent|por\s*cento)\s*(of|de)\s*(\d+\.?\d*)/i);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      const value = parseFloat(percentMatch[4]);
      const result = (percent / 100) * value;
      return formatCalculationResult(result, `${percent}% of ${value}`, language);
    }

    // Handle squared/cubed
    const powerMatch = expression.match(/(\d+\.?\d*)\s*(squared|ao\s+quadrado|al\s+cuadrado)/i);
    if (powerMatch) {
      const base = parseFloat(powerMatch[1]);
      const result = Math.pow(base, 2);
      return formatCalculationResult(result, `${base}²`, language);
    }

    const cubedMatch = expression.match(/(\d+\.?\d*)\s*(cubed|ao\s+cubo|al\s+cubo)/i);
    if (cubedMatch) {
      const base = parseFloat(cubedMatch[1]);
      const result = Math.pow(base, 3);
      return formatCalculationResult(result, `${base}³`, language);
    }

    // Handle square root
    const sqrtMatch = expression.match(/(sqrt|square\s+root|raiz\s+quadrada|raiz\s+cuadrada)\s*(of|de)?\s*(\d+\.?\d*)/i);
    if (sqrtMatch) {
      const value = parseFloat(sqrtMatch[3]);
      const result = Math.sqrt(value);
      return formatCalculationResult(result, `√${value}`, language);
    }

    // ============================================================================
    // FINANCIAL CALCULATIONS (NO LLM - pure JavaScript)
    // ============================================================================

    // Growth rate: "growth from X to Y" or "crescimento de X para Y"
    const growthMatch = expression.match(/(?:growth|crescimento|crecimiento)\s*(?:from|de)\s*(\d+\.?\d*)\s*(?:to|para|a)\s*(\d+\.?\d*)/i);
    if (growthMatch) {
      const initial = parseFloat(growthMatch[1]);
      const final = parseFloat(growthMatch[2]);
      if (initial !== 0) {
        const growthRate = ((final - initial) / initial) * 100;
        const label = language === 'pt' ? 'Taxa de crescimento' : language === 'es' ? 'Tasa de crecimiento' : 'Growth rate';
        return `**${label}:** ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(2)}%`;
      }
    }

    // Margin: "margin of X on Y" or "margem de X sobre Y"
    const marginMatch = expression.match(/(?:margin|margem|margen)\s*(?:of|de)\s*(\d+\.?\d*)\s*(?:on|sobre|en)\s*(\d+\.?\d*)/i);
    if (marginMatch) {
      const profit = parseFloat(marginMatch[1]);
      const revenue = parseFloat(marginMatch[2]);
      if (revenue !== 0) {
        const margin = (profit / revenue) * 100;
        const label = language === 'pt' ? 'Margem' : language === 'es' ? 'Margen' : 'Margin';
        return `**${label}:** ${margin.toFixed(2)}%`;
      }
    }

    // ROI: "roi of X on Y" or "roi de X sobre Y" or "return on investment X Y"
    const roiMatch = expression.match(/(?:roi|return\s+on\s+investment|retorno)\s*(?:of|de)?\s*(\d+\.?\d*)\s*(?:on|sobre|en|with|com|con)?\s*(?:investment\s+(?:of\s+)?)?(\d+\.?\d*)/i);
    if (roiMatch) {
      const profit = parseFloat(roiMatch[1]);
      const investment = parseFloat(roiMatch[2]);
      if (investment !== 0) {
        const roi = (profit / investment) * 100;
        return `**ROI:** ${roi.toFixed(2)}%`;
      }
    }

    // MOIC (Multiple on Invested Capital): "moic X / Y" or "moic of X on Y"
    const moicMatch = expression.match(/(?:moic|multiple)\s*(?:of|de)?\s*(\d+\.?\d*)\s*(?:\/|on|sobre|en)?\s*(\d+\.?\d*)/i);
    if (moicMatch) {
      const returnValue = parseFloat(moicMatch[1]);
      const investment = parseFloat(moicMatch[2]);
      if (investment !== 0) {
        const moic = returnValue / investment;
        return `**MOIC:** ${moic.toFixed(2)}x`;
      }
    }

    // Payback: "payback X / Y" or "payback period X investment Y"
    const paybackMatch = expression.match(/(?:payback|retorno)\s*(?:period|periodo)?\s*(?:of|de)?\s*(\d+\.?\d*)\s*(?:\/|with|com|con|investment|investimento)?\s*(\d+\.?\d*)/i);
    if (paybackMatch) {
      const annualReturn = parseFloat(paybackMatch[2]);
      const investment = parseFloat(paybackMatch[1]);
      if (annualReturn !== 0) {
        const payback = investment / annualReturn;
        const label = language === 'pt' ? 'Período de payback' : language === 'es' ? 'Período de recuperación' : 'Payback period';
        if (payback < 1) {
          const months = Math.round(payback * 12);
          const unit = language === 'pt' ? (months === 1 ? 'mês' : 'meses') : language === 'es' ? (months === 1 ? 'mes' : 'meses') : (months === 1 ? 'month' : 'months');
          return `**${label}:** ${months} ${unit}`;
        }
        const unit = language === 'pt' ? (payback === 1 ? 'ano' : 'anos') : language === 'es' ? (payback === 1 ? 'año' : 'años') : (payback === 1 ? 'year' : 'years');
        return `**${label}:** ${payback.toFixed(2)} ${unit}`;
      }
    }

    // Compound interest: "compound X at Y% for Z years"
    const compoundMatch = expression.match(/(?:compound|juros\s+compostos?|interés\s+compuesto)\s*(\d+\.?\d*)\s*(?:at|a)\s*(\d+\.?\d*)%?\s*(?:for|por|durante)\s*(\d+)\s*(?:years?|anos?|años?)/i);
    if (compoundMatch) {
      const principal = parseFloat(compoundMatch[1]);
      const rate = parseFloat(compoundMatch[2]) / 100;
      const years = parseInt(compoundMatch[3]);
      const futureValue = principal * Math.pow(1 + rate, years);
      const label = language === 'pt' ? 'Valor futuro' : language === 'es' ? 'Valor futuro' : 'Future value';
      return formatCalculationResult(futureValue, `${label} (${years} ${language === 'pt' || language === 'es' ? 'anos' : 'years'} @ ${compoundMatch[2]}%)`, language);
    }

    // Basic arithmetic - use Function for safe evaluation
    // Only allow numbers and basic operators
    const safeExpression = expression.replace(/[^\d+\-*/.()%\s]/g, '');
    if (safeExpression && /^[\d+\-*/.()%\s]+$/.test(safeExpression)) {
      // Use Function constructor for evaluation (safer than eval)
      const result = new Function(`return ${safeExpression}`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return formatCalculationResult(result, safeExpression, language);
      }
    }

    // Fallback - couldn't compute
    const errorMsg = language === 'pt' ? 'Não consegui calcular essa expressão. Tente algo como "5 + 3" ou "15% de 200".'
                   : language === 'es' ? 'No pude calcular esa expresión. Intenta algo como "5 + 3" o "15% de 200".'
                   : 'I couldn\'t calculate that expression. Try something like "5 + 3" or "15% of 200".';
    return errorMsg;

  } catch (error) {
    console.error('❌ [CALCULATION] Error:', error);
    const errorMsg = language === 'pt' ? 'Erro ao calcular. Tente uma expressão mais simples.'
                   : language === 'es' ? 'Error al calcular. Intenta una expresión más simple.'
                   : 'Error calculating. Try a simpler expression.';
    return errorMsg;
  }
}

function formatCalculationResult(result: number, expression: string, language: 'en' | 'pt' | 'es'): string {
  // Format the number nicely
  const formatted = Number.isInteger(result)
    ? result.toLocaleString(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US')
    : result.toLocaleString(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
      });

  return `**${expression}** = **${formatted}**`;
}

// ============================================================================
// MEMORY RESPONSE FORMATTER (for conversation recall)
// ============================================================================
function formatMemoryResponse(memory: any, language: 'en' | 'pt' | 'es'): string {
  if (!memory || !memory.recentMessages || memory.recentMessages.length === 0) {
    const noMemory = language === 'pt' ? 'Esta é uma conversa nova. Ainda não discutimos nada.'
                   : language === 'es' ? 'Esta es una conversación nueva. Aún no hemos discutido nada.'
                   : 'This is a new conversation. We haven\'t discussed anything yet.';
    return noMemory;
  }

  const header = language === 'pt' ? '**O que discutimos até agora:**\n\n'
               : language === 'es' ? '**Lo que hemos discutido:**\n\n'
               : '**What we\'ve discussed:**\n\n';

  // Get recent topics from messages
  const userMessages = memory.recentMessages
    .filter((m: any) => m.role === 'user')
    .slice(-5)
    .map((m: any) => m.content.substring(0, 100));

  if (userMessages.length === 0) {
    const noTopics = language === 'pt' ? 'Você ainda não fez nenhuma pergunta nesta conversa.'
                   : language === 'es' ? 'Aún no has hecho ninguna pregunta en esta conversación.'
                   : 'You haven\'t asked any questions in this conversation yet.';
    return noTopics;
  }

  let response = header;
  userMessages.forEach((msg: string, idx: number) => {
    const truncated = msg.length > 80 ? msg.substring(0, 80) + '...' : msg;
    response += `${idx + 1}. "${truncated}"\n`;
  });

  // Add summary if available
  if (memory.rollingSummary) {
    const summaryLabel = language === 'pt' ? '\n**Resumo da conversa:**\n'
                       : language === 'es' ? '\n**Resumen de la conversación:**\n'
                       : '\n**Conversation summary:**\n';
    response += summaryLabel + memory.rollingSummary;
  }

  return response;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CreateConversationParams {
  userId: string;
  title?: string;
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION
  titleEncrypted?: string;
  encryptionSalt?: string;
  encryptionIV?: string;
  encryptionAuthTag?: string;
  isEncrypted?: boolean;
}

interface SendMessageParams {
  userId: string;
  conversationId: string;
  content: string;
  attachedDocumentId?: string;
  answerLength?: string;
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION
  contentEncrypted?: string;
  encryptionSalt?: string;
  encryptionIV?: string;
  encryptionAuthTag?: string;
  isEncrypted?: boolean;
}

interface MessageResult {
  userMessage: any;
  assistantMessage: any;
  /** Document list for navigation answers (name→ID mapping for frontend) */
  documentList?: Array<{
    id: string;
    filename: string;
    mimeType: string | null;
    fileSize: number | null;
    folderPath: {
      pathString: string;
      folderId: string | null;
      folderName: string | null;
    };
  }>;
  /** Total count for "See all X" link */
  totalCount?: number;
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Create a new conversation
 */
export const createConversation = async (params: CreateConversationParams) => {
  const {
    userId,
    title = 'New Chat',
    titleEncrypted,
    encryptionSalt,
    encryptionIV,
    encryptionAuthTag,
    isEncrypted = false
  } = params;

  console.log('💬 Creating new conversation for user:', userId);
  if (isEncrypted) {
    console.log('🔐 Zero-knowledge encryption enabled for conversation');
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store encrypted title metadata
      titleEncrypted: titleEncrypted || null,
      encryptionSalt: encryptionSalt || null,
      encryptionIV: encryptionIV || null,
      encryptionAuthTag: encryptionAuthTag || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  console.log('✅ Conversation created:', conversation.id);

  // ⚡ FIX #1: Invalidate conversations list cache after creating new conversation
  // This ensures the new conversation appears in the sidebar immediately
  // The key matches the format in getUserConversations: `conversations:${userId}`
  await cacheService.del(`conversations:${userId}`);
  console.log(`🗑️  [Cache] Invalidated conversations list for user ${userId.substring(0, 8)}...`);

  return conversation;
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId: string) => {
  console.log('📋 Fetching conversations for user:', userId);

  // ⚡ CACHE: Generate cache key
  const cacheKey = `conversations:${userId}`;

  // ⚡ CACHE: Check cache first
  const cached = await cacheService.get<any[]>(cacheKey);
  if (cached) {
    console.log(`✅ [Cache] HIT for conversations list (user: ${userId.substring(0, 8)}...)`);
    return cached;
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  // ✅ FIX: Filter out conversations with no messages
  const conversationsWithMessages = conversations.filter(conv => conv._count.messages > 0);

  console.log(`✅ Found ${conversations.length} conversations (${conversationsWithMessages.length} with messages, ${conversations.length - conversationsWithMessages.length} empty)`);

  // ⚡ CACHE: Store filtered result with 30 minute TTL
  await cacheService.set(cacheKey, conversationsWithMessages, { ttl: 1800 });
  console.log(`💾 [Cache] Stored conversations list (user: ${userId.substring(0, 8)}...)`);

  return conversationsWithMessages;
};

/**
 * Get a single conversation with all messages
 */
export const getConversation = async (conversationId: string, userId: string) => {
  console.log('📖 Fetching conversation:', conversationId);

  // ⚡ CACHE: Generate cache key
  const cacheKey = `conversation:${conversationId}:${userId}`;

  // ⚡ CACHE: Check cache first
  const cached = await cacheService.get<any>(cacheKey);
  if (cached) {
    console.log(`✅ [Cache] HIT for conversation ${conversationId.substring(0, 8)}...`);
    return cached;
  }

  // ⚡ OPTIMIZED: Load only recent messages for instant display
  // Older messages can be loaded on-demand (lazy loading)
  const INITIAL_MESSAGE_LIMIT = 100; // Load last 100 messages for instant display

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      titleEncrypted: true,
      encryptionSalt: true,
      encryptionIV: true,
      encryptionAuthTag: true,
      contextType: true,
      contextId: true,
      contextName: true,
      contextMeta: true,
      // ✅ OPTIMIZATION: Load only last N messages (DESC order, then reverse)
      messages: {
        orderBy: { createdAt: 'desc' },
        take: INITIAL_MESSAGE_LIMIT,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          conversationId: true,
          metadata: true,
          isDocument: true,
          documentTitle: true,
          documentFormat: true,
          markdownContent: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // ✅ Reverse messages to get chronological order (oldest to newest)
  conversation.messages = conversation.messages.reverse();

  // ⚡ CACHE: Store result with 30 minute TTL
  await cacheService.set(cacheKey, conversation, { ttl: 1800 });
  console.log(`💾 [Cache] Stored conversation ${conversationId.substring(0, 8)}...`);


  console.log(`✅ Conversation found with ${conversation.messages.length} messages`);
  return conversation;
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string, userId: string) => {
  console.log('🗑️ Deleting conversation:', conversationId);

  // Verify ownership
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    console.log('⚠️ Conversation not found, already deleted or access denied');
    return; // Silently return instead of throwing error
  }

  // Delete all messages first (cascade should handle this, but being explicit)
  await prisma.message.deleteMany({
    where: { conversationId },
  });

  // Delete conversation
  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  console.log('✅ Conversation deleted successfully');
};

/**
 * Delete all conversations for a user
 */
export const deleteAllConversations = async (userId: string) => {
  console.log('🗑️ Deleting all conversations for user:', userId);

  // Get all conversation IDs
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: { id: true },
  });

  const conversationIds = conversations.map((c) => c.id);

  // Delete all messages
  await prisma.message.deleteMany({
    where: { conversationId: { in: conversationIds } },
  });

  // Delete all conversations
  const result = await prisma.conversation.deleteMany({
    where: { userId },
  });

  console.log(`✅ Deleted ${result.count} conversations`);
  return result;
};

// ============================================================================
// MESSAGE SENDING (REGULAR)
// ============================================================================

/**
 * Send a message and get AI response (non-streaming)
 */
export const sendMessage = async (params: SendMessageParams): Promise<MessageResult> => {
  const {
    userId,
    conversationId,
    content,
    attachedDocumentId,
    contentEncrypted,
    encryptionSalt,
    encryptionIV,
    encryptionAuthTag,
    isEncrypted = false
  } = params;

  console.log('💬 Sending message in conversation:', conversationId);
  if (isEncrypted) {
    console.log('🔐 Zero-knowledge encryption enabled for message');
  }

  // ==========================================================================
  // ULTRA-FAST PATH: Check for greetings/navigation FIRST (NO LLM CALL!)
  // Target: <200ms response time for greetings
  // ==========================================================================
  const fastPathStart = Date.now();
  const fastPathResult = classifyFastPathIntent(content);
  console.log(`⚡ [FAST-PATH] Classification: ${fastPathResult.intent} (${fastPathResult.confidence}) [${fastPathResult.processingTimeMs}ms]`);

  // GREETING: Return template response instantly (NO LLM!)
  if (fastPathResult.intent === 'GREETING' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] Greeting detected - returning template (NO LLM)`);

    const greetingResponse = getGreetingResponse(fastPathResult.language);
    const now = new Date();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    // FIRE-AND-FORGET: Write to DB asynchronously - don't wait!
    // This makes the response instant (<50ms) instead of waiting for DB (~1500ms)
    prisma.$transaction([
      prisma.conversation.findFirstOrThrow({
        where: { id: conversationId, userId },
        select: { id: true }
      }),
      prisma.message.create({
        data: { id: userMsgId, conversationId, role: 'user', content, createdAt: now },
      }),
      prisma.message.create({
        data: { id: assistantMsgId, conversationId, role: 'assistant', content: greetingResponse, createdAt: now },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      }),
    ]).catch(err => console.error('❌ [ULTRA-FAST] DB write error:', err));

    console.log(`✅ [ULTRA-FAST] Greeting response in ${Date.now() - fastPathStart}ms (DB write async)`);

    // Return immediately with placeholder message objects
    return {
      userMessage: { id: userMsgId, conversationId, role: 'user', content, createdAt: now } as any,
      assistantMessage: { id: assistantMsgId, conversationId, role: 'assistant', content: greetingResponse, createdAt: now } as any,
    };
  }

  // ==========================================================================
  // FILE_COUNT: Return database count instantly (NO LLM!)
  // ==========================================================================
  if (fastPathResult.intent === 'FILE_COUNT' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] File count query - returning DB count (NO LLM)`);

    // Quick conversation check
    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    const docCount = await prisma.document.count({
      where: { userId, status: { not: 'deleted' } }
    });

    const countResponse = fastPathResult.language === 'pt'
      ? `Você tem **${docCount} documentos** no total.`
      : fastPathResult.language === 'es'
      ? `Tienes **${docCount} documentos** en total.`
      : `You have **${docCount} documents** in total.`;

    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: { conversationId, role: 'user', content, createdAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId, role: 'assistant', content: countResponse, createdAt: new Date() },
      }),
    ]);

    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating timestamp:', err));

    console.log(`✅ [ULTRA-FAST] File count response sent in ${Date.now() - fastPathStart}ms`);
    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // APP_HELP: Return template help response (NO LLM - instant!)
  // Target: <500ms (was 10.3s)
  // ==========================================================================
  if (fastPathResult.intent === 'APP_HELP' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] App help query - returning template (NO LLM)`);

    const helpResponse = getAppHelpResponse(fastPathResult.language, content);
    const now = new Date();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    // FIRE-AND-FORGET: Write to DB asynchronously
    prisma.$transaction([
      prisma.conversation.findFirstOrThrow({
        where: { id: conversationId, userId },
        select: { id: true }
      }),
      prisma.message.create({
        data: { id: userMsgId, conversationId, role: 'user', content, createdAt: now },
      }),
      prisma.message.create({
        data: { id: assistantMsgId, conversationId, role: 'assistant', content: helpResponse, createdAt: now },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      }),
    ]).catch(err => console.error('❌ [ULTRA-FAST] DB write error:', err));

    console.log(`✅ [ULTRA-FAST] App help response in ${Date.now() - fastPathStart}ms (DB write async)`);

    return {
      userMessage: { id: userMsgId, conversationId, role: 'user', content, createdAt: now } as any,
      assistantMessage: { id: assistantMsgId, conversationId, role: 'assistant', content: helpResponse, createdAt: now } as any,
    };
  }

  // ==========================================================================
  // CALCULATION: Pure math - compute directly (NO LLM!)
  // Target: <100ms (was 10.7s)
  // ==========================================================================
  if (fastPathResult.intent === 'CALCULATION' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] Calculation query - computing directly (NO LLM)`);

    const calcResponse = computeCalculation(content, fastPathResult.language);
    const now = new Date();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    // FIRE-AND-FORGET: Write to DB asynchronously
    prisma.$transaction([
      prisma.conversation.findFirstOrThrow({
        where: { id: conversationId, userId },
        select: { id: true }
      }),
      prisma.message.create({
        data: { id: userMsgId, conversationId, role: 'user', content, createdAt: now },
      }),
      prisma.message.create({
        data: { id: assistantMsgId, conversationId, role: 'assistant', content: calcResponse, createdAt: now },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      }),
    ]).catch(err => console.error('❌ [ULTRA-FAST] DB write error:', err));

    console.log(`✅ [ULTRA-FAST] Calculation response in ${Date.now() - fastPathStart}ms (DB write async)`);

    return {
      userMessage: { id: userMsgId, conversationId, role: 'user', content, createdAt: now } as any,
      assistantMessage: { id: assistantMsgId, conversationId, role: 'assistant', content: calcResponse, createdAt: now } as any,
    };
  }

  // ==========================================================================
  // MEMORY_CHECK: Fast conversation memory lookup (minimal LLM or template)
  // Target: <1.5s (was 7.4s)
  // ==========================================================================
  if (fastPathResult.intent === 'MEMORY_CHECK' && fastPathResult.isFastPath) {
    console.log(`🚀 [FAST-PATH] Memory check - using conversation memory`);

    // Get conversation memory from KodaMemoryEngine
    const kodaMemory = await kodaMemoryEngine.getConversationMemory(conversationId, userId);
    const memoryResponse = formatMemoryResponse(kodaMemory, fastPathResult.language);

    const now = new Date();
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    // FIRE-AND-FORGET: Write to DB asynchronously
    prisma.$transaction([
      prisma.conversation.findFirstOrThrow({
        where: { id: conversationId, userId },
        select: { id: true }
      }),
      prisma.message.create({
        data: { id: userMsgId, conversationId, role: 'user', content, createdAt: now },
      }),
      prisma.message.create({
        data: { id: assistantMsgId, conversationId, role: 'assistant', content: memoryResponse, createdAt: now },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      }),
    ]).catch(err => console.error('❌ [FAST-PATH] DB write error:', err));

    console.log(`✅ [FAST-PATH] Memory check response in ${Date.now() - fastPathStart}ms (DB write async)`);

    return {
      userMessage: { id: userMsgId, conversationId, role: 'user', content, createdAt: now } as any,
      assistantMessage: { id: assistantMsgId, conversationId, role: 'assistant', content: memoryResponse, createdAt: now } as any,
    };
  }

  // ==========================================================================
  // NORMAL FLOW: Continue with full processing
  // ==========================================================================

  // Verify conversation ownership
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Create user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store encrypted content metadata
      isEncrypted: isEncrypted || false,
      // Note: contentEncrypted field not in schema - using metadata instead
      metadata: contentEncrypted ? JSON.stringify({ contentEncrypted, encryptionSalt, encryptionIV, encryptionAuthTag }) : null,
      createdAt: new Date(),
    },
  });

  console.log('✅ User message saved:', userMessage.id);

  // Track user message (non-blocking)
  analyticsTrackingService.incrementConversationMessages(conversationId, 'user')
    .catch(err => console.error('📊 Failed to increment user messages:', err));

  // =========================================================================
  // MEMORY ENGINE 3.0: Check for file actions FIRST (before RAG)
  // =========================================================================
  const fileActionResult = await handleFileActionsIfNeeded(
    userId,
    content,
    conversationId,
    undefined // attachedFiles
  );

  if (fileActionResult && fileActionResult.action !== 'resolved_reference') {
    // This was a file action (list_files, create_folder, etc.) - return directly
    console.log('✅ File action completed:', fileActionResult.action);

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: fileActionResult.message,
        createdAt: new Date(),
      },
    });

    return { userMessage, assistantMessage };
  }

  // If resolved reference, enhance the content for RAG
  let enhancedContent = content;
  if (fileActionResult?.action === 'resolved_reference' && fileActionResult.message.startsWith('__RESOLVED_DOC_ID__:')) {
    const parts = fileActionResult.message.split(':');
    const resolvedDocId = parts[1];
    const resolvedDocName = parts.slice(2).join(':');
    enhancedContent = `[User is referring to document "${resolvedDocName}"] ${content}`;
    console.log(`🧠 [Memory3.0] Enhanced content for RAG: "${enhancedContent.substring(0, 100)}..."`);

    // Update last document reference
    await documentListStateManager.setLastDocument(conversationId, resolvedDocId);
  }

  // ✅ NEW: Fetch conversation history using helper function
  const conversationHistory = await getConversationHistory(conversationId);

  // ✅ FIX: Use RAG service instead of calling Gemini directly
  console.log('🤖 Generating RAG response...');
  const validAnswerLength = ['short', 'medium', 'summary', 'long'].includes(params.answerLength || '')
    ? (params.answerLength as 'short' | 'medium' | 'summary' | 'long')
    : 'medium';
  const ragResult = await ragService.generateAnswer(
    userId,
    enhancedContent, // Use enhanced content if document reference was resolved
    conversationId,
    validAnswerLength,
    attachedDocumentId
  );

  // ✅ FORMAT ENFORCEMENT: Already handled by rag.service.ts generateAnswerStream()
  // Do NOT apply format enforcement here - it causes response duplication!
  // The rag.service.ts applies structure + format enforcement before returning.
  const fullResponse = ragResult.answer || 'Sorry, I could not generate a response.';

  console.log(`✅ [CHAT SERVICE] Using pre-formatted response from RAG service (${fullResponse.length} chars)`);

  // Create assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date(),
    },
  });

  console.log('✅ Assistant message saved:', assistantMessage.id);

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // ✅ UPDATED: Auto-generate title after FIRST user message (animated title)
  // Note: In non-streaming, conversationHistory is fetched AFTER the user message is saved, so count is 1 for first message
  const userMessageCount = conversationHistory.filter(m => m.role === 'user').length;
  if (userMessageCount === 1) {  // First user message - generate animated title
    console.log('🏷️ [TITLE] Triggering animated title generation for first message');
    await autoGenerateTitle(conversationId, userId, content, fullResponse);
  }

  // 🧠 Update conversation context after each turn (for multi-turn context retention)
  const contextSources = ragResult.sources?.map(s => ({
    documentId: s.documentId || '',
    documentName: s.documentName || ''
  })) || [];
  conversationContextService.updateContextAfterTurn(
    conversationId,
    content,
    fullResponse,
    contextSources
  ).catch(err => console.error('❌ Error updating conversation context:', err));

  // ⚡ CACHE: Invalidate conversation cache after new message
  await cacheService.invalidateConversationCache(userId, conversationId);
  console.log(`🗑️  [Cache] Invalidated conversation cache for ${conversationId.substring(0, 8)}...`);

  // ⚡ FIX #2: Also invalidate the conversations list cache (correct key format)
  await cacheService.del(`conversations:${userId}`);

  return {
    userMessage,
    assistantMessage,
    // Include documentList from RAG result (for navigation answers with clickable docs)
    documentList: ragResult.documentList,
    totalCount: ragResult.totalCount,
  };
};

// ============================================================================
// MESSAGE SENDING (STREAMING)
// ============================================================================

/**
 * Send a message with streaming AI response
 *
 * @param params - Message parameters
 * @param onChunk - Callback for each content chunk
 */
export const sendMessageStreaming = async (
  params: SendMessageParams,
  onChunk: (chunk: string) => void
): Promise<MessageResult> => {
  const { userId, conversationId, content, attachedDocumentId } = params;

  console.log('💬 Sending streaming message in conversation:', conversationId);

  // ==========================================================================
  // ULTRA-FAST PATH: Check for greetings/navigation FIRST (NO LLM CALL!)
  // Target: <200ms response time for greetings
  // ==========================================================================
  const fastPathStart = Date.now();
  const fastPathResult = classifyFastPathIntent(content);
  console.log(`⚡ [FAST-PATH] Classification: ${fastPathResult.intent} (${fastPathResult.confidence}) [${fastPathResult.processingTimeMs}ms]`);

  // GREETING: Return template response instantly (NO LLM!)
  if (fastPathResult.intent === 'GREETING' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] Greeting detected - returning template (NO LLM)`);

    // Quick conversation check (lightweight - just verify it exists)
    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    const greetingResponse = getGreetingResponse(fastPathResult.language);
    onChunk(greetingResponse);

    // Create messages in parallel (don't block response)
    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content,
          createdAt: new Date(),
        },
      }),
      prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: greetingResponse,
          createdAt: new Date(),
        },
      }),
    ]);

    // Update conversation timestamp (fire-and-forget)
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

    console.log(`✅ [ULTRA-FAST] Greeting response sent in ${Date.now() - fastPathStart}ms`);

    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // FILE_COUNT: Return database count instantly (NO LLM!)
  // ==========================================================================
  if (fastPathResult.intent === 'FILE_COUNT' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] File count query - returning DB count (NO LLM)`);

    // Quick conversation check
    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    const docCount = await prisma.document.count({
      where: { userId, status: { not: 'deleted' } }
    });

    const countResponse = fastPathResult.language === 'pt'
      ? `Você tem **${docCount} documentos** no total.`
      : fastPathResult.language === 'es'
      ? `Tienes **${docCount} documentos** en total.`
      : `You have **${docCount} documents** in total.`;

    onChunk(countResponse);

    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: { conversationId, role: 'user', content, createdAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId, role: 'assistant', content: countResponse, createdAt: new Date() },
      }),
    ]);

    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating timestamp:', err));

    console.log(`✅ [ULTRA-FAST] File count response sent in ${Date.now() - fastPathStart}ms`);
    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // APP_HELP: Return template help response (NO LLM - instant!)
  // Target: <500ms (was 10.3s)
  // ==========================================================================
  if (fastPathResult.intent === 'APP_HELP' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] App help query - returning template (NO LLM)`);

    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    const helpResponse = getAppHelpResponse(fastPathResult.language, content);
    onChunk(helpResponse);

    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: { conversationId, role: 'user', content, createdAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId, role: 'assistant', content: helpResponse, createdAt: new Date() },
      }),
    ]);

    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating timestamp:', err));

    console.log(`✅ [ULTRA-FAST] App help response sent in ${Date.now() - fastPathStart}ms`);
    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // CALCULATION: Pure math - compute directly (NO LLM!)
  // Target: <100ms (was 10.7s)
  // ==========================================================================
  if (fastPathResult.intent === 'CALCULATION' && fastPathResult.isFastPath) {
    console.log(`🚀 [ULTRA-FAST] Calculation query - computing directly (NO LLM)`);

    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    const calcResponse = computeCalculation(content, fastPathResult.language);
    onChunk(calcResponse);

    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: { conversationId, role: 'user', content, createdAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId, role: 'assistant', content: calcResponse, createdAt: new Date() },
      }),
    ]);

    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating timestamp:', err));

    console.log(`✅ [ULTRA-FAST] Calculation response sent in ${Date.now() - fastPathStart}ms`);
    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // MEMORY_CHECK: Fast conversation memory lookup (NO heavy LLM!)
  // Target: <1.5s (was 7.4s)
  // ==========================================================================
  if (fastPathResult.intent === 'MEMORY_CHECK' && fastPathResult.isFastPath) {
    console.log(`🚀 [FAST-PATH] Memory check - using conversation memory`);

    const conversationExists = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
    if (!conversationExists) {
      throw new Error('Conversation not found or access denied');
    }

    // Get conversation memory from KodaMemoryEngine
    const kodaMemory = await kodaMemoryEngine.getConversationMemory(conversationId, userId);
    const memoryResponse = formatMemoryResponse(kodaMemory, fastPathResult.language);
    onChunk(memoryResponse);

    const [userMessage, assistantMessage] = await Promise.all([
      prisma.message.create({
        data: { conversationId, role: 'user', content, createdAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId, role: 'assistant', content: memoryResponse, createdAt: new Date() },
      }),
    ]);

    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating timestamp:', err));

    console.log(`✅ [FAST-PATH] Memory check response sent in ${Date.now() - fastPathStart}ms`);
    return { userMessage, assistantMessage };
  }

  // ==========================================================================
  // NORMAL FLOW: Continue with full RAG pipeline
  // ==========================================================================

  // ⚡ PERFORMANCE: Start DB writes async - don't block streaming
  // Only await conversation check and history (needed for processing)
  const [conversation, conversationHistory] = await Promise.all([
    // Verify conversation ownership
    prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    }),

    // ✅ NEW: Fetch conversation history using helper function
    getConversationHistory(conversationId)
  ]);

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // ⚡ PERFORMANCE: Create user message async (don't wait - saves 400-600ms)
  const userMessagePromise = prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      createdAt: new Date(),
    },
  });

  console.log('⚡ User message creation started (async)');

  // Track user message (non-blocking)
  analyticsTrackingService.incrementConversationMessages(conversationId, 'user')
    .catch(err => console.error('📊 Failed to increment user messages:', err));

  // ✅ FIX #2: Check for file actions FIRST (before RAG)
  const fileActionResult = await handleFileActionsIfNeeded(
    userId,
    content,
    conversationId,
    undefined // attachedFiles not yet implemented in frontend
  );

  if (fileActionResult) {
    // =========================================================================
    // MEMORY ENGINE 3.0: Handle resolved document references
    // =========================================================================
    if (fileActionResult.action === 'resolved_reference' && fileActionResult.message.startsWith('__RESOLVED_DOC_ID__:')) {
      // Parse the resolved document info
      const parts = fileActionResult.message.split(':');
      const resolvedDocId = parts[1];
      const resolvedDocName = parts.slice(2).join(':'); // Handle colons in filenames

      console.log(`🧠 [Memory3.0] Processing resolved reference: "${resolvedDocName}" (${resolvedDocId})`);

      // Update the content to include the explicit document reference for RAG
      // This ensures the RAG system knows exactly which document to use
      const enhancedContent = `[User is referring to document "${resolvedDocName}"] ${content}`;

      // Update last document reference
      await documentListStateManager.setLastDocument(conversationId, resolvedDocId);

      // Continue to RAG processing with the enhanced content
      // The RAG system will now have explicit document context
      // We'll fall through to the normal RAG flow below
      console.log(`🧠 [Memory3.0] Passing to RAG with enhanced content: "${enhancedContent.substring(0, 100)}..."`);

      // DON'T return here - fall through to RAG processing
      // We'll use the enhanced content for the RAG query
      console.log(`🧠 [Memory3.0] Will use enhanced content for RAG query`);

      // Store enhanced content in global for use after this block
      (globalThis as any).__memory3_enhancedContent = enhancedContent;
      (globalThis as any).__memory3_resolvedDocId = resolvedDocId;
      // Fall through to RAG with enhanced content...
    } else {
      // This was a normal file action - send result and return
      const actionMessage = fileActionResult.message;
      const fullResponse = actionMessage;
      onChunk(actionMessage);

      console.log('✅ File action completed:', fileActionResult.action);

      // ⚡ PERFORMANCE: Create assistant message async (don't block)
      const assistantMessagePromise = prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: fullResponse,
          createdAt: new Date(),
        },
      });

      // ⚡ PERFORMANCE: Update conversation timestamp async (fire-and-forget)
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

      // Wait for critical promises before returning
      const [userMessage, assistantMessage] = await Promise.all([
        userMessagePromise,
        assistantMessagePromise
      ]);

      return {
        userMessage,
        assistantMessage,
      };
    }
  }

  // =========================================================================
  // MEMORY ENGINE 3.0: Apply enhanced content from resolved reference
  // =========================================================================
  let effectiveContent = content;
  let resolvedDocumentId: string | null = null;

  if ((globalThis as any).__memory3_enhancedContent) {
    effectiveContent = (globalThis as any).__memory3_enhancedContent;
    resolvedDocumentId = (globalThis as any).__memory3_resolvedDocId || null;
    console.log(`🧠 [Memory3.0] Using enhanced content: "${effectiveContent.substring(0, 80)}..."`);

    // Clean up global variables
    delete (globalThis as any).__memory3_enhancedContent;
    delete (globalThis as any).__memory3_resolvedDocId;
  }

  // Not a file action - continue with normal RAG
  // Generate AI response with streaming using HYBRID RAG service
  console.log('🤖 Generating streaming RAG response...');
  let fullResponse = '';

  // ✅ NEW: Build memory context for personalized responses
  console.log('🧠 Building memory context...');
  // TODO: Implement buildMemoryContext in memory.service
  // ✅ MEMORY ENGINE: Get full conversation memory (50 messages + rolling summary)
  const kodaMemory = await kodaMemoryEngine.getConversationMemory(conversationId, userId);
  const memoryContext = kodaMemory.formattedContext;
  console.log();

  // ✅ NEW: Build full conversation history for comprehensive context
  console.log('📚 Building conversation context...');
  const fullConversationContext = await buildConversationContext(conversationId, userId);

  // ✅ LANGUAGE DETECTION: Detect user's language for proper response
  console.log('🌍 Detecting query language...');
  const detectedLanguage = detectLanguage(effectiveContent);
  console.log(`🌍 Detected language: ${detectedLanguage}`);

  // ✅ USER PROFILE: Load user profile for personalized responses
  console.log('👤 Loading user profile for personalization...');
  const userProfile = await profileService.getProfile(userId);
  const profilePrompt = profileService.buildProfileSystemPrompt(userProfile);

  if (userProfile) {
    console.log(`✅ Profile loaded - Writing Style: ${(userProfile as any).writingStyle}, Tone: ${(userProfile as any).preferredTone}`);
  } else {
    console.log('ℹ️ No user profile found - using default settings');
  }

  // ============================================================================
  // MODE CLASSIFICATION & CACHE CHECK
  // ============================================================================

  // Step 1: Classify query mode (<10ms)
  const modeClassification = classifyQueryMode(effectiveContent, conversationHistory);
  const mode: RAGMode = modeClassification.mode;
  const modeConfig: RAGModeConfig = getModeConfig(mode);

  logModeClassification(effectiveContent, modeClassification);
  console.log(`🎯 [MODE] ${mode} (target: ${modeConfig.targetLatency})`);

  // Step 2: Check cache BEFORE any processing
  const cachedResponse = await cacheService.getCachedQueryResponse(userId, content, mode);

  if (cachedResponse) {
    console.log(`✅ [CACHE HIT] Returning cached response (saved ~${modeConfig.targetLatency})`);

    // Stream cached response in chunks
    const chunkSize = 50;
    for (let i = 0; i < cachedResponse.answer.length; i += chunkSize) {
      const chunk = cachedResponse.answer.substring(i, i + chunkSize);
      fullResponse += chunk;
      onChunk(chunk);
      // Small delay to make streaming feel natural
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Create messages in database
    const [userMessage, assistantMessage] = await Promise.all([
      userMessagePromise,
      prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: cachedResponse.answer,
          createdAt: new Date(),
        },
      })
    ]);

    // Update conversation timestamp (fire-and-forget)
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

    return {
      userMessage,
      assistantMessage,
    };
  }

  console.log(`❌ [CACHE MISS] Processing query...`);

  // Step 3: Handle ULTRA_FAST_META mode (greetings/meta queries)
  if (mode === 'ULTRA_FAST_META') {
    console.log('🚀 [ULTRA_FAST_META] Fast path activated');

    // Check if it's a document count query
    const isDocCountQuery = effectiveContent.toLowerCase().includes('quantos documentos') ||
                           effectiveContent.toLowerCase().includes('how many documents') ||
                           effectiveContent.toLowerCase().includes('cuántos documentos');

    if (isDocCountQuery) {
      // Get document count from database
      const countResult = await prisma.document.count({
        where: { userId }
      });
      const docCount = countResult || 0;

      const response = detectedLanguage === 'pt'
        ? `Você tem **${docCount} documentos** no total.`
        : `You have **${docCount} documents** in total.`;

      fullResponse = response;
      onChunk(response);

      // Cache the response
      await cacheService.cacheQueryResponse(userId, content, mode, {
        answer: response,
        sources: []
      }, modeConfig.cacheTTL);

      // Create messages
      const [userMessage, assistantMessage] = await Promise.all([
        userMessagePromise,
        prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: response,
            createdAt: new Date(),
          },
        })
      ]);

      // Update conversation timestamp (fire-and-forget)
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

      return {
        userMessage,
        assistantMessage,
      };
    }

    // For greetings, use tiny Flash call
    const systemPrompt = getSystemPromptForMode(modeConfig.systemPromptType, {
      language: detectedLanguage || 'en',
      userProfile: profilePrompt,
    });

    try {
      const model = geminiClient.getModel({
        model: modeConfig.model,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: modeConfig.temperature,
          maxOutputTokens: modeConfig.maxOutputTokens,
        }
      });

      const streamResult = await model.generateContentStream(content);

      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        onChunk(chunkText);
      }

      // Cache the response
      await cacheService.cacheQueryResponse(userId, content, mode, {
        answer: fullResponse,
        sources: []
      }, modeConfig.cacheTTL);

      // Create messages
      const [userMessage, assistantMessage] = await Promise.all([
        userMessagePromise,
        prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: fullResponse,
            createdAt: new Date(),
          },
        })
      ]);

      // Update conversation timestamp (fire-and-forget)
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      console.error('❌ [ULTRA_FAST_META] Error:', error);
      // Fall through to normal RAG
    }
  }

  // ============================================================================
  // STEP 4: Handle DEEP_FINANCIAL_ANALYSIS mode (ROI/payback calculations)
  // ============================================================================
  if (mode === 'DEEP_FINANCIAL_ANALYSIS') {
    console.log('💰 [DEEP_FINANCIAL_ANALYSIS] Financial analysis mode activated');

    const financialStartTime = Date.now();

    try {
      const result = await handleDeepFinancialAnalysis(
        userId,
        content,
        conversationHistory,
        detectedLanguage,
        (chunk: string) => {
          fullResponse += chunk;
          onChunk(chunk);
        }
      );

      // Cache the financial analysis response
      await cacheService.cacheQueryResponse(
        userId,
        content,
        mode,
        {
          answer: result.answer,
          sources: result.sources
        },
        modeConfig.cacheTTL
      );

      console.log(`✅ [DEEP_FINANCIAL_ANALYSIS] Complete (${Date.now() - financialStartTime}ms)`);

      // Create messages
      const [userMessage, assistantMessage] = await Promise.all([
        userMessagePromise,
        prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: fullResponse,
            createdAt: new Date(),
          },
        })
      ]);

      // Update conversation timestamp (fire-and-forget)
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

      return {
        userMessage,
        assistantMessage,
      };

    } catch (error) {
      console.error('❌ [DEEP_FINANCIAL_ANALYSIS] Error:', error);
      // Fall through to normal RAG
    }
  }

  // ============================================================================
  // NORMAL RAG PROCESSING (for FAST_FACT_RAG, NORMAL_RAG, DEEP_ANALYSIS)
  // ============================================================================

  // Call hybrid RAG service with streaming
  let isDocumentGeneration = false;
  let documentType: 'summary' | 'report' | 'analysis' | 'general' = 'general';

  // Track RAG performance
  const ragStartTime = Date.now();
  let ragHadFallback = false;

  await ragService.generateAnswerStream(
    userId,
    effectiveContent,
    conversationId,
    (chunk: string) => {
      // Check the chunk content BEFORE adding to fullResponse or sending
      if (chunk.includes('__DOCUMENT_GENERATION_REQUESTED__:') || isDocumentGeneration) {
        if (!isDocumentGeneration) {
          // First time seeing marker - extract type
          isDocumentGeneration = true;
          const parts = chunk.split(':');
          if (parts[1]) {
            documentType = parts[1].trim() as 'summary' | 'report' | 'analysis' | 'general';
          }
          console.log(`📝 [CHAT] Intercepted document generation marker: ${documentType}`);
        }
        fullResponse += chunk;
        return; // Don't send marker or any subsequent chunks
      }

      // Normal chunk - add and send
      fullResponse += chunk;
      onChunk(chunk);
    },
    attachedDocumentId,
    conversationHistory,  // ✅ Pass conversation history for context
    undefined,            // onStage callback (not used here)
    memoryContext,        // ✅ NEW: Pass memory context
    fullConversationContext, // ✅ NEW: Pass full conversation history
    undefined,            // isFirstMessage (9th parameter)
    detectedLanguage,     // ✅ FIX: Pass detected language (10th parameter)
    profilePrompt         // ✅ USER PROFILE: Pass user profile prompt (11th parameter)
  );

  // Track RAG query metrics (non-blocking)
  const ragTotalLatency = Date.now() - ragStartTime;
  analyticsTrackingService.recordRAGQuery({
    userId,
    conversationId,
    query: content,
    queryLanguage: detectedLanguage,
    retrievalMethod: 'hybrid',
    usedBM25: true,
    usedPinecone: true,
    totalLatency: ragTotalLatency,
    hadFallback: ragHadFallback,
    responseGenerated: fullResponse.length > 0,
  }).catch(err => console.error('📊 Failed to track RAG query:', err));

  // Update conversation metrics (non-blocking)
  analyticsTrackingService.incrementConversationMessages(conversationId, 'assistant')
    .catch(err => console.error('📊 Failed to increment conversation messages:', err));

  // ════════════════════════════════════════════════════════════════════════════════
  // DOCUMENT GENERATION HANDLER
  // ════════════════════════════════════════════════════════════════════════════════
  // Check if RAG returned document generation marker
  if (isDocumentGeneration) {
    console.log(`📝 [CHAT] Triggering document generation: ${documentType}`);

    // DEPRECATED: chatDocumentGeneration moved to _deprecated - using stub
    const { generateDocument } = await import('./deletedServiceStubs');

    // Stream progress message
    const progressMessage = `\n\n📝 Generating your ${documentType}...\n\n`;
    onChunk(progressMessage);
    fullResponse = progressMessage;

    // Create temporary assistant message for attaching chatDocument
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: progressMessage,
        createdAt: new Date(),
      },
    });

    try {
      // ✅ FIX: Retrieve source content from RAG before generating document
      console.log('📚 [CHAT] Retrieving source content for document generation...');
      const ragResult = await ragService.generateAnswer(
        userId,
        content,
        conversationId,
        'long', // Use long answer for comprehensive content
        attachedDocumentId
      );

      // Extract source content and document IDs
      let sourceContent = '';
      let sourceDocumentIds: string[] = [];

      if (ragResult.sources && ragResult.sources.length > 0) {
        sourceContent = ragResult.sources
          .map(s => `Document: ${s.documentName || 'Unknown'}\n\n${s.content}`)
          .join('\n\n---\n\n');
        sourceDocumentIds = ragResult.sources
          .map(s => s.documentId)
          .filter((id): id is string => id !== undefined);

        console.log(`📚 [CHAT] Retrieved ${ragResult.sources.length} source documents for generation`);
      } else {
        console.log('⚠️  [CHAT] No source documents found - generating from query only');
      }

      // Generate document
      const docResult = await generateDocument({
        userId,
        conversationId,
        messageId: assistantMessage.id,
        query: content,
        documentType,
        sourceContent,
        sourceDocumentIds,
      });

      // Update message with final content and chatDocument
      await prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: docResult.message,
        },
      });

      fullResponse = docResult.message;

      // Stream final message
      onChunk('\n' + docResult.message);

      console.log(`✅ [CHAT] Document generated successfully: ${docResult.chatDocument.id}`);

      // Return early - document generation complete
      return {
        userMessage: await userMessagePromise,
        assistantMessage,
      };
    } catch (error) {
      console.error('❌ [CHAT] Document generation failed:', error);
      const errorMessage = '\n\n❌ Failed to generate document. Please try again.';
      await prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: progressMessage + errorMessage,
        },
      });
      onChunk(errorMessage);
      fullResponse = progressMessage + errorMessage;

      return {
        userMessage: await userMessagePromise,
        assistantMessage,
      };
    }
  }
  console.log(`✅ Streaming complete. Total response length: ${fullResponse.length} chars`);

  // Note: Hybrid RAG includes sources inline within the response
  // No need to append sources separately

  // ⚡ PERFORMANCE: Create assistant message async (don't block)
  const assistantMessagePromise = prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse, // Now includes sources
      createdAt: new Date(),
    },
  });

  // ⚡ PERFORMANCE: Update conversation timestamp async (fire-and-forget)
  prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

  // ⚡ PERFORMANCE: Auto-generate title async (fire-and-forget)
  // ✅ UPDATED: Auto-generate title after FIRST user message (animated title)
  // Note: conversationHistory is fetched BEFORE the user message is saved, so count is 0 for first message
  const userMessageCount = conversationHistory.filter(m => m.role === 'user').length;
  if (userMessageCount === 0) {  // First user message - generate animated title
    // Fire-and-forget title generation (don't block response)
    console.log('🏷️ [TITLE] Triggering animated title generation for first message');
    autoGenerateTitle(conversationId, userId, content, fullResponse)
      .catch(err => console.error('❌ Error generating title:', err));
  } else if (userMessageCount === 2) {
    // ✅ Chat History UX: Auto-title after 3rd message (using history service)
    console.log('🏷️ [HISTORY] Auto-titling conversation after 3rd message');
    historyService.autoTitleConversation(conversationId)
      .catch(err => console.error('❌ Error auto-titling conversation:', err));
  }

  // 🧠 Update conversation context after each turn (for multi-turn context retention)
  conversationContextService.updateContextAfterTurn(
    conversationId,
    content,
    fullResponse,
    []
  ).catch(err => console.error('❌ Error updating conversation context:', err));

  // ✅ NEW: Extract memory insights after sufficient conversation (fire-and-forget)
  // Extract memory after 5+ user messages to learn preferences and insights
  if (userMessageCount >= 5) {
    console.log(`🧠 Extracting memory insights (${userMessageCount} messages) - TODO: implement`);
    // TODO: Implement extractMemoryFromConversation in memory.service
  }

  // ✅ Chat History UX: Generate summary for long conversations (fire-and-forget)
  if (userMessageCount === 10) {
    console.log('📝 [HISTORY] Generating conversation summary');
    historyService.generateConversationSummary(conversationId)
      .catch(err => console.error('❌ Error generating summary:', err));
  }

  // ⚡ CACHE: Invalidate conversation cache after new message (fire-and-forget)
  cacheService.invalidateConversationCache(userId, conversationId)
    .then(() => console.log(`🗑️  [Cache] Invalidated conversation cache for ${conversationId.substring(0, 8)}...`))
    .catch(err => console.error('❌ Error invalidating cache:', err));

  // ⚡ FIX #2: Also invalidate the conversations list cache (correct key format)
  // This ensures updated conversations appear in sidebar immediately
  cacheService.del(`conversations:${userId}`)
    .catch(err => console.error('❌ Error invalidating conversations list:', err));

  // Wait for critical promises before returning
  const [userMessage, assistantMessage] = await Promise.all([
    userMessagePromise,
    assistantMessagePromise
  ]);

  // ============================================================================
  // CACHE RESPONSE FOR FUTURE QUERIES
  // ============================================================================
  // Cache the response with mode-specific TTL (fire-and-forget)
  cacheService.cacheQueryResponse(userId, content, mode, {
    answer: fullResponse,
    sources: [] // Sources are already inline in fullResponse
  }, modeConfig.cacheTTL)
    .then(() => console.log(`💾 [CACHE] Cached query response (mode: ${mode}, TTL: ${modeConfig.cacheTTL}s)`))
    .catch(err => console.error('❌ Error caching query response:', err));

  return {
    userMessage,
    assistantMessage,
  };
};

// ============================================================================
// CONVERSATION TITLE GENERATION
// ============================================================================

/**
 * Auto-generate conversation title with fallback detection
 *
 * NEW RULES:
 * 1. NEVER generate titles for fallback responses
 * 2. ONLY generate titles for successful, informative responses
 * 3. Detect fallback patterns: "I Cannot Answer", "I'm Not Confident", "I don't have enough information"
 * 4. Return "New Chat" for fallback responses
 */
const autoGenerateTitle = async (
  conversationId: string,
  userId: string,
  firstMessage: string,
  firstResponse?: string
) => {
  try {
    console.log('🏷️ Auto-generating title for conversation:', conversationId);

    // Skip title generation for very short messages without response
    if (!firstResponse && firstMessage.length < 10) {
      console.log('⏭️ Skipping title generation for very short message without response');
      return;
    }

    // ✅ NEW: Detect fallback responses and skip title generation
    if (firstResponse) {
      const fallbackPatterns = [
        /I cannot answer/i,
        /I'm not confident/i,
        /I don't have enough information/i,
        /I couldn't find/i,
        /I'm unable to/i,
        /I don't know/i,
        /I can't determine/i,
        /I can't provide/i,
        /I don't see/i,
        /I wasn't able to/i,
        /No relevant information/i,
        /I need more context/i,
        /Could you clarify/i,
        /Could you provide more details/i,
      ];

      const isFallback = fallbackPatterns.some(pattern => pattern.test(firstResponse));

      if (isFallback) {
        console.log('⏭️ [TITLE] Skipping title generation for fallback response');
        // Set title to "New Chat" for fallback responses
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            title: 'New Chat',
            updatedAt: new Date()
          },
        });
        return;
      }
    }

    // ✅ Generate title using Gemini via titleGeneration service
    try {
      const io = getIO();
      const { generateChatTitleOnly } = await import('./titleGeneration.service');
      const { detectLanguage } = await import('./languageDetection.service');

      // Detect language from user message
      const detectedLang = detectLanguage(firstMessage) || 'pt';

      // Emit title generation start event
      if (io) {
        io.to(`user:${userId}`).emit('title:generating:start', {
          conversationId,
        });
      }
      console.log(`📡 [TITLE-STREAM] Started generating title for conversation ${conversationId}`);

      // Generate title using Gemini
      const generatedTitle = await generateChatTitleOnly({
        userMessage: firstMessage.slice(0, 500),
        assistantPreview: firstResponse?.slice(0, 300),
        language: detectedLang
      });

      // Clean up the title
      const cleanTitle = generatedTitle.replace(/['"]/g, '').trim().substring(0, 100) || 'New Chat';

      // Emit the full title as chunks for animation effect
      if (io) {
        const words = cleanTitle.split(' ');
        for (const word of words) {
          io.to(`user:${userId}`).emit('title:generating:chunk', {
            conversationId,
            chunk: word + ' ',
          });
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for animation
        }
      }

      // Update the conversation in database
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title: cleanTitle,
          updatedAt: new Date()
        },
      });

      // Emit completion event
      if (io) {
        io.to(`user:${userId}`).emit('title:generating:complete', {
          conversationId,
          title: cleanTitle,
          updatedAt: new Date()
        });
      }

      console.log(`✅ Generated title: "${cleanTitle}"`);

    } catch (titleError) {
      console.warn('⚠️ Title generation failed, using fallback:', titleError);

      // Fallback: Use first few words of message
      const fallbackTitle = firstMessage.split(' ').slice(0, 5).join(' ') + '...';
      const cleanTitle = fallbackTitle.substring(0, 100) || 'New Chat';

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title: cleanTitle,
          updatedAt: new Date()
        },
      });

      // Emit completion event
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('title:generating:complete', {
          conversationId,
          title: cleanTitle,
          updatedAt: new Date()
        });
      }

      console.log(`✅ Generated title (fallback): "${cleanTitle}"`);
    }
  } catch (error) {
    console.error('❌ Error auto-generating title:', error);
    // Don't throw - title generation is non-critical
  }
};

/**
 * Regenerate titles for all "New Chat" conversations
 */
export const regenerateConversationTitles = async (userId: string) => {
  console.log('🔄 Regenerating conversation titles for user:', userId);

  // Find all conversations with "New Chat" title that have messages
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      title: 'New Chat',
    },
    include: {
      messages: {
        where: { role: 'user' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  console.log(`📋 Found ${conversations.length} conversations to regenerate`);

  let regenerated = 0;
  let failed = 0;

  for (const conversation of conversations) {
    if (conversation.messages.length === 0) {
      console.log(`⏭️ Skipping conversation ${conversation.id} (no messages)`);
      continue;
    }

    try {
      const firstMessage = conversation.messages[0].content;
      await autoGenerateTitle(conversation.id, conversation.userId, firstMessage, 'First message');
      regenerated++;
    } catch (error) {
      console.error(`❌ Failed to regenerate title for ${conversation.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Regenerated ${regenerated} titles, ${failed} failed`);

  return {
    total: conversations.length,
    regenerated,
    failed,
  };
};

// ============================================================================
// HELPER METHODS
// ============================================================================

/**
 * Build full conversation history for context
 * Retrieves all messages in a conversation and formats them for RAG context
 */
export const buildConversationContext = async (
  conversationId: string,
  userId: string,
  maxTokens: number = 50000
): Promise<string> => {

  console.log(`📚 [CONTEXT] Building conversation history for ${conversationId}`);

  // Get all messages in conversation
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      content: true,
      createdAt: true
    }
  });

  // Build conversation history
  let context = '## Conversation History\n\n';
  let tokenCount = 0;

  for (const message of messages) {
    const messageText = `**${message.role === 'user' ? 'User' : 'KODA'}** (${message.createdAt.toISOString()}):\n${message.content}\n\n`;

    // Rough token estimation (1 token ≈ 4 characters)
    const messageTokens = messageText.length / 4;

    if (tokenCount + messageTokens > maxTokens) {
      console.log(`📚 [CONTEXT] Reached token limit, truncating history`);
      break;
    }

    context += messageText;
    tokenCount += messageTokens;
  }

  console.log(`📚 [CONTEXT] Built history with ~${Math.floor(tokenCount)} tokens`);

  return context;
};

/**
 * Handle file actions if the message is a command
 * Returns result if action was executed, null if not a file action
 *
 * UPDATED: Now uses LLM-based intent detection for flexible understanding
 * Supports: CREATE_FOLDER, UPLOAD_FILE, RENAME_FILE, DELETE_FILE, MOVE_FILE
 */
export const handleFileActionsIfNeeded = async (
  userId: string,
  message: string,
  conversationId: string,
  attachedFiles?: any[]
): Promise<{ action: string; message: string } | null> => {

  // ✅ FIX #6: Simple Intent Detection (replaces LLM-based intentDetection.service)
  const { detectIntent: detectSimpleIntent, toLegacyIntent } = require('./simpleIntentDetection.service');
  const fileActionsService = require('./fileActions.service').default;

  // ========================================
  // Use simple pattern-based intent detection (<10ms vs 3-6s LLM)
  // ========================================
  const simpleResult = detectSimpleIntent(message);
  const intentResult = toLegacyIntent(simpleResult);

  console.log(`⚡ [Intent] ${intentResult.intent} (confidence: ${intentResult.confidence}) [pattern/${simpleResult.detectionTimeMs}ms]`);
  console.log(`📝 [Entities]`, intentResult.parameters);

  // =========================================================================
  // MEMORY ENGINE 3.0: Resolve document references BEFORE intent processing
  // =========================================================================
  // Check if the query contains a reference like "the first one", "it", "that document"
  if (referenceResolutionService.hasDocumentReference(message)) {
    console.log(`🧠 [Memory3.0] Detected document reference in query`);

    const resolved = await referenceResolutionService.resolveReference(conversationId, message);

    if (resolved.document) {
      console.log(`🧠 [Memory3.0] Resolved "${message}" -> document "${resolved.document.name}" (${resolved.referenceType}, confidence: ${resolved.confidence})`);

      // Return a response that works with the resolved document
      // The document ID can now be used for RAG queries
      return {
        action: 'resolved_reference',
        message: `__RESOLVED_DOC_ID__:${resolved.document.id}:${resolved.document.name}`,
      };
    } else {
      console.log(`🧠 [Memory3.0] Could not resolve reference - no document list in context`);
    }
  }

  // Only process file actions with high confidence
  const fileActionIntents = ['create_folder', 'list_files', 'search_files', 'file_location', 'rename_file', 'delete_file', 'move_files', 'list_folders', 'metadata_query'];

  // Check if this is a file action intent
  // ✅ FIX: Use OR (||) instead of AND (&&) - return null if EITHER condition is true
  console.log(`🔍 [FileActions] Checking intent: "${intentResult.intent}" (confidence: ${intentResult.confidence})`);
  console.log(`🔍 [FileActions] Is file action? ${fileActionIntents.includes(intentResult.intent)}, High confidence? ${intentResult.confidence >= 0.7}`);

  if (!fileActionIntents.includes(intentResult.intent) || intentResult.confidence < 0.7) {
    // Not a file action - return null to continue with RAG
    console.log(`🔍 [FileActions] Returning null - not a file action or low confidence`);
    return null;
  }

  console.log(`✅ [FileActions] Processing file action: ${intentResult.intent}`);

  // ========================================
  // CREATE FOLDER
  // ========================================
  // Check for folder creation using LLM parameters or fallback patterns
  const createFolderPatterns = [
    /create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
    /make\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
    /new\s+folder\s+["']?([^"']+)["']?/i,
  ];

  let folderName = intentResult.parameters?.folderName || null;

  // Fallback to regex if LLM didn't extract folder name
  if (!folderName) {
    for (const pattern of createFolderPatterns) {
      const match = message.match(pattern);
      if (match) {
        folderName = match[1].trim();
        break;
      }
    }
  }

  if (folderName) {
    console.log(`📁 [Action] Creating folder: "${folderName}"`);

    // Create folder
    const folderResult = await fileActionsService.createFolder({
      userId,
      folderName
    });

    if (!folderResult.success) {
      return {
        action: 'create_folder',
        message: `❌ Failed to create folder: ${folderResult.error || folderResult.message}`
      };
    }

    const folderId = folderResult.data.folder.id;
    console.log(`✅ Folder created: ${folderId}`);

    // If files attached, upload them to the new folder
    if (attachedFiles && attachedFiles.length > 0) {
      const uploadService = require('./upload.service').default;
      const uploadedFiles = [];

      for (const file of attachedFiles) {
        try {
          const uploadResult = await uploadService.uploadFile(file, userId, folderId);
          uploadedFiles.push(uploadResult.filename);
        } catch (error) {
          console.error(`❌ Failed to upload ${file.name}:`, error);
        }
      }

      const fileList = uploadedFiles.map(f => `• ${f}`).join('\n');
      return {
        action: 'create_folder_with_files',
        message: `✅ Created folder **"${folderName}"** and added **${uploadedFiles.length} file(s)**:\n\n${fileList}`
      };
    }

    return {
      action: 'create_folder',
      message: `✅ Created folder **"${folderName}"**`
    };
  }

  // ========================================
  // MOVE FILE (must come BEFORE upload to prevent misclassification)
  // ========================================
  if (intentResult.intent === 'move_files' &&
      intentResult.parameters?.filename &&
      intentResult.parameters?.targetFolder) {

    console.log(`📦 [Action] Moving: "${intentResult.parameters.filename}" → "${intentResult.parameters.targetFolder}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'move_file',
      message: result.message
    };
  }

  // ========================================
  // UPLOAD FILE
  // ========================================
  // Check for file upload to folder patterns
  // NOTE: "move" is handled in MOVE FILE section above
  const uploadPatterns = [
    /(?:upload|save|store|put|add)\s+(?:this|these|the)?\s*(?:file|files|document|documents)?\s+(?:to|in|into)\s+(?:the\s+)?["']?([^"']+)["']?\s*(?:folder)?/i,
  ];

  // Skip upload logic if this is a move_files intent (already handled above)
  let targetFolder = intentResult.intent !== 'move_files' ? (intentResult.parameters?.targetFolder || null) : null;

  if (!targetFolder) {
    for (const pattern of uploadPatterns) {
      const match = message.match(pattern);
      if (match) {
        targetFolder = match[1].trim();
        break;
      }
    }
  }

  if (targetFolder) {
    console.log(`📤 [Action] Uploading files to: "${targetFolder}"`);

    // Find folder by name
    const folder = await prisma.folder.findFirst({
      where: {
        name: {
          contains: targetFolder
          // Note: mode: 'insensitive' not supported with contains
        },
        userId
      }
    });

    if (!folder) {
      return {
        action: 'upload_file',
        message: `❌ Folder "${targetFolder}" not found. Please create it first or check the name.`
      };
    }

    if (!attachedFiles || attachedFiles.length === 0) {
      return {
        action: 'upload_file',
        message: `❌ No files attached. Please attach files to upload.`
      };
    }

    const uploadService = require('./upload.service').default;
    const uploadedFiles = [];

    for (const file of attachedFiles) {
      try {
        const uploadResult = await uploadService.uploadFile(file, userId, folder.id);
        uploadedFiles.push(uploadResult.filename);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error);
      }
    }

    const fileList = uploadedFiles.map(f => `• ${f}`).join('\n');
    return {
      action: 'upload_file',
      message: `✅ Uploaded **${uploadedFiles.length} file(s)** to folder **"${targetFolder}"**:\n\n${fileList}`
    };
  }

  // ========================================
  // RENAME FILE
  // ========================================
  if (intentResult.intent === 'rename_file' &&
      intentResult.parameters?.oldFilename &&
      intentResult.parameters?.newFilename) {

    console.log(`✏️ [Action] Renaming: "${intentResult.parameters.oldFilename}" → "${intentResult.parameters.newFilename}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'rename_file',
      message: result.message
    };
  }

  // ========================================
  // DELETE FILE
  // ========================================
  if (intentResult.intent === 'delete_file' && intentResult.parameters?.filename) {
    console.log(`🗑️ [Action] Deleting: "${intentResult.parameters.filename}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'delete_file',
      message: result.message
    };
  }

  // ========================================
  // LIST FILES
  // ========================================
  if (intentResult.intent === 'list_files') {
    console.log(`📋 [Action] Listing files`);

    // Extract parameters
    const fileType = intentResult.parameters?.fileType || null;
    const fileTypes = intentResult.parameters?.fileTypes || [];
    const folderName = intentResult.parameters?.folderName || null;

    // If file types are specified, use FileTypeHandler for better formatting
    if (fileType || (fileTypes && fileTypes.length > 0)) {
      console.log(`📄 Using FileTypeHandler for file types: ${fileTypes.length > 0 ? fileTypes.join(', ') : fileType}`);

      const { FileTypeHandler } = require('./handlers/fileType.handler');
      const fileTypeHandler = new FileTypeHandler();

      // Build query string for FileTypeHandler
      const queryParts = [];
      if (fileTypes && fileTypes.length > 0) {
        queryParts.push(...fileTypes);
      } else if (fileType) {
        queryParts.push(fileType);
      }

      const fileTypeQuery = queryParts.join(' and ');

      try {
        const result = await fileTypeHandler.handle(userId, fileTypeQuery, {
          folderId: folderName ? undefined : undefined // TODO: resolve folder by name
        });

        if (result) {
          return {
            action: 'list_files',
            message: result.answer
          };
        }
      } catch (error) {
        console.error('❌ FileTypeHandler error:', error);
        // Fall through to default handler
      }
    }

    // Build query
    const whereClause: any = {
      userId,
      status: { not: 'deleted' },
    };

    // Filter by file type if specified
    if (fileType) {
      console.log(`📄 Filtering by file type: "${fileType}"`);

      // Map friendly names to extensions
      const extensionMap: Record<string, string[]> = {
        'pdf': ['.pdf'],
        'word': ['.docx', '.doc'],
        'docx': ['.docx'],
        'doc': ['.doc'],
        'excel': ['.xlsx', '.xls'],
        'xlsx': ['.xlsx'],
        'xls': ['.xls'],
        'powerpoint': ['.pptx', '.ppt'],
        'pptx': ['.pptx'],
        'ppt': ['.ppt'],
        'presentation': ['.pptx', '.ppt'],
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'],
        'jpg': ['.jpg'],
        'jpeg': ['.jpeg'],
        'png': ['.png'],
        'gif': ['.gif'],
        'photo': ['.jpg', '.jpeg', '.png'],
        'text': ['.txt'],
        'txt': ['.txt'],
      };

      const extensions = extensionMap[fileType.toLowerCase()] || [`.${fileType}`];

      whereClause.OR = extensions.map(ext => ({
        filename: {
          endsWith: ext,
          mode: 'insensitive'
        }
      }));
    }

    // Filter by folder if specified
    if (folderName) {
      console.log(`📁 Filtering by folder: "${folderName}"`);

      const folder = await prisma.folder.findFirst({
        where: {
          name: {
            contains: folderName,
            mode: 'insensitive'
          },
          userId
        }
      });

      if (!folder) {
        return {
          action: 'list_files',
          message: `❌ Folder "${folderName}" not found.`
        };
      }

      whereClause.folderId = folder.id;
    }

    // Get documents from database
    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 files
      include: {
        folder: {
          select: { name: true }
        }
      }
    });

    // NEW: Use inline document injection for file listing
    // This injects {{DOC:::id:::filename:::mimeType:::size:::folder}} markers
    // that will be rendered as clickable buttons on the frontend
    const queryLanguage = detectLanguage(message);  // Detect language from query
    const response = formatFileListingResponse(documents, {
      fileType,
      folderName,
      maxInline: 15, // Show up to 15 files inline
      includeMetadata: true,
      language: queryLanguage  // ✅ Pass detected language for localized response
    });

    // =========================================================================
    // MEMORY ENGINE 3.0: Save document list for reference resolution
    // =========================================================================
    // This enables "tell me about the first one", "open it", etc.
    try {
      await documentListStateManager.setDocumentList(
        conversationId,
        documents.map(doc => ({
          id: doc.id,
          name: doc.filename,
          type: doc.mimeType || 'unknown',
          folderId: doc.folderId || undefined,
          folderName: doc.folder?.name || undefined,
        }))
      );
      console.log(`[Memory3.0] Saved ${documents.length} documents for conversation ${conversationId}`);
    } catch (memError) {
      console.error('[Memory3.0] Error saving document list:', memError);
    }

    return {
      action: 'list_files',
      message: response
    };
  }

  // ========================================
  // LIST FOLDERS (NEW)
  // ========================================
  // Detect folder listing queries: "what folders do I have", "list my folders"
  const lowerMessage = message.toLowerCase();
  const isFolderQuery = /(?:what|which|list|show)\s+(?:all\s+)?(?:my\s+)?folders/i.test(message) ||
                        /how\s+many\s+folders/i.test(message) ||
                        /quais\s+pastas/i.test(message) ||
                        /qu[eé]\s+carpetas/i.test(message);

  if (isFolderQuery || intentResult.intent === 'list_folders') {
    console.log(`📁 [Action] Listing folders with inline markers`);

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: { select: { documents: true } }
      },
      orderBy: { name: 'asc' }
    });

    if (folders.length === 0) {
      return {
        action: 'list_folders',
        message: 'You have no folders yet. You can create folders to organize your documents.'
      };
    }

    // Convert to InlineFolder format
    const inlineFolders: InlineFolder[] = folders.map(f => ({
      folderId: f.id,
      folderName: f.name,
      fileCount: f._count.documents,
      folderPath: f.name
    }));

    // Generate response with inline folder markers
    const response = generateFolderListingResponse(inlineFolders, {
      maxFolders: 10
    });

    return {
      action: 'list_folders',
      message: response
    };
  }

  // ========================================
  // SHOW SPECIFIC FILE (NEW)
  // ========================================
  // Detect "show me X" queries for specific files
  const showMeMatch = message.match(/(?:show|open|display|view)\s+(?:me\s+)?(?:the\s+)?(?:file\s+)?["']?([^"']+)["']?/i);
  const isShowMeQuery = showMeMatch && !isFolderQuery &&
                        !/(?:all|my|every)\s+(?:files|documents|folders)/i.test(message);

  if (isShowMeQuery && showMeMatch) {
    const searchTerm = showMeMatch[1].trim()
      .replace(/\s+file$/i, '')
      .replace(/\s+document$/i, '');

    console.log(`📄 [Action] Show specific file: "${searchTerm}"`);

    // Search for the file
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
        filename: { contains: searchTerm, mode: 'insensitive' }
      },
      include: { folder: { select: { name: true, path: true } } },
      take: 5
    });

    if (documents.length === 0) {
      return {
        action: 'show_file',
        message: `No file found matching "${searchTerm}". Try using different keywords.`
      };
    }

    if (documents.length === 1) {
      // Single match - use generateShowMeResponse
      const doc = documents[0];
      const inlineDoc: InlineDocument = {
        documentId: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType || 'application/octet-stream',
        fileSize: doc.fileSize || undefined,
        folderPath: doc.folder?.path || doc.folder?.name  // Use full path hierarchy
      };

      const response = generateShowMeResponse(inlineDoc, {
        includeLocation: !!doc.folder?.name,
        includeMetadata: true
      });

      return {
        action: 'show_file',
        message: response
      };
    }

    // Multiple matches - show list with markers
    const searchLang = detectLanguage(message);  // Detect language from query
    const response = formatFileListingResponse(documents, {
      maxInline: 5,
      includeMetadata: true,
      language: searchLang  // ✅ Pass detected language for localized response
    });

    // Localized "Found X files matching" header
    const foundHeader = searchLang === 'pt' ? `Encontrei ${documents.length} arquivos correspondentes a "${searchTerm}"` :
                        searchLang === 'es' ? `Encontré ${documents.length} archivos que coinciden con "${searchTerm}"` :
                        searchLang === 'fr' ? `J'ai trouvé ${documents.length} fichiers correspondant à "${searchTerm}"` :
                        searchLang === 'de' ? `Ich habe ${documents.length} Dateien gefunden, die zu "${searchTerm}" passen` :
                        `Found ${documents.length} files matching "${searchTerm}"`;

    return {
      action: 'show_file',
      message: `${foundHeader}:\n\n${response}`
    };
  }

  // ========================================
  // LIST FOLDERS
  // ========================================
  if (intentResult.intent === 'list_folders') {
    console.log(`📁 [Action] Listing all folders`);

    // Get all folders from database
    const folders = await prisma.folder.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            documents: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (folders.length === 0) {
      return {
        action: 'list_folders',
        message: 'You don\'t have any folders yet. Create one by saying "create folder [name]".'
      };
    }

    // Build response with {{FOLDER:::}} markers
    let response = `Found ${folders.length} folder${folders.length !== 1 ? 's' : ''}:\n\n`;

    folders.forEach(folder => {
      const fileCount = folder._count.documents;
      const fileText = fileCount === 1 ? '1 file' : `${fileCount} files`;

      // Inject {{FOLDER:::id:::name:::fileCount}} marker
      response += `{{FOLDER:::${folder.id}:::${folder.name}:::${fileCount}}}\n`;
    });

    response += `\nClick any folder to view its contents.`;

    return {
      action: 'list_folders',
      message: response
    };
  }

  // ========================================
  // METADATA QUERY
  // ========================================
  if (intentResult.intent === 'metadata_query') {
    console.log(`📊 [Action] Metadata query - counting files by type`);

    // Get ALL documents from database
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      select: {
        filename: true,
        fileSize: true,
      }
    });

    if (documents.length === 0) {
      return {
        action: 'metadata_query',
        message: 'You have no documents uploaded yet.'
      };
    }

    // Count by file type
    const typeCounts: Record<string, number> = {};
    const typeSizes: Record<string, number> = {};

    documents.forEach(doc => {
      // Get file extension - check if filename has a dot
      const parts = doc.filename.split('.');
      let ext = 'unknown';

      // Only extract extension if there's actually a dot AND the last part is not the whole filename
      if (parts.length > 1 && parts[parts.length - 1] !== doc.filename) {
        ext = parts[parts.length - 1].toLowerCase();
      }

      // Map extensions to friendly names
      const typeMap: Record<string, string> = {
        'pdf': 'PDF',
        'docx': 'Word (DOCX)',
        'doc': 'Word (DOC)',
        'xlsx': 'Excel (XLSX)',
        'xls': 'Excel (XLS)',
        'pptx': 'PowerPoint (PPTX)',
        'ppt': 'PowerPoint (PPT)',
        'jpg': 'Image (JPG)',
        'jpeg': 'Image (JPEG)',
        'png': 'Image (PNG)',
        'gif': 'Image (GIF)',
        'bmp': 'Image (BMP)',
        'svg': 'Image (SVG)',
        'txt': 'Text (TXT)',
        'unknown': 'No Extension',
      };

      const type = typeMap[ext] || ext.toUpperCase();

      // Count files and sum sizes
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      typeSizes[type] = (typeSizes[type] || 0) + (doc.fileSize || 0);
    });

    // Check if user asked for specific file types
    const fileTypes = intentResult.parameters?.fileTypes || [];

    if (fileTypes.length > 0) {
      // User asked for specific types (e.g., "how many PDFs and DOCX")
      console.log(`📊 Specific types requested:`, fileTypes);

      let message = '**File Count:**\n\n';

      fileTypes.forEach((requestedType: string) => {
        // Find matching type in our counts
        const matchingType = Object.keys(typeCounts).find(type =>
          type.toLowerCase().includes(requestedType.toLowerCase())
        );

        if (matchingType) {
          const count = typeCounts[matchingType];
          const size = typeSizes[matchingType];
          const sizeMB = (size / (1024 * 1024)).toFixed(2);

          message += `• **${matchingType}**: ${count} file${count !== 1 ? 's' : ''} (${sizeMB} MB)\n`;
        } else {
          message += `• **${requestedType.toUpperCase()}**: 0 files\n`;
        }
      });

      return {
        action: 'metadata_query',
        message: message.trim()
      };
    }

    // General query - show all file types
    let message = `**You have ${Object.keys(typeCounts).length} types of files:**\n\n`;

    // Sort by count descending
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

    sortedTypes.forEach(([type, count]) => {
      const size = typeSizes[type] || 0;
      const sizeMB = (size / (1024 * 1024)).toFixed(2);

      message += `• **${type}**: ${count} file${count !== 1 ? 's' : ''} (${sizeMB} MB)\n`;
    });

    // Add total
    const totalSize = Object.values(typeSizes).reduce((sum, size) => sum + size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    message += `\n**Total**: ${documents.length} files (${totalSizeMB} MB)`;

    return {
      action: 'metadata_query',
      message: message.trim()
    };
  }

  // Not a file action - return null to continue with RAG
  return null;
};

/**
 * Format document sources for display
 * Returns formatted string like:
 *
 * ---
 * **Document Sources (3)**
 *
 * • **Business Plan.pdf** (page 5)
 * • **Financial Report.xlsx** (Sheet 1)
 * • **Contract.docx** (page 2)
 */
const formatDocumentSources = (sources: any[], attachedDocId?: string): string => {
  if (!sources || sources.length === 0) {
    return '';
  }

  // Remove duplicates (same documentId)
  const uniqueSources = Array.from(
    new Map(sources.map(s => [s.documentId, s])).values()
  );

  const lines = [
    '---',
    `**Document Sources (${uniqueSources.length})**`,
    ''
  ];

  for (const source of uniqueSources) {
    let line = `• **${source.documentName}**`;

    // Mark attached document
    if (source.documentId === attachedDocId) {
      line += ' *(attached)*';
    }

    // Add location if available
    if (source.location) {
      line += ` (${source.location})`;
    } else if (source.document_metadata?.page) {
      line += ` (page ${source.document_metadata.page})`;
    }

    lines.push(line);
  }

  return lines.join('\n');
};

// ============================================================================
// CONVERSATION HISTORY HELPERS
// ============================================================================

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      content: true
    },
    take: 50 // Last 50 messages for robust conversation memory
  });

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createConversation,
  getUserConversations,
  getConversation,
  deleteConversation,
  deleteAllConversations,
  sendMessage,
  sendMessageStreaming,
  regenerateConversationTitles,
  buildConversationContext,
};

