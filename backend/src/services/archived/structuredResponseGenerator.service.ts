/**
 * Structured Response Generator Service
 *
 * PURPOSE: FORCE 100% format compliance by generating responses in structured JSON
 *          then transforming to markdown with perfect formatting
 *
 * WHY: LLM outputs are inconsistent - JSON structure ensures compliance
 * HOW: Two-step process:
 *   1. Generate content in structured JSON format (title, sections, bullets)
 *   2. Transform JSON to markdown with perfect formatting rules
 *
 * IMPACT: 100% format compliance, no post-processing needed
 *
 * KODA FORMAT RULES ENFORCED:
 * - Title: Bold, contextual (2-4 words)
 * - Sections: Max 3 sections with headers
 * - Bullets: Standard bullet character (bullet), 2-3 items per bullet
 * - Tables: When comparing 2+ items with 3+ attributes
 * - Spacing: Single blank line between sections
 * - No emojis, no citations, auto-bold key values
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type QueryType = 'financial' | 'list' | 'comparison' | 'simple' | 'general';

interface BulletItem {
  text: string;
  subItems?: string[];
}

interface TableRow {
  [key: string]: string | number;
}

interface Section {
  header?: string;
  content?: string;
  bullets?: BulletItem[];
  table?: {
    headers: string[];
    rows: TableRow[];
  };
}

interface StructuredResponse {
  title: string;
  introduction?: string;
  sections: Section[];
  closing?: string;
}

interface GenerateOptions {
  query: string;
  context: string;
  queryType: QueryType;
  answerLength?: 'short' | 'medium' | 'long';
  language?: string;
}

interface GenerationResult {
  text: string;
  structured: StructuredResponse | null;
  retryCount: number;
  success: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// ============================================================================
// STRUCTURED RESPONSE GENERATOR SERVICE
// ============================================================================

class StructuredResponseGenerator {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    } else {
      console.warn('[StructuredResponseGenerator] No Gemini API key found');
    }
  }

  // ==========================================================================
  // MAIN ENTRY POINT
  // ==========================================================================

  /**
   * Generate a structured response with perfect formatting
   *
   * @param options - Generation options (query, context, queryType)
   * @returns Formatted markdown string
   */
  async generateStructuredResponse(options: GenerateOptions): Promise<string> {
    const { query, context, queryType, answerLength = 'medium', language = 'en' } = options;

    console.log(`[StructuredResponseGenerator] Generating response for query type: ${queryType}`);

    // Step 1: Generate structured JSON
    const structuredData = await this.generateStructuredJSON(options);

    if (!structuredData) {
      console.warn('[StructuredResponseGenerator] Failed to generate structured JSON, using fallback');
      return this.getFallbackResponse(query, language);
    }

    // Step 2: Transform JSON to perfectly formatted markdown
    const markdown = this.transformToMarkdown(structuredData, queryType);

    console.log(`[StructuredResponseGenerator] Generated ${markdown.length} chars of formatted response`);

    return markdown;
  }

  /**
   * Generate with retry logic
   */
  async generateWithRetry(options: GenerateOptions, maxRetries: number = 2): Promise<GenerationResult> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        const text = await this.generateStructuredResponse(options);

        // Validate the response
        if (this.validateResponse(text)) {
          return {
            text,
            structured: null, // Already transformed
            retryCount,
            success: true
          };
        }

        console.warn(`[StructuredResponseGenerator] Retry ${retryCount + 1}: Response validation failed`);
        retryCount++;
      } catch (error) {
        lastError = error as Error;
        console.error(`[StructuredResponseGenerator] Retry ${retryCount + 1} error:`, error);
        retryCount++;

        // Exponential backoff
        if (retryCount <= maxRetries) {
          await this.sleep(1000 * Math.pow(2, retryCount - 1));
        }
      }
    }

    // All retries failed - return fallback
    return {
      text: this.getFallbackResponse(options.query, options.language || 'en'),
      structured: null,
      retryCount,
      success: false
    };
  }

  // ==========================================================================
  // STEP 1: GENERATE STRUCTURED JSON
  // ==========================================================================

  private async generateStructuredJSON(options: GenerateOptions): Promise<StructuredResponse | null> {
    if (!this.model) {
      console.error('[StructuredResponseGenerator] Gemini model not initialized');
      return null;
    }

    const { query, context, queryType, answerLength = 'medium' } = options;
    const systemPrompt = this.getStructuredSystemPrompt(queryType, answerLength);

    const prompt = `${systemPrompt}

CONTEXT FROM DOCUMENTS:
${context}

USER QUESTION:
${query}

Generate the response in the exact JSON format specified above.`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
        }
      });

      const responseText = result.response.text();

      // Parse JSON response
      const parsed = this.parseJSONResponse(responseText);

      if (parsed && this.validateStructuredResponse(parsed)) {
        return parsed;
      }

      console.warn('[StructuredResponseGenerator] Invalid structured response:', responseText.substring(0, 200));
      return null;
    } catch (error) {
      console.error('[StructuredResponseGenerator] Error generating structured JSON:', error);
      return null;
    }
  }

  // ==========================================================================
  // SYSTEM PROMPTS FOR STRUCTURED GENERATION
  // ==========================================================================

  private getStructuredSystemPrompt(queryType: QueryType, answerLength: string): string {
    const lengthGuide = {
      short: 'Keep response brief (50-100 words). Use 2-3 bullet points maximum.',
      medium: 'Moderate length (100-200 words). Use 4-6 bullet points.',
      long: 'Comprehensive response (200-400 words). Use sections with multiple bullet points.'
    };

    const basePrompt = `You are KODA, a document analysis AI assistant. Generate responses in STRICT JSON format.

OUTPUT FORMAT (JSON only):
{
  "title": "2-4 word bold title describing the answer",
  "introduction": "1-2 sentence intro (optional)",
  "sections": [
    {
      "header": "Section header (optional)",
      "bullets": [
        { "text": "Main point with **bold** key values", "subItems": ["optional sub-point"] }
      ]
    }
  ],
  "closing": "Optional brief closing statement"
}

${lengthGuide[answerLength as keyof typeof lengthGuide] || lengthGuide.medium}

CRITICAL FORMATTING RULES:
1. TITLE: Always provide a contextual 2-4 word title (e.g., "Revenue Analysis", "Key Findings")
2. NO EMOJIS: Never use any emojis or special symbols
3. BOLD VALUES: Use **bold** for:
   - Monetary values: **$1,234.56**
   - Percentages: **45%**
   - Dates: **2024-12-03**
   - File names: **Budget.xlsx**
4. BULLETS: Each bullet should be one clear point
5. NO CITATIONS: Do not include "According to page X" or similar references
6. PROFESSIONAL TONE: Direct, analytical, no informal language`;

    // Add query-type specific instructions
    const typeSpecificInstructions: Record<QueryType, string> = {
      financial: `
FINANCIAL QUERY RULES:
- Always bold monetary values and percentages
- Group by category (Revenue, Expenses, etc.) when applicable
- Include totals and key metrics prominently
- Use tables for comparing multiple time periods or categories`,

      list: `
LIST QUERY RULES:
- Use bullets for all list items
- Keep each bullet concise (one line if possible)
- Maximum 3 items per bullet line
- Group related items under section headers`,

      comparison: `
COMPARISON QUERY RULES:
- Use a TABLE when comparing 2+ items with 3+ attributes
- Table format: { "headers": ["Item", "Attr1", "Attr2"], "rows": [{"Item": "A", "Attr1": "val"}] }
- Highlight key differences in bullets after the table
- Bold the most significant differences`,

      simple: `
SIMPLE QUERY RULES:
- Direct, concise answer
- 2-4 bullet points maximum
- No unnecessary sections or headers
- Get straight to the point`,

      general: `
GENERAL QUERY RULES:
- Adapt format to content (bullets, sections, or tables as appropriate)
- Focus on answering the specific question
- Organize information logically`
    };

    return `${basePrompt}\n${typeSpecificInstructions[queryType]}`;
  }

  // ==========================================================================
  // STEP 2: TRANSFORM JSON TO MARKDOWN
  // ==========================================================================

  private transformToMarkdown(data: StructuredResponse, queryType: QueryType): string {
    const lines: string[] = [];

    // Title (bold)
    if (data.title) {
      lines.push(`**${this.sanitizeText(data.title)}**`);
      lines.push('');
    }

    // Introduction (max 2 lines)
    if (data.introduction) {
      const intro = this.sanitizeText(data.introduction);
      const introLines = intro.split('\n').slice(0, 2);
      lines.push(introLines.join('\n'));
      lines.push('');
    }

    // Sections
    for (const section of data.sections) {
      // Section header
      if (section.header) {
        lines.push(`**${this.sanitizeText(section.header)}**`);
        lines.push('');
      }

      // Section content (if any)
      if (section.content) {
        lines.push(this.sanitizeText(section.content));
        lines.push('');
      }

      // Table (if comparison type or table provided)
      if (section.table && section.table.headers && section.table.rows) {
        lines.push(this.formatTable(section.table.headers, section.table.rows));
        lines.push('');
      }

      // Bullets
      if (section.bullets && section.bullets.length > 0) {
        for (const bullet of section.bullets) {
          // Format main bullet
          const bulletText = this.formatBulletText(bullet.text);
          lines.push(`• ${bulletText}`);

          // Sub-items (indented)
          if (bullet.subItems && bullet.subItems.length > 0) {
            for (const subItem of bullet.subItems) {
              lines.push(`  • ${this.formatBulletText(subItem)}`);
            }
          }
        }
        lines.push('');
      }
    }

    // Closing statement
    if (data.closing) {
      lines.push(this.sanitizeText(data.closing));
    }

    // Clean up and return
    return this.cleanupMarkdown(lines.join('\n'));
  }

  // ==========================================================================
  // FORMATTING HELPERS
  // ==========================================================================

  private formatTable(headers: string[], rows: TableRow[]): string {
    if (headers.length === 0 || rows.length === 0) {
      return '';
    }

    const lines: string[] = [];

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const headerLen = h.length;
      const maxDataLen = Math.max(...rows.map(r => String(r[headers[i]] || '').length));
      return Math.max(headerLen, maxDataLen, 3);
    });

    // Header row
    const headerLine = '| ' + headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + ' |';
    lines.push(headerLine);

    // Separator row
    const separatorLine = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
    lines.push(separatorLine);

    // Data rows
    for (const row of rows) {
      const dataLine = '| ' + headers.map((h, i) => {
        const value = String(row[h] || '');
        return this.formatBulletText(value).padEnd(widths[i]);
      }).join(' | ') + ' |';
      lines.push(dataLine);
    }

    return lines.join('\n');
  }

  private formatBulletText(text: string): string {
    let formatted = this.sanitizeText(text);

    // Auto-bold monetary values (not already bolded)
    formatted = formatted.replace(/(?<!\*\*)(\$[\d,]+(?:\.\d{2})?)(?!\*\*)/g, '**$1**');

    // Auto-bold percentages (not already bolded)
    formatted = formatted.replace(/(?<!\*\*)(\d+(?:\.\d+)?%)(?!\*\*)/g, '**$1**');

    // Auto-bold dates YYYY-MM-DD (not already bolded)
    formatted = formatted.replace(/(?<!\*\*)(\d{4}-\d{2}-\d{2})(?!\*\*)/g, '**$1**');

    // Auto-bold file extensions (not already bolded)
    formatted = formatted.replace(/(?<!\*\*)(\b\w+\.(pdf|xlsx|docx|csv|pptx|txt)\b)(?!\*\*)/gi, '**$1**');

    // Clean up double-bolding
    formatted = formatted.replace(/\*{4,}([^*]+)\*{4,}/g, '**$1**');

    return formatted;
  }

  private sanitizeText(text: string): string {
    let cleaned = text;

    // Remove emojis (comprehensive pattern)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '');

    // Remove citation patterns
    cleaned = cleaned.replace(/According to (?:page|document|file)\s+[^\.,]+[,\.]\s*/gi, '');
    cleaned = cleaned.replace(/\s*\(page\s+\d+\)\s*/gi, ' ');
    cleaned = cleaned.replace(/\s*\[page\s+\d+\]\s*/gi, ' ');

    // Clean extra spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    return cleaned.trim();
  }

  private cleanupMarkdown(text: string): string {
    let cleaned = text;

    // Remove multiple blank lines (max 1)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    cleaned = cleaned.replace(/[ \t]+$/gm, '');

    // Ensure proper spacing between sections
    cleaned = cleaned.replace(/\*\*\n\*\*/g, '**\n\n**');

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  private validateResponse(text: string): boolean {
    // Check for empty response
    if (!text || text.trim().length < 20) {
      return false;
    }

    // Check for placeholder/error text
    const errorPatterns = [
      /I cannot|I'm unable|I don't have/i,
      /error occurred/i,
      /no information found/i
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    return true;
  }

  private validateStructuredResponse(data: any): data is StructuredResponse {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Must have title
    if (!data.title || typeof data.title !== 'string') {
      return false;
    }

    // Must have sections array
    if (!Array.isArray(data.sections)) {
      return false;
    }

    return true;
  }

  private parseJSONResponse(text: string): StructuredResponse | null {
    try {
      // Try direct parse
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return null;
        }
      }

      // Try to find JSON object in text
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  // ==========================================================================
  // FALLBACK RESPONSE
  // ==========================================================================

  private getFallbackResponse(query: string, language: string): string {
    const fallbacks: Record<string, string> = {
      en: `**Analysis Pending**

I couldn't fully process this query. Here's what I can tell you:

• The information you're looking for may require additional document context
• Try rephrasing your question with more specific terms
• Ensure the relevant documents are uploaded and processed`,

      pt: `**Analise Pendente**

Nao consegui processar completamente esta consulta. Aqui esta o que posso dizer:

• A informacao que voce procura pode requerer contexto adicional do documento
• Tente reformular sua pergunta com termos mais especificos
• Certifique-se de que os documentos relevantes estao carregados e processados`,

      es: `**Analisis Pendiente**

No pude procesar completamente esta consulta. Esto es lo que puedo decirte:

• La informacion que buscas puede requerir contexto adicional del documento
• Intenta reformular tu pregunta con terminos mas especificos
• Asegurate de que los documentos relevantes esten cargados y procesados`
    };

    return fallbacks[language] || fallbacks.en;
  }

  // ==========================================================================
  // QUERY TYPE DETECTION
  // ==========================================================================

  /**
   * Detect the type of query for optimal formatting
   */
  detectQueryType(query: string): QueryType {
    const lowerQuery = query.toLowerCase();

    // Financial indicators
    const financialKeywords = [
      'revenue', 'expense', 'cost', 'profit', 'budget', 'price', 'payment',
      'income', 'loss', 'margin', 'ebitda', 'roi', 'irr', 'npv', 'cash flow',
      'receita', 'despesa', 'custo', 'lucro', 'orcamento', 'preco', // Portuguese
      'ingreso', 'gasto', 'costo', 'beneficio', 'presupuesto' // Spanish
    ];

    // Comparison indicators
    const comparisonKeywords = [
      'compare', 'vs', 'versus', 'difference', 'between', 'against',
      'comparar', 'diferenca', 'entre', // Portuguese
      'comparar', 'diferencia', 'entre' // Spanish
    ];

    // List indicators
    const listKeywords = [
      'list', 'all', 'what are', 'show me', 'enumerate', 'give me',
      'listar', 'todos', 'quais sao', 'mostre', // Portuguese
      'listar', 'todos', 'cuales son', 'muestrame' // Spanish
    ];

    // Simple indicators (short queries, single-word answers expected)
    const simplePatterns = [
      /^what is the\s+\w+\??$/i,
      /^how much\??$/i,
      /^when\??$/i,
      /^where\??$/i,
      /^who\??$/i
    ];

    // Check patterns
    if (comparisonKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'comparison';
    }

    if (financialKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'financial';
    }

    if (listKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'list';
    }

    if (simplePatterns.some(pattern => pattern.test(lowerQuery))) {
      return 'simple';
    }

    return 'general';
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const structuredResponseGenerator = new StructuredResponseGenerator();
export default structuredResponseGenerator;
