/**
 * Conversation Context Service - Multi-turn conversation context management
 */

import prisma from '../config/database';

export interface ConversationContext {
  entities: string[];
  topics: string[];
  documents: string[];
  documentIds: string[];
  lastQuery: string;
  lastAnswer: string;
  keyFindings: KeyFinding[];
  calculationResults: any[];
}

export interface KeyFinding {
  question: string;
  answer: string;
  data?: Record<string, any>;
  source?: string;
  timestamp: Date;
}

export interface ContextExtractionResult {
  entities: string[];
  topics: string[];
  keyFinding?: KeyFinding;
  referencedDocuments: string[];
}

// ============================================================================
// FIX #2: Fallback/Error Response Detection
// ============================================================================
// These patterns indicate the response is NOT useful for context retention
// Saving these to context causes multi-turn conversation failures
const FALLBACK_PATTERNS = [
  // English fallbacks
  /i (?:searched|looked) (?:through|in) your documents? but (?:couldn't|could not|did not) find/i,
  /i (?:couldn't|could not|was unable to) find (?:any |relevant |specific )?(?:information|data|details|content)/i,
  /no (?:relevant |specific )?(?:information|data|documents?) (?:found|available|were found)/i,
  /i don'?t have (?:enough |sufficient )?(?:information|context|data)/i,
  /i apologize,? but i (?:encountered|had) an error/i,
  /sorry,? i (?:could not|couldn't) (?:generate|find|locate)/i,
  /please try (?:again|rephrasing|a different)/i,
  /i need more (?:context|information|details)/i,
  /could you (?:please |)(?:clarify|specify|provide|rephrase)/i,
  /i'm not sure what you're (?:asking|referring to)/i,
  // Portuguese fallbacks
  /não (?:encontrei|achei) (?:informações?|dados?|documentos?)/i,
  /desculpe,? (?:não consegui|ocorreu um erro)/i,
  /por favor,? tente novamente/i,
  // Spanish fallbacks
  /no (?:encontré|pude encontrar) (?:información|datos|documentos)/i,
  /lo siento,? (?:no pude|ocurrió un error)/i,
];

/**
 * ✅ FIX #2: Detect if response is a fallback/error that shouldn't be saved to context
 */
function isFallbackResponse(answer: string): boolean {
  if (!answer || answer.trim().length === 0) return true;
  if (answer.trim().length < 20) return true; // Too short to be meaningful

  // Check against fallback patterns
  for (const pattern of FALLBACK_PATTERNS) {
    if (pattern.test(answer)) {
      console.log(`⚠️ [CONTEXT] Detected fallback response: "${answer.substring(0, 50)}..."`);
      return true;
    }
  }
  return false;
}

class ConversationContextService {
  async getContext(conversationId: string): Promise<ConversationContext | null> {
    try {
      const conversation = await prisma.conversations.findUnique({
        where: { id: conversationId },
        select: { contextMeta: true }
      });
      if (!conversation?.contextMeta) return null;
      return this.parseContextFromJson(
        typeof conversation.contextMeta === 'string'
          ? conversation.contextMeta
          : JSON.stringify(conversation.contextMeta)
      );
    } catch (error) {
      console.error('🧠 [CONTEXT] Error loading context:', error);
      return null;
    }
  }

  async saveContext(conversationId: string, context: ConversationContext): Promise<void> {
    try {
      await prisma.conversations.update({
        where: { id: conversationId },
        data: { contextMeta: context as any, updatedAt: new Date() }
      });
      console.log(`🧠 [CONTEXT] Saved context for ${conversationId}`);
    } catch (error) {
      console.error('🧠 [CONTEXT] Error saving:', error);
    }
  }

  async extractContext(
    userQuery: string,
    assistantAnswer: string,
    sources: Array<{ documentId: string; documentName: string }> = []
  ): Promise<ContextExtractionResult> {
    console.log('🧠 [CONTEXT] Extracting from turn...');
    return this.simpleExtraction(userQuery, assistantAnswer, sources);
  }

  private simpleExtraction(
    query: string, answer: string,
    sources: Array<{ documentId: string; documentName: string }>
  ): ContextExtractionResult {
    const entities: string[] = [];
    const topics: string[] = [];
    const combined = `${query} ${answer}`;

    const years = combined.match(/\b(20[2-3]\d)\b/g);
    if (years) entities.push(...years);

    const money = combined.match(/\$[\d,]+(?:\.\d{2})?(?:[MBK])?|\d+(?:\.\d+)?[MBK]\b/gi);
    if (money) entities.push(...money);

    const percentages = combined.match(/\d+(?:\.\d+)?%/g);
    if (percentages) entities.push(...percentages);

    const multipliers = combined.match(/\d+(?:\.\d+)?x\b/gi);
    if (multipliers) entities.push(...multipliers);

    const metrics = ['MoIC', 'IRR', 'ROI', 'EBITDA', 'revenue', 'profit', 'expense', 'investment'];
    metrics.forEach(m => {
      if (combined.toLowerCase().includes(m.toLowerCase())) entities.push(m);
    });

    const properNouns = combined.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
    if (properNouns) {
      properNouns.forEach(noun => {
        if (!noun.startsWith('What ') && !noun.startsWith('How ')) entities.push(noun);
      });
    }

    sources.forEach(src => { if (src.documentName) entities.push(src.documentName); });

    const topicMap: Record<string, string> = {
      'revenue': 'revenue analysis', 'profit': 'profitability',
      'expense': 'expense analysis', 'moic': 'investment returns', 'compare': 'comparison'
    };
    Object.entries(topicMap).forEach(([k, v]) => {
      if (combined.toLowerCase().includes(k)) topics.push(v);
    });

    let keyFinding: KeyFinding | undefined;
    const numMatch = answer.match(/(?:is|was|are|equals?|=|:)\s*\$?([\d,]+(?:\.\d+)?(?:%|x|[MBK])?)/i);
    if (numMatch) {
      keyFinding = {
        question: query.substring(0, 100),
        answer: numMatch[0],
        data: { value: numMatch[1] },
        source: sources[0]?.documentName,
        timestamp: new Date()
      };
    }

    return {
      entities: [...new Set(entities)].slice(0, 15),
      topics: [...new Set(topics)].slice(0, 5),
      keyFinding,
      referencedDocuments: sources.map(s => s.documentName)
    };
  }

  buildContextSummary(context: ConversationContext | null): string {
    if (!context || (context.entities.length === 0 && !context.lastQuery)) return '';

    let summary = '\n\n## 🧠 CONVERSATION CONTEXT\n\n';

    if (context.entities.length > 0) {
      summary += `**Key Entities**: ${context.entities.slice(0, 10).join(', ')}\n\n`;
    }
    if (context.documents.length > 0) {
      summary += `**Documents**: ${context.documents.slice(0, 5).join(', ')}\n\n`;
    }
    if (context.keyFindings.length > 0) {
      summary += '**Previous Findings**:\n';
      context.keyFindings.slice(-5).forEach(f => {
        summary += `- "${f.question.substring(0, 50)}..." → "${f.answer}"\n`;
      });
      summary += '\n';
    }
    if (context.lastQuery && context.lastAnswer) {
      summary += '**Last Exchange**:\n';
      summary += `User: "${context.lastQuery.substring(0, 150)}"\n`;
      summary += `You: "${context.lastAnswer.substring(0, 200)}"\n\n`;
    }
    summary += '**Reference Resolution**: When user says "it", "that", "this" → use entities above\n';
    return summary;
  }

  resolveReferences(query: string, context: ConversationContext | null): string {
    if (!context || !context.lastQuery) return query;

    const hasPronouns = /\b(it|that|this|they|them|its|their|those|these)\b/i.test(query);
    const hasImplicit = /\b(what about|how about|and|also|compare|same|more|else|another|other)\b/i.test(query);
    const isFollowUp = /^(and |but |also |why |how |what |so |then )/i.test(query.trim());

    if (!hasPronouns && !hasImplicit && !isFollowUp) return query;

    console.log(`🔗 [CONTEXT] Resolving refs in: "${query}"`);
    const hints: string[] = [];

    // ✅ FIX #2: Enhanced context resolution
    // Priority 1: Recent documents mentioned
    if (context.documents.length > 0) {
      hints.push(`document: ${context.documents[0]}`);
    }

    // Priority 2: Key entities (names, numbers, metrics)
    if (context.entities.length > 0) {
      const relevantEntities = context.entities
        .filter(e => e.includes(' ') || /^[A-Z]/.test(e) || /\d/.test(e))
        .slice(0, 3);
      if (relevantEntities.length > 0) {
        hints.push(`entities: ${relevantEntities.join(', ')}`);
      }
    }

    // Priority 3: Previous Q&A for follow-up questions
    if (context.lastQuery && context.lastAnswer) {
      // For "it", "that" pronouns - reference the previous answer subject
      if (/\b(it|that|this)\b/i.test(query)) {
        const prevTopic = context.lastQuery.replace(/^(what|how|why|when|where|who|show|list|find|get)\s+(is|are|was|were|the|me|about)?\s*/i, '').trim();
        if (prevTopic.length > 3 && prevTopic.length < 100) {
          hints.push(`"${query.match(/\b(it|that|this)\b/i)?.[0]}" refers to: ${prevTopic}`);
        }
      }
    }

    // Priority 4: Key findings for comparative questions
    if (/compare|same|different|versus|vs\.?|more|less/i.test(query) && context.keyFindings.length > 0) {
      const lastFinding = context.keyFindings.slice(-1)[0];
      if (lastFinding) {
        hints.push(`previous finding: ${lastFinding.answer}`);
      }
    }

    // Build expanded query
    if (hints.length > 0) {
      const expanded = `${query} [Previous context: ${hints.join('; ')}]`;
      console.log(`🔗 [CONTEXT] Expanded: "${expanded}"`);
      return expanded;
    }
    return query;
  }

  mergeContext(
    existing: ConversationContext | null,
    newCtx: ContextExtractionResult,
    userQuery: string,
    assistantAnswer: string
  ): ConversationContext {
    return {
      entities: [...new Set([...(newCtx.entities || []), ...(existing?.entities || [])])].slice(0, 20),
      topics: [...new Set([...(newCtx.topics || []), ...(existing?.topics || [])])].slice(0, 10),
      documents: [...new Set([...(newCtx.referencedDocuments || []), ...(existing?.documents || [])])].slice(0, 10),
      documentIds: existing?.documentIds || [],
      lastQuery: userQuery,
      lastAnswer: assistantAnswer.substring(0, 500),
      keyFindings: [...(existing?.keyFindings || []), ...(newCtx.keyFinding ? [newCtx.keyFinding] : [])].slice(-5),
      calculationResults: existing?.calculationResults || []
    };
  }

  createEmptyContext(): ConversationContext {
    return { entities: [], topics: [], documents: [], documentIds: [], lastQuery: '', lastAnswer: '', keyFindings: [], calculationResults: [] };
  }

  parseContextFromJson(json: string | null): ConversationContext | null {
    if (!json) return null;
    try {
      const p = JSON.parse(json);
      return {
        entities: p.entities || [], topics: p.topics || [], documents: p.documents || [],
        documentIds: p.documentIds || [], lastQuery: p.lastQuery || '', lastAnswer: p.lastAnswer || '',
        keyFindings: (p.keyFindings || []).map((f: any) => ({ ...f, timestamp: new Date(f.timestamp) })),
        calculationResults: p.calculationResults || []
      };
    } catch { return null; }
  }

  async updateContextAfterTurn(
    conversationId: string,
    userQuery: string,
    assistantAnswer: string,
    sources: Array<{ documentId: string; documentName: string }> = []
  ): Promise<ConversationContext> {
    console.log(`🧠 [CONTEXT] Updating for ${conversationId}`);

    // ✅ FIX #2: Skip context update for fallback/error responses
    // This prevents "couldn't find information" messages from polluting context
    if (isFallbackResponse(assistantAnswer)) {
      console.log(`⚠️ [CONTEXT] Skipping context update - detected fallback response`);
      const existing = await this.getContext(conversationId);
      return existing || this.createEmptyContext();
    }

    const existing = await this.getContext(conversationId);
    const extracted = await this.extractContext(userQuery, assistantAnswer, sources);
    const merged = this.mergeContext(existing, extracted, userQuery, assistantAnswer);
    this.saveContext(conversationId, merged).catch(e => console.error('Save failed:', e));
    console.log(`✅ [CONTEXT] Context updated successfully with ${merged.entities.length} entities`);
    return merged;
  }
}

export const conversationContextService = new ConversationContextService();
export default conversationContextService;
