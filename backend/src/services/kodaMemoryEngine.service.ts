/**
 * ============================================================================
 * KODA MEMORY ENGINE 4.0 - CHATGPT-STYLE MEMORY
 * ============================================================================
 *
 * This implements ChatGPT-style conversation memory with 3 layers:
 * 1. Short-term buffer (last 30-50 messages, exact)
 * 2. Rolling summary + ConversationState (narrative, goal, current doc)
 * 3. Infinite memory (semantic search for old discussions)
 *
 * KEY IMPROVEMENTS FROM V3:
 * - Rolling summary RE-ENABLED (background generation)
 * - ConversationState ALWAYS included in prompt
 * - Infinite memory integrated for recall queries
 * - State updated every turn
 * - Intent detection receives full history
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { generateRollingSummary } from './rollingConversationSummary.service';
import { getInfiniteConversationContext } from './infiniteConversationMemory.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface KodaMemory {
  shortTermBuffer: ConversationMessage[];
  rollingSummary: string;
  conversationState: ConversationState | null;
  infiniteMemorySnippets: string[];
  formattedContext: string;
  totalMessages: number;
  lastMessageAt: Date | null;
  language: string;  // Conversation language (en, pt, es, fr)
  languageInstruction: string;  // Pre-built instruction for LLM
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | string;
  content: string;
  timestamp?: Date;
  createdAt?: Date;
}

export interface ConversationState {
  userGoal: string;
  currentDocument: string;
  currentTopic: string;
  knownSections: string[];
  knownDocuments: string[];
  summary: string;
  turnsSinceLastSummary: number;
  language: string;  // Language code: en, pt, es, fr
}

export interface MemoryOptions {
  enableInfiniteMemory?: boolean;  // Enable semantic search for old discussions
  bufferSize?: number;              // Number of recent messages (default: 50)
  includeState?: boolean;           // Include conversation state (default: true)
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_BUFFER_SIZE = 50;
const SUMMARY_TRIGGER_TURNS = 10;  // Generate summary every 10 turns
const INFINITE_MEMORY_THRESHOLD = 0.7;  // Similarity threshold for old snippets

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get conversation memory (ChatGPT-style)
 *
 * This is the main entry point for loading memory.
 * Returns all 3 layers: buffer, summary, and optionally infinite memory.
 */
export async function getConversationMemory(
  conversationId: string,
  userId: string,
  query?: string,
  options: MemoryOptions = {}
): Promise<KodaMemory> {
  const opts = {
    enableInfiniteMemory: false,
    bufferSize: DEFAULT_BUFFER_SIZE,
    includeState: true,
    ...options
  };

  console.log('[MEMORY ENGINE 4.0] Loading memory for conversation:', conversationId.slice(0, 8));

  // Layer 1: Short-term buffer (last N messages)
  const shortTermBuffer = await getShortTermBuffer(conversationId, opts.bufferSize);
  console.log(`[MEMORY ENGINE 4.0] Loaded ${shortTermBuffer.length} recent messages`);

  // Layer 2: Rolling summary + ConversationState
  const conversationState = await getConversationState(conversationId, userId);
  const rollingSummary = conversationState.summary || '';
  console.log('[MEMORY ENGINE 4.0] Loaded conversation state:', {
    userGoal: conversationState.userGoal,
    currentDocument: conversationState.currentDocument,
    currentTopic: conversationState.currentTopic
  });

  // Layer 3: Infinite memory (optional, for recall queries)
  let infiniteMemorySnippets: string[] = [];
  if (opts.enableInfiniteMemory && query) {
    infiniteMemorySnippets = await getInfiniteMemorySnippets(
      conversationId,
      userId,
      query
    );
    console.log(`[MEMORY ENGINE 4.0] Loaded ${infiniteMemorySnippets.length} infinite memory snippets`);
  }

  // Build formatted context (composite of all layers)
  const formattedContext = buildFormattedContext(
    shortTermBuffer,
    rollingSummary,
    conversationState,
    infiniteMemorySnippets,
    opts.includeState
  );

  // Get language from state (or default to 'en')
  const language = conversationState.language || 'en';
  const languageInstruction = createLanguageInstruction(language);

  console.log(`[MEMORY ENGINE 4.0] Language: ${language}`);

  return {
    shortTermBuffer,
    rollingSummary,
    conversationState,
    infiniteMemorySnippets,
    formattedContext,
    totalMessages: shortTermBuffer.length,
    lastMessageAt: shortTermBuffer.length > 0
      ? shortTermBuffer[shortTermBuffer.length - 1].timestamp || shortTermBuffer[shortTermBuffer.length - 1].createdAt || null
      : null,
    language,
    languageInstruction
  };
}

/**
 * Update conversation memory after each turn
 *
 * This updates the state and optionally triggers background summary generation.
 */
export async function updateConversationMemory(
  conversationId: string,
  userId: string,
  userQuery: string,
  assistantResponse: string,
  metadata?: {
    currentDocument?: string;
    resolvedDocuments?: string[];
    intent?: string;
    topic?: string;
  }
): Promise<void> {
  console.log('[MEMORY ENGINE 4.0] Updating memory for conversation:', conversationId.slice(0, 8));

  // Load current state
  const state = await getConversationState(conversationId, userId);

  // Update state based on this turn
  const updatedState = updateStateFromTurn(state, userQuery, assistantResponse, metadata);

  // Save updated state
  await saveConversationState(conversationId, userId, updatedState);

  // Trigger background summary if needed
  if (updatedState.turnsSinceLastSummary >= SUMMARY_TRIGGER_TURNS) {
    console.log('[MEMORY ENGINE 4.0] Triggering background summary generation');
    // Fire and forget (don't await)
    generateRollingSummary(conversationId, userId).catch(err => {
      console.error('[MEMORY ENGINE 4.0] Background summary failed:', err);
    });

    // Reset counter
    updatedState.turnsSinceLastSummary = 0;
    await saveConversationState(conversationId, userId, updatedState);
  }

  console.log('[MEMORY ENGINE 4.0] Memory updated successfully');
}

// ============================================================================
// LAYER 1: SHORT-TERM BUFFER
// ============================================================================

/**
 * Get last N messages from database
 */
async function getShortTermBuffer(
  conversationId: string,
  bufferSize: number
): Promise<ConversationMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: bufferSize,
    select: {
      role: true,
      content: true,
      createdAt: true
    }
  });

  // Reverse to chronological order
  return messages.reverse().map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: msg.createdAt,
    createdAt: msg.createdAt
  }));
}

/**
 * Get just the short-term buffer (for quick access) - maintains backward compatibility
 */
export async function getShortTermBufferSimple(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: DEFAULT_BUFFER_SIZE,
    select: {
      role: true,
      content: true
    }
  });

  return messages;
}

// ============================================================================
// LAYER 2: ROLLING SUMMARY + CONVERSATION STATE
// ============================================================================

/**
 * Get conversation state from database
 * Creates default state if doesn't exist
 */
async function getConversationState(
  conversationId: string,
  userId: string
): Promise<ConversationState> {
  let state = await prisma.conversationState.findUnique({
    where: { conversationId }
  });

  if (!state) {
    // Create default state
    state = await prisma.conversationState.create({
      data: {
        conversationId,
        userId,
        userGoal: 'Conversation just started',
        currentDocument: '',
        currentTopic: '',
        knownSections: [],
        knownDocuments: [],
        summary: '',
        turnsSinceLastSummary: 0,
        language: 'en'  // Default language, will be updated on first message
      }
    });
  }

  return {
    userGoal: state.userGoal,
    currentDocument: state.currentDocument || '',
    currentTopic: state.currentTopic,
    knownSections: state.knownSections as string[],
    knownDocuments: state.knownDocuments as string[],
    summary: state.summary,
    turnsSinceLastSummary: state.turnsSinceLastSummary,
    language: (state as any).language || 'en'  // Handle existing records without language field
  };
}

/**
 * Save conversation state to database
 */
async function saveConversationState(
  conversationId: string,
  userId: string,
  state: ConversationState
): Promise<void> {
  await prisma.conversationState.upsert({
    where: { conversationId },
    update: {
      userGoal: state.userGoal,
      currentDocument: state.currentDocument,
      currentTopic: state.currentTopic,
      knownSections: state.knownSections,
      knownDocuments: state.knownDocuments,
      summary: state.summary,
      turnsSinceLastSummary: state.turnsSinceLastSummary,
      language: state.language
    },
    create: {
      conversationId,
      userId,
      userGoal: state.userGoal,
      currentDocument: state.currentDocument,
      currentTopic: state.currentTopic,
      knownSections: state.knownSections,
      knownDocuments: state.knownDocuments,
      summary: state.summary,
      turnsSinceLastSummary: state.turnsSinceLastSummary,
      language: state.language
    }
  });
}

/**
 * Update state based on current turn
 *
 * LANGUAGE DETECTION:
 * - On first turn (turnsSinceLastSummary == 0), detect language from user query
 * - Language is then LOCKED for the entire conversation (single source of truth)
 * - This ensures consistent language throughout the conversation
 */
export function updateStateFromTurn(
  state: ConversationState,
  userQuery: string,
  assistantResponse: string,
  metadata?: {
    currentDocument?: string;
    resolvedDocuments?: string[];
    intent?: string;
    topic?: string;
  }
): ConversationState {
  const updated = { ...state };

  // Increment turn counter
  updated.turnsSinceLastSummary++;

  // LANGUAGE DETECTION: Only detect on first turn to establish conversation language
  // This creates a "single source of truth" for language throughout the conversation
  if (updated.turnsSinceLastSummary === 1) {
    const detectedLang = detectLanguage(userQuery);
    updated.language = detectedLang;
    console.log(`[MEMORY ENGINE 4.0] Language detected on first turn: ${detectedLang}`);
  }

  // Update current document (if provided)
  if (metadata?.currentDocument) {
    updated.currentDocument = metadata.currentDocument;

    // Add to known documents
    if (!updated.knownDocuments.includes(metadata.currentDocument)) {
      updated.knownDocuments.push(metadata.currentDocument);
    }
  }

  // Add resolved documents to known documents
  if (metadata?.resolvedDocuments) {
    for (const doc of metadata.resolvedDocuments) {
      if (!updated.knownDocuments.includes(doc)) {
        updated.knownDocuments.push(doc);
      }
    }
  }

  // Update current topic (if provided)
  if (metadata?.topic) {
    updated.currentTopic = metadata.topic;
  } else {
    // Infer topic from query (simple heuristic)
    updated.currentTopic = inferTopicFromQuery(userQuery);
  }

  // Update user goal (if this is early in conversation)
  if (updated.turnsSinceLastSummary <= 3 && !updated.userGoal.startsWith('Conversation just')) {
    // Keep existing goal
  } else if (updated.turnsSinceLastSummary <= 3) {
    // Infer initial goal
    updated.userGoal = inferUserGoalFromQuery(userQuery);
  }

  return updated;
}

/**
 * Infer topic from user query (simple heuristic)
 */
export function inferTopicFromQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Financial topics
  if (lowerQuery.match(/\b(custo|investimento|roi|lucro|receita|despesa|orçamento)\b/)) {
    return 'Análise financeira';
  }

  // Risk topics
  if (lowerQuery.match(/\b(risco|ameaça|problema|desafio)\b/)) {
    return 'Análise de riscos';
  }

  // Legal topics
  if (lowerQuery.match(/\b(lgpd|contrato|cláusula|jurídico|legal)\b/)) {
    return 'Questões jurídicas';
  }

  // Project topics
  if (lowerQuery.match(/\b(projeto|planejamento|cronograma|etapa)\b/)) {
    return 'Gestão de projeto';
  }

  // Default
  return 'Análise de documentos';
}

/**
 * Infer user goal from initial query (simple heuristic)
 */
export function inferUserGoalFromQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.match(/\b(analis|entend|compreend|estud)\b/)) {
    return 'Analisar e compreender documentos';
  }

  if (lowerQuery.match(/\b(compar|contrast|diferenç)\b/)) {
    return 'Comparar informações entre documentos';
  }

  if (lowerQuery.match(/\b(calcul|estim|project)\b/)) {
    return 'Realizar cálculos e projeções';
  }

  if (lowerQuery.match(/\b(organiz|estrutur|categor)\b/)) {
    return 'Organizar e categorizar informações';
  }

  return 'Trabalhar com documentos';
}

// ============================================================================
// LAYER 3: INFINITE MEMORY
// ============================================================================

/**
 * Get infinite memory snippets (semantic search over old conversations)
 */
async function getInfiniteMemorySnippets(
  conversationId: string,
  userId: string,
  query: string
): Promise<string[]> {
  try {
    const context = await getInfiniteConversationContext(
      conversationId,
      userId,
      query,
      {
        includeHistorical: true,
        includeMemories: true,
        autoChunk: false,
        autoCompress: false
      }
    );

    // Extract snippets from context
    const formattedContext = context.formattedContext || '';
    const snippets = formattedContext.split('\n\n').filter(s => s.trim().length > 0);

    return snippets.slice(0, 5);  // Max 5 snippets
  } catch (error) {
    console.error('[MEMORY ENGINE 4.0] Infinite memory failed:', error);
    return [];
  }
}

/**
 * Detect if query is a memory recall query
 */
export function isMemoryRecallQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Portuguese patterns
  const ptPatterns = [
    /\b(lembr|antes|já disse|já falou|já mencion|anterior|passad|ontem)\b/,
    /\b(o que você (disse|falou|mencionou))\b/,
    /\b(qual (era|foi))\b/,
    /\b(me lembra|relembre)\b/
  ];

  // English patterns
  const enPatterns = [
    /\b(remember|earlier|before|previously|past|yesterday)\b/,
    /\b(what (did you|have you) (say|tell|mention))\b/,
    /\b(what was|what were)\b/,
    /\b(remind me)\b/
  ];

  const allPatterns = [...ptPatterns, ...enPatterns];

  return allPatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Detect if query is a follow-up (uses pronouns or references)
 */
export function isFollowUpQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Portuguese follow-up patterns
  const ptPatterns = [
    /\b(e |mas |porém |então )\b/,  // Conjunctions
    /\b(ele|ela|isso|este|esse|aquele|o mesmo|a mesma)\b/,  // Pronouns
    /\b(também|ainda|além disso)\b/,  // Continuations
    /^(e |mas |então )/  // Starting with conjunction
  ];

  // English follow-up patterns
  const enPatterns = [
    /\b(and |but |so |then )\b/,
    /\b(it|this|that|the same)\b/,
    /\b(also|too|furthermore)\b/,
    /^(and |but |so )/
  ];

  const allPatterns = [...ptPatterns, ...enPatterns];

  return allPatterns.some(pattern => pattern.test(lowerQuery));
}

// ============================================================================
// FORMATTED CONTEXT BUILDER
// ============================================================================

/**
 * Build formatted context from all memory layers
 * This is what gets injected into the LLM prompt
 */
export function buildFormattedContext(
  shortTermBuffer: ConversationMessage[],
  rollingSummary: string,
  conversationState: ConversationState | null,
  infiniteMemorySnippets: string[],
  includeState: boolean
): string {
  const sections: string[] = [];

  // Section 0: CRITICAL Language Instruction (FIRST, before all other context)
  // This ensures the LLM knows the language requirement before seeing any content
  if (conversationState?.language && conversationState.language !== 'en') {
    sections.push(buildLanguageInstructionSection(conversationState.language));
  }

  // Section 1: Conversation Context (from ConversationState)
  if (includeState && conversationState) {
    sections.push(buildConversationContextSection(conversationState));
  }

  // Section 2: Conversation Summary (rolling summary)
  if (rollingSummary && rollingSummary.trim().length > 0 && rollingSummary !== 'Conversation just started.') {
    sections.push(buildConversationSummarySection(rollingSummary));
  }

  // Section 3: Recent Conversation (short-term buffer)
  if (shortTermBuffer.length > 0) {
    sections.push(buildRecentConversationSection(shortTermBuffer));
  }

  // Section 4: Relevant Past Discussions (infinite memory)
  if (infiniteMemorySnippets.length > 0) {
    sections.push(buildRelevantPastDiscussionsSection(infiniteMemorySnippets));
  }

  return sections.join('\n\n');
}

/**
 * Build Language Instruction section
 * CRITICAL: This ensures the LLM responds in the correct language
 */
function buildLanguageInstructionSection(language: string): string {
  const languageNames: Record<string, string> = {
    'pt': 'Portuguese (Brazilian)',
    'es': 'Spanish',
    'fr': 'French',
    'en': 'English'
  };

  const languageExamples: Record<string, { confirmation: string; recall: string }> = {
    'pt': {
      confirmation: 'Sim, lembro sim.',
      recall: 'Na última pergunta você perguntou sobre...'
    },
    'es': {
      confirmation: 'Sí, lo recuerdo.',
      recall: 'En la última pregunta, preguntaste sobre...'
    },
    'fr': {
      confirmation: 'Oui, je me souviens.',
      recall: 'Dans votre dernière question, vous avez demandé...'
    },
    'en': {
      confirmation: 'Yes, I remember.',
      recall: 'In your last question, you asked about...'
    }
  };

  const langName = languageNames[language] || 'the user\'s language';
  const examples = languageExamples[language] || languageExamples['en'];

  return `=== CRITICAL: LANGUAGE REQUIREMENT ===
CONVERSATION LANGUAGE: ${langName} (${language})

YOU MUST respond ENTIRELY in ${langName}.
- ALL confirmations in ${langName}: "${examples.confirmation}"
- ALL memory recalls in ${langName}: "${examples.recall}"
- NO mixing languages (e.g., "Yes, I remember" in Portuguese conversation = WRONG)
- Short confirmations like "Sim", "Lembro", "Claro" NOT "Yes", "I remember", "Sure"

This is NON-NEGOTIABLE. Every word must be in ${langName}.
===================================`;
}

/**
 * Build Conversation Context section
 */
function buildConversationContextSection(state: ConversationState): string {
  const lines: string[] = [];
  lines.push('=== CONVERSATION CONTEXT ===');

  if (state.userGoal && state.userGoal !== 'Conversation just started') {
    lines.push(`USER GOAL: ${state.userGoal}`);
  }

  if (state.currentDocument) {
    lines.push(`CURRENT DOCUMENT: ${state.currentDocument}`);
  }

  if (state.currentTopic) {
    lines.push(`CURRENT TOPIC: ${state.currentTopic}`);
  }

  if (state.knownSections.length > 0) {
    lines.push(`KNOWN SECTIONS: ${state.knownSections.join(', ')}`);
  }

  if (state.knownDocuments.length > 0) {
    lines.push(`KNOWN DOCUMENTS: ${state.knownDocuments.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build Conversation Summary section
 */
function buildConversationSummarySection(summary: string): string {
  return `=== CONVERSATION SUMMARY ===\n${summary}`;
}

/**
 * Build Recent Conversation section
 */
function buildRecentConversationSection(messages: ConversationMessage[]): string {
  const lines: string[] = [];
  lines.push('=== RECENT CONVERSATION ===');

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    // Truncate very long messages for context efficiency
    const content = msg.content.length > 500
      ? msg.content.slice(0, 500) + '...'
      : msg.content;
    lines.push(`${role}: ${content}`);
  }

  return lines.join('\n');
}

/**
 * Build Relevant Past Discussions section
 */
function buildRelevantPastDiscussionsSection(snippets: string[]): string {
  const lines: string[] = [];
  lines.push('=== RELEVANT PAST DISCUSSIONS ===');

  for (let i = 0; i < snippets.length; i++) {
    lines.push(`[${i + 1}] ${snippets[i]}`);
  }

  return lines.join('\n');
}

// ============================================================================
// BACKWARD COMPATIBILITY FUNCTIONS
// ============================================================================

/**
 * Check if conversation has substantial history
 */
export async function hasConversationHistory(
  conversationId: string
): Promise<boolean> {
  const count = await prisma.message.count({
    where: { conversationId }
  });

  return count > 0;
}

/**
 * Get conversation history formatted for Gemini's multi-turn format
 */
export async function getGeminiFormattedHistory(
  conversationId: string
): Promise<Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: DEFAULT_BUFFER_SIZE,
    select: {
      role: true,
      content: true
    }
  });

  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

/**
 * Clear conversation memory (used when starting fresh)
 */
export async function clearConversationMemory(
  conversationId: string
): Promise<void> {
  try {
    // Delete all messages
    await prisma.message.deleteMany({
      where: { conversationId }
    });

    // Delete conversation state
    await prisma.conversationState.deleteMany({
      where: { conversationId }
    });

    console.log(`[MEMORY ENGINE 4.0] Cleared memory for conversation ${conversationId.slice(0, 8)}`);
  } catch (error) {
    console.error('[MEMORY ENGINE 4.0] Failed to clear memory:', error);
  }
}

/**
 * DOCUMENT LIST STATE MANAGER
 * Tracks the last document list shown to the user
 */
const documentListState = new Map<string, {
  documentList: string[];
  timestamp: number;
}>();

export function saveDocumentList(conversationId: string, documents: string[]): void {
  documentListState.set(conversationId, {
    documentList: documents,
    timestamp: Date.now(),
  });
}

export function getDocumentList(conversationId: string): string[] | null {
  const state = documentListState.get(conversationId);
  if (!state) return null;

  // Expire after 10 minutes
  if (Date.now() - state.timestamp > 600000) {
    documentListState.delete(conversationId);
    return null;
  }

  return state.documentList;
}

/**
 * REFERENCE RESOLUTION
 * Resolves "the first one", "the second document", etc.
 */
export function resolveDocumentReference(
  query: string,
  conversationId: string
): string | null {
  const queryLower = query.toLowerCase();
  const docList = getDocumentList(conversationId);

  if (!docList || docList.length === 0) return null;

  // "primeiro" / "first"
  if (queryLower.match(/primeiro|first|1º|1st/)) {
    return docList[0];
  }

  // "segundo" / "second"
  if (queryLower.match(/segundo|second|2º|2nd/)) {
    return docList[1] || null;
  }

  // "terceiro" / "third"
  if (queryLower.match(/terceiro|third|3º|3rd/)) {
    return docList[2] || null;
  }

  // "último" / "last"
  if (queryLower.match(/último|last/)) {
    return docList[docList.length - 1];
  }

  return null;
}

/**
 * Get memory context for the orchestrator (simplified interface)
 */
export async function getMemoryContext(conversationId: string): Promise<{
  history: Array<{ role: string; content: string }>;
  entities: Record<string, string>;
}> {
  const buffer = await getShortTermBufferSimple(conversationId);
  return {
    history: buffer,
    entities: {},
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getConversationMemory,
  updateConversationMemory,
  getShortTermBuffer: getShortTermBufferSimple,
  hasConversationHistory,
  getGeminiFormattedHistory,
  clearConversationMemory,
  saveDocumentList,
  getDocumentList,
  resolveDocumentReference,
  getMemoryContext,
  isMemoryRecallQuery,
  isFollowUpQuery,
  inferTopicFromQuery,
  inferUserGoalFromQuery,
  updateStateFromTurn,
  buildFormattedContext,
  SHORT_TERM_BUFFER_SIZE: DEFAULT_BUFFER_SIZE
};
