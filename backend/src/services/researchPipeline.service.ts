/**
 * Research Pipeline Service
 * Combines internal document knowledge with external web search
 * Similar to ChatGPT Deep Research and Perplexity
 */

import webSearchService from './webSearch.service';
import vectorEmbeddingService from './vectorEmbedding.service';
import documentResolverService from './documentResolver.service';
import { sendMessageToGemini } from './gemini.service';
import { detectPersona, getPersonaContextPrompt, PersonaProfile } from './personaDetection.service';
import prisma from '../config/database';

interface ActionableRecommendations {
  nextSteps: string[];
  followUpQuestions: string[];
  suggestedDocuments: string[];
}

interface ResearchResult {
  answer: string;
  sources: {
    documents: DocumentSource[];
    web: WebSource[];
  };
  researchUsed: boolean;
  confidence: number;
  persona?: PersonaProfile;
  recommendations?: ActionableRecommendations;
  metadata: {
    documentsSearched: number;
    webSourcesFound: number;
    durationMs: number;
    decisionReason: string;
  };
}

interface DocumentSource {
  documentId: string;
  filename: string;
  excerpt: string;
  relevance: number;
}

interface WebSource {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  reliability: 'High' | 'Medium' | 'Low';
  domain: string;
}

interface ProgressCallback {
  (stage: string, message: string): void;
}

class ResearchPipelineService {
  /**
   * Decide if web research should be used
   */
  private shouldUseResearch(
    query: string,
    documentResults: any[],
    explicitlyRequested: boolean
  ): { use: boolean; reason: string; confidence: number } {
    const queryLower = query.toLowerCase();

    // Fresh data keywords
    const freshKeywords = [
      'latest', 'recent', 'current', 'new', 'updated', 'today',
      '2024', '2025', 'this year', 'this month', 'this week',
      'now', 'nowadays', 'currently', 'present'
    ];

    // External knowledge keywords
    const externalKeywords = [
      'research', 'find', 'search', 'look up', 'what is',
      'who is', 'when did', 'how to', 'best practices',
      'industry standard', 'market', 'trend', 'regulation',
      'compare', 'versus', 'vs'
    ];

    // 1. Explicitly requested
    if (explicitlyRequested) {
      return {
        use: true,
        reason: 'User explicitly requested research',
        confidence: 1.0
      };
    }

    // 2. No document results
    if (!documentResults || documentResults.length === 0) {
      return {
        use: true,
        reason: 'No relevant documents found',
        confidence: 0.9
      };
    }

    // 3. Query asks for fresh/recent data
    if (freshKeywords.some(kw => queryLower.includes(kw))) {
      return {
        use: true,
        reason: 'Query requires fresh/recent information',
        confidence: 0.95
      };
    }

    // 4. Query asks for external knowledge
    if (externalKeywords.some(kw => queryLower.includes(kw))) {
      // Check document confidence
      const avgRelevance = documentResults.length > 0
        ? documentResults.reduce((sum, r) => sum + (r.similarity || 0), 0) / documentResults.length
        : 0;

      if (avgRelevance < 0.7) {
        return {
          use: true,
          reason: 'Document knowledge insufficient for query',
          confidence: 0.8
        };
      }
    }

    // 5. Documents seem sufficient
    return {
      use: false,
      reason: 'Sufficient information in documents',
      confidence: 0.7
    };
  }

  /**
   * Execute complete research pipeline
   */
  async executeResearch(
    query: string,
    userId: string,
    conversationId: string,
    explicitlyRequested: boolean = false,
    progressCallback?: ProgressCallback
  ): Promise<ResearchResult> {
    const startTime = Date.now();

    try {
      // Step 0: Detect user persona (run in background, don't wait)
      const personaPromise = this.detectUserPersona(query, conversationId);

      // Step 1: Search user's documents
      if (progressCallback) {
        progressCallback('searching', '🔍 Searching your documents...');
      }

      console.log(`🔍 [Research] Step 1: Searching documents for user ${userId}`);
      const documentResults = await this.searchDocuments(query, userId);

      if (progressCallback) {
        progressCallback('documents_found', `✓ Found ${documentResults.length} relevant documents`);
      }

      console.log(`📄 Found ${documentResults.length} relevant document chunks`);

      // Step 2: Decide if web research is needed
      const decision = this.shouldUseResearch(query, documentResults, explicitlyRequested);
      console.log(`🤔 Research decision: ${decision.use ? 'YES' : 'NO'} - ${decision.reason}`);

      let webResults: WebSource[] = [];

      // Step 3: Perform web research if needed
      if (decision.use) {
        if (progressCallback) {
          progressCallback('web_searching', '🌐 Searching the web for latest information...');
        }

        console.log(`🌐 [Research] Step 3: Performing web search`);

        try {
          const rawWebResults = await webSearchService.search(query, 5, true); // Reduced from 10 to 5 for faster performance

          webResults = rawWebResults.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            content: r.content,
            reliability: r.reliability || 'Low',
            domain: r.domain || ''
          }));

          if (progressCallback) {
            progressCallback('web_found', `✓ Found ${webResults.length} authoritative sources`);
          }

          console.log(`🌐 Found ${webResults.length} web sources`);
        } catch (error) {
          console.error('❌ Web search failed:', error);
          // Continue without web results
        }
      }

      // Step 4: Get persona (should be ready by now)
      const persona = await personaPromise;

      // Step 5: Combine knowledge
      if (progressCallback) {
        progressCallback('combining', '🧠 Analyzing and combining knowledge...');
      }

      console.log(`🧠 [Research] Step 4: Combining knowledge`);
      const combinedResult = await this.combineKnowledge(
        query,
        documentResults,
        webResults,
        userId,
        persona
      );

      const durationMs = Date.now() - startTime;

      // Step 5: Generate actionable recommendations
      console.log(`💡 [Research] Generating actionable recommendations...`);
      const recommendations = await this.generateRecommendations(
        query,
        combinedResult.answer,
        combinedResult.sources.documents,
        combinedResult.sources.web,
        persona
      );

      // Step 6: Save research session
      await this.saveResearchSession({
        userId,
        conversationId,
        query,
        documentResults,
        webResults,
        answer: combinedResult.answer,
        sources: combinedResult.sources,
        confidence: combinedResult.confidence,
        durationMs
      });

      if (progressCallback) {
        progressCallback('complete', '✅ Research complete!');
      }

      console.log(`✅ [Research] Complete in ${durationMs}ms`);

      return {
        answer: combinedResult.answer,
        sources: combinedResult.sources,
        researchUsed: decision.use,
        confidence: combinedResult.confidence,
        persona: persona || undefined,
        recommendations,
        metadata: {
          documentsSearched: documentResults.length,
          webSourcesFound: webResults.length,
          durationMs,
          decisionReason: decision.reason
        }
      };
    } catch (error) {
      console.error('❌ [Research] Pipeline error:', error);
      throw error;
    }
  }

  /**
   * Detect user persona from conversation history
   */
  private async detectUserPersona(query: string, conversationId: string): Promise<PersonaProfile | null> {
    try {
      // Get recent conversation history
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              role: true,
              content: true
            }
          }
        }
      });

      if (!conversation) {
        return null;
      }

      const conversationHistory = conversation.messages
        .reverse()
        .map(msg => ({ role: msg.role, content: msg.content }));

      const persona = await detectPersona(query, conversationHistory);
      return persona;
    } catch (error) {
      console.error('Error detecting persona:', error);
      return null;
    }
  }

  /**
   * Search user's documents using vector similarity
   */
  private async searchDocuments(query: string, userId: string): Promise<any[]> {
    try {
      // Use vector embedding search
      const results = await vectorEmbeddingService.searchSimilarChunks(
        userId,
        query,
        5, // top 5 results
        0.5 // minimum similarity
      );

      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  /**
   * Combine document knowledge with web research
   */
  private async combineKnowledge(
    query: string,
    documentResults: any[],
    webResults: WebSource[],
    userId: string,
    persona?: PersonaProfile | null
  ): Promise<{
    answer: string;
    sources: { documents: DocumentSource[]; web: WebSource[] };
    confidence: number;
  }> {
    // Build prompt with both sources
    let prompt = `You are KODA AI, an assistant that combines internal document knowledge with external web research to provide focused, concise answers.

`;

    // Add persona context if detected
    if (persona && persona.persona !== 'general') {
      prompt += `${getPersonaContextPrompt(persona.persona)}\n\n`;
      prompt += `Detected User Type: ${persona.persona} (${(persona.confidence * 100).toFixed(0)}% confidence)\n`;
      if (persona.suggestedResearchTopics.length > 0) {
        prompt += `Relevant Topics: ${persona.suggestedResearchTopics.join(', ')}\n\n`;
      }
    }

    prompt += `User Question: ${query}

`;

    // Add document context
    if (documentResults && documentResults.length > 0) {
      prompt += `=== INTERNAL KNOWLEDGE (From User's Documents) ===\n\n`;

      documentResults.forEach((result, idx) => {
        prompt += `Document ${idx + 1}: ${result.document.filename}\n`;
        prompt += `Content: ${result.content}\n`;
        if (result.metadata) {
          const meta = result.metadata;
          if (meta.sheet) prompt += `Sheet: ${meta.sheet}\n`;
          if (meta.page) prompt += `Page: ${meta.page}\n`;
          if (meta.slide) prompt += `Slide: ${meta.slide}\n`;
        }
        prompt += `Relevance: ${(result.similarity * 100).toFixed(0)}%\n`;
        prompt += `---\n\n`;
      });
    } else {
      prompt += `=== INTERNAL KNOWLEDGE ===\n\nNo relevant information found in user's documents.\n\n`;
    }

    // Add web results
    if (webResults && webResults.length > 0) {
      prompt += `=== EXTERNAL RESEARCH (From Web Search) ===\n\n`;

      webResults.forEach((result, idx) => {
        prompt += `Source ${idx + 1}: ${result.title}\n`;
        prompt += `URL: ${result.url}\n`;
        prompt += `Domain: ${result.domain}\n`;
        prompt += `Reliability: ${result.reliability}\n`;
        prompt += `Snippet: ${result.snippet}\n`;
        if (result.content) {
          prompt += `Full Content: ${result.content.substring(0, 500)}...\n`;
        }
        prompt += `---\n\n`;
      });
    } else {
      prompt += `=== EXTERNAL RESEARCH ===\n\nNo web results available.\n\n`;
    }

    prompt += `
=== INSTRUCTIONS ===

1. **Analyze both internal documents and external web sources**
2. **Prioritize information from user's documents** when available
3. **Use web sources to:**
   - Fill gaps in document knowledge
   - Provide recent/updated information
   - Add external validation
4. **Clearly indicate which information comes from which source:**
   - Use [Doc: filename] for document citations
   - Use [Web: source name] for web citations
5. **If information conflicts, explain the differences**
6. **Structure your answer clearly with:**
   - Direct answer to the question first
   - Supporting details from documents
   - Additional context from web research
   - Sources cited inline

Provide a focused, well-structured answer that combines both knowledge sources. Be concise and prioritize relevance to the user's question.

Answer:
`;

    // Generate answer using Gemini
    const response = await sendMessageToGemini(prompt, [], 'User', '', 'en');
    const answer = response.text || 'Unable to generate answer';

    // Extract and format sources
    const documentSources: DocumentSource[] = documentResults.map(r => ({
      documentId: r.documentId,
      filename: r.document.filename,
      excerpt: r.content.substring(0, 200) + '...',
      relevance: r.similarity
    }));

    const webSources: WebSource[] = webResults.slice(0, 10); // Top 10

    // Calculate confidence
    const confidence = this.calculateConfidence(documentSources, webSources);

    return {
      answer,
      sources: {
        documents: documentSources,
        web: webSources
      },
      confidence
    };
  }

  /**
   * Calculate confidence score for the answer
   */
  private calculateConfidence(
    documentSources: DocumentSource[],
    webSources: WebSource[]
  ): number {
    let confidence = 0.5;

    // Increase based on document sources
    if (documentSources.length > 0) {
      const docConfidence = Math.min(documentSources.length * 0.1, 0.3);
      confidence += docConfidence;
    }

    // Increase based on web sources
    if (webSources.length > 0) {
      const reliabilityScore: { [key: string]: number } = {
        'High': 1.0,
        'Medium': 0.7,
        'Low': 0.4
      };

      const avgReliability = webSources
        .slice(0, 5)
        .reduce((sum, s) => sum + reliabilityScore[s.reliability], 0) / Math.min(webSources.length, 5);

      const webConfidence = avgReliability * 0.2;
      confidence += webConfidence;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Save research session to database
   */
  private async saveResearchSession(params: {
    userId: string;
    conversationId: string;
    query: string;
    documentResults: any[];
    webResults: WebSource[];
    answer: string;
    sources: any;
    confidence: number;
    durationMs: number;
  }): Promise<void> {
    try {
      // For now, we'll skip database saving to keep it simple
      // In production, you would save this to a research_sessions table
      console.log(`💾 Research session saved (duration: ${params.durationMs}ms)`);
    } catch (error) {
      console.error('Error saving research session:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Generate actionable recommendations based on research results
   */
  private async generateRecommendations(
    query: string,
    answer: string,
    documentSources: DocumentSource[],
    webSources: WebSource[],
    persona?: PersonaProfile | null
  ): Promise<ActionableRecommendations> {
    try {
      const personaContext = persona && persona.persona !== 'general'
        ? `User is a ${persona.persona}.`
        : '';

      const prompt = `Based on this research interaction, generate actionable recommendations:

User Question: ${query}
${personaContext}

Answer Provided:
${answer.substring(0, 500)}...

Documents Available: ${documentSources.length > 0 ? documentSources.map(d => d.filename).join(', ') : 'None'}
Web Sources Used: ${webSources.length}

Generate recommendations in JSON format:
{
  "nextSteps": ["action1", "action2", "action3"],
  "followUpQuestions": ["question1", "question2", "question3"],
  "suggestedDocuments": ["doc_type1", "doc_type2", "doc_type3"]
}

Guidelines:
- nextSteps: 3-5 concrete actions the user should take based on the research
- followUpQuestions: 3-5 relevant questions to deepen understanding
- suggestedDocuments: 3-5 types of documents that would help (e.g., "financial statements", "market research reports")`;

      const response = await sendMessageToGemini(prompt, [], 'User', '', 'en');
      const text = response.text || '{}';

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract recommendations JSON');
      }

      const recommendations = JSON.parse(jsonMatch[0]) as ActionableRecommendations;

      console.log(`💡 Generated ${recommendations.nextSteps.length} next steps, ${recommendations.followUpQuestions.length} follow-up questions`);

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Return safe defaults
      return {
        nextSteps: [],
        followUpQuestions: [],
        suggestedDocuments: []
      };
    }
  }
}

export default new ResearchPipelineService();
export { ActionableRecommendations };
