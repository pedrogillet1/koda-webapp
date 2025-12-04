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

    const hasPronouns = /\b(it|that|this|they|them|its|their)\b/i.test(query);
    const hasImplicit = /\b(what about|how about|and|also|compare)\b/i.test(query);
    if (!hasPronouns && !hasImplicit) return query;

    console.log(`🔗 [CONTEXT] Resolving refs in: "${query}"`);
    const hints: string[] = [];

    if (context.documents.length > 0) hints.push(`regarding: ${context.documents[0]}`);
    else if (context.entities.length > 0) {
      const e = context.entities.find(x => x.includes(' ') || /^[A-Z]/.test(x));
      if (e) hints.push(`regarding: ${e}`);
    }

    if (/compare|about/i.test(query) && context.keyFindings.length > 0) {
      hints.push(`previous: ${context.keyFindings.slice(-1)[0].answer}`);
    }

    if (hints.length > 0) {
      const expanded = `${query} [Context: ${hints.join(', ')}]`;
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
    const existing = await this.getContext(conversationId);
    const extracted = await this.extractContext(userQuery, assistantAnswer, sources);
    const merged = this.mergeContext(existing, extracted, userQuery, assistantAnswer);
    this.saveContext(conversationId, merged).catch(e => console.error('Save failed:', e));
    return merged;
  }
}

export const conversationContextService = new ConversationContextService();
export default conversationContextService;
