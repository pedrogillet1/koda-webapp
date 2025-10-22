import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Terminology Expansion Service
 * Expands queries with domain-specific synonyms for better semantic search
 */
class TerminologyService {
  // Common business terminology mappings
  private readonly defaultTerminology: Record<string, string[]> = {
    // Financial terms
    'revenue': ['income', 'earnings', 'sales', 'receipts', 'proceeds', 'turnover'],
    'profit': ['earnings', 'gain', 'surplus', 'net income', 'margin', 'bottom line'],
    'expense': ['cost', 'expenditure', 'spending', 'outlay', 'charge', 'overhead'],
    'budget': ['allocation', 'financial plan', 'spending plan', 'forecast', 'projection'],

    // Competitive Analysis & Benchmarking
    'benchmark': ['comparison', 'standard', 'baseline', 'metric', 'KPI', 'performance indicator', 'target', 'goal', 'milestone'],
    'competitor': ['rival', 'competition', 'market player', 'alternative', 'peer company', 'industry player'],
    'compare': ['benchmark against', 'measure against', 'contrast with', 'evaluate versus', 'stack up against', 'analyze against'],
    'market share': ['market position', 'market penetration', 'market presence', 'competitive position'],
    'competitive advantage': ['edge', 'differentiation', 'unique value', 'strategic advantage', 'moat'],
    'market analysis': ['competitive analysis', 'industry analysis', 'market research', 'market assessment'],

    // Startup & Business Metrics
    'growth rate': ['growth trajectory', 'expansion rate', 'scaling velocity', 'year-over-year growth', 'YoY growth'],
    'user acquisition': ['customer acquisition', 'user growth', 'customer onboarding', 'new users', 'signups'],
    'retention': ['user retention', 'customer retention', 'churn rate', 'loyalty', 'stickiness'],
    'valuation': ['company value', 'market cap', 'enterprise value', 'worth', 'funding round value'],
    'traction': ['momentum', 'growth', 'adoption', 'market fit', 'user engagement'],

    // Legal terms
    'contract': ['agreement', 'covenant', 'compact', 'deal', 'arrangement', 'terms'],
    'clause': ['provision', 'article', 'section', 'stipulation', 'term', 'condition'],
    'obligation': ['duty', 'commitment', 'responsibility', 'requirement', 'liability'],

    // HR terms
    'employee': ['worker', 'staff', 'personnel', 'team member', 'associate', 'hire'],
    'salary': ['wage', 'compensation', 'pay', 'remuneration', 'earnings', 'income'],
    'benefits': ['perks', 'compensation package', 'employee benefits', 'fringe benefits'],

    // General business
    'client': ['customer', 'patron', 'buyer', 'purchaser', 'account', 'user'],
    'meeting': ['conference', 'discussion', 'session', 'gathering', 'assembly', 'call'],
    'project': ['initiative', 'undertaking', 'venture', 'program', 'task', 'effort'],
    'deadline': ['due date', 'time limit', 'cutoff', 'target date', 'completion date', 'timeline'],
    'strategy': ['plan', 'approach', 'roadmap', 'vision', 'direction', 'game plan'],
    'goal': ['objective', 'target', 'milestone', 'aim', 'ambition', 'KPI'],

    // Technical terms
    'document': ['file', 'record', 'paper', 'report', 'form', 'doc'],
    'data': ['information', 'facts', 'statistics', 'figures', 'details', 'metrics'],
    'system': ['platform', 'infrastructure', 'framework', 'application', 'software', 'solution'],
    'feature': ['capability', 'functionality', 'function', 'tool', 'offering', 'product feature'],
    'integration': ['connection', 'interface', 'API', 'sync', 'linkage', 'interoperability'],
  };

  /**
   * Expand a query with synonyms and related terms
   * @param userId - User ID
   * @param query - Original query
   * @returns Array of expansion terms
   */
  async expandQuery(userId: string, query: string): Promise<string[]> {
    try {
      const queryLower = query.toLowerCase();
      const expansionTerms: Set<string> = new Set();

      // Step 1: Check user's custom terminology maps
      const userTerminology = await prisma.terminologyMap.findMany({
        where: { userId }
      });

      userTerminology.forEach(term => {
        if (queryLower.includes(term.term.toLowerCase())) {
          const synonyms = JSON.parse(term.synonyms) as string[];
          synonyms.forEach(syn => expansionTerms.add(syn));
        }
      });

      // Step 2: Check default terminology
      Object.entries(this.defaultTerminology).forEach(([term, synonyms]) => {
        if (queryLower.includes(term.toLowerCase())) {
          synonyms.forEach(syn => expansionTerms.add(syn));
        }
      });

      // Step 3: Use Gemini for intelligent expansion (if no matches found)
      if (expansionTerms.size === 0) {
        const aiExpansion = await this.expandWithAI(query);
        aiExpansion.forEach(term => expansionTerms.add(term));
      }

      const result = Array.from(expansionTerms);
      console.log(`🔤 Expanded "${query}" with: ${result.join(', ')}`);

      return result;
    } catch (error) {
      console.error('Error expanding query:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Use Gemini to intelligently expand query
   * @param query - Original query
   * @returns Array of related terms
   */
  private async expandWithAI(query: string): Promise<string[]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a business terminology expert. Analyze this search query and suggest semantic alternatives.

Query: "${query}"

Task: Suggest 5-7 alternative terms, phrases, or concepts that could help find relevant information.

Important Rules:
1. Think about the MEANING, not just synonyms (e.g., "benchmark" could mean "comparison", "metric", "KPI", "performance indicator", "target", "standard")
2. Include related concepts (e.g., "competitor analysis" relates to "market share", "competitive advantage", "industry comparison")
3. Consider business context (e.g., startup metrics, financial terms, market analysis)
4. Include plural/singular variations if relevant
5. Focus on terms that would appear in business documents

Examples:
Query: "quarterly revenue"
Response: quarterly earnings, Q1 income, 3-month sales, revenue per quarter, quarterly financial performance

Query: "compare competitors"
Response: competitive analysis, market comparison, competitor benchmarking, rival performance, industry peers, competitive landscape

Query: "user growth"
Response: customer acquisition, user base expansion, signup rate, adoption metrics, user traction, monthly active users, user adoption

Format: Return ONLY a comma-separated list of 5-7 terms, no explanations.

Your response for "${query}":`;

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      // Parse the comma-separated response
      const terms = response
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length < 50) // Sanity check
        .slice(0, 5); // Max 5 terms

      return terms;
    } catch (error) {
      console.error('Error in AI expansion:', error);
      return [];
    }
  }

  /**
   * Add custom terminology for a user
   * @param userId - User ID
   * @param term - Main term
   * @param synonyms - Array of synonyms
   * @param domain - Domain (e.g., "banking", "legal", "general")
   */
  async addTerminology(
    userId: string,
    term: string,
    synonyms: string[],
    domain: string = 'general'
  ): Promise<void> {
    try {
      await prisma.terminologyMap.upsert({
        where: {
          userId_term_domain: {
            userId,
            term: term.toLowerCase(),
            domain
          }
        },
        update: {
          synonyms: JSON.stringify(synonyms)
        },
        create: {
          userId,
          term: term.toLowerCase(),
          synonyms: JSON.stringify(synonyms),
          domain
        }
      });

      console.log(`✅ Added terminology: ${term} -> [${synonyms.join(', ')}]`);
    } catch (error) {
      console.error('Error adding terminology:', error);
      throw error;
    }
  }

  /**
   * Get user's custom terminology
   * @param userId - User ID
   * @param domain - Optional domain filter
   * @returns Array of terminology maps
   */
  async getUserTerminology(userId: string, domain?: string) {
    try {
      const where: any = { userId };
      if (domain) {
        where.domain = domain;
      }

      const terminology = await prisma.terminologyMap.findMany({
        where,
        orderBy: { term: 'asc' }
      });

      return terminology.map(t => ({
        id: t.id,
        term: t.term,
        synonyms: JSON.parse(t.synonyms) as string[],
        domain: t.domain,
        createdAt: t.createdAt
      }));
    } catch (error) {
      console.error('Error getting user terminology:', error);
      throw error;
    }
  }

  /**
   * Delete terminology
   * @param userId - User ID
   * @param terminologyId - Terminology ID
   */
  async deleteTerminology(userId: string, terminologyId: string): Promise<void> {
    try {
      await prisma.terminologyMap.delete({
        where: {
          id: terminologyId,
          userId // Ensure user owns this terminology
        }
      });

      console.log(`🗑️ Deleted terminology: ${terminologyId}`);
    } catch (error) {
      console.error('Error deleting terminology:', error);
      throw error;
    }
  }

  /**
   * Learn terminology from user's documents
   * Uses Gemini to extract domain-specific terms from uploaded documents
   * @param userId - User ID
   * @param documentText - Document text
   * @param domain - Document domain
   */
  async learnFromDocument(
    userId: string,
    documentText: string,
    domain: string = 'general'
  ): Promise<void> {
    try {
      // Only process first 5000 characters to avoid token limits
      const sample = documentText.substring(0, 5000);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analyze this document excerpt and identify 5-10 key domain-specific terms with their synonyms.

Document excerpt:
${sample}

Return a JSON array of terminology mappings in this format:
[
  {"term": "main term", "synonyms": ["synonym1", "synonym2", "synonym3"]},
  ...
]

Focus on business, technical, or domain-specific terms. Skip common words.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const terminology = JSON.parse(jsonMatch[0]);

        // Add each term to user's terminology
        for (const item of terminology) {
          if (item.term && item.synonyms && Array.isArray(item.synonyms)) {
            await this.addTerminology(userId, item.term, item.synonyms, domain);
          }
        }

        console.log(`📚 Learned ${terminology.length} terms from document`);
      }
    } catch (error) {
      console.error('Error learning from document:', error);
      // Don't throw - this is a background enhancement
    }
  }

  /**
   * Get default terminology dictionary
   * @returns Default terminology mappings
   */
  getDefaultTerminology(): Record<string, string[]> {
    return { ...this.defaultTerminology };
  }
}

export default new TerminologyService();
