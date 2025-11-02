/**
 * Response Formatter Service
 *
 * Generates format-specific system prompts for different query types
 * Based on ChatGPT Format Analysis
 *
 * CRITICAL: All formats use bullet points (•) and NO emoji
 */

import { ResponseFormatType } from './formatTypeClassifier.service';

interface ResponseContext {
  queryLength: number;
  documentCount: number;
  intentType: string;
  chunks: any[];
  hasFinancialData: boolean;
  hasMultipleSheets?: boolean;
  hasSlides?: boolean;
}

export class ResponseFormatterService {

  /**
   * Main entry point - Format KODA response (legacy compatibility)
   * This is kept for backward compatibility with existing code
   */
  async formatResponse(
    rawAnswer: string,
    context: ResponseContext,
    sources: any[],
    query?: string
  ): Promise<string> {
    // For now, just return the raw answer without formatting
    // The formatting is now handled via buildFormatPrompt in the system prompt
    return rawAnswer;
  }

  /**
   * Build format-specific system prompt
   */
  buildFormatPrompt(formatType: ResponseFormatType): string {
    switch (formatType) {
      case ResponseFormatType.FEATURE_LIST:
        return this.buildFeatureListPrompt();
      case ResponseFormatType.STRUCTURED_LIST:
        return this.buildStructuredListPrompt();
      case ResponseFormatType.DOCUMENT_LIST:
        return this.buildDocumentListPrompt();
      case ResponseFormatType.TABLE:
        return this.buildTablePrompt();
      case ResponseFormatType.DIRECT_ANSWER:
        return this.buildDirectAnswerPrompt();
      case ResponseFormatType.SIMPLE_LIST:
        return this.buildSimpleListPrompt();
      default:
        return this.buildFeatureListPrompt(); // Default
    }
  }

  /**
   * Type 1: Feature List Format
   * For comprehensive overview queries like "What does the business plan say?"
   */
  private buildFeatureListPrompt(): string {
    return `FORMAT TYPE: FEATURE LIST

STRUCTURE:
Referenced Documents: [Document1.pdf], [Document2.xlsx]

[Opening statement with key insight]

• [Feature/point 1 with specific details]
• [Feature/point 2 with specific details]
• [Feature/point 3 with specific details]
• [Additional points as needed]

[Closing statement without emoji]

RULES:
• Use bullet points (•) for all list items
• NO emoji anywhere in the response
• Start with "Referenced Documents:" listing source files
• Empty line after document references (\n\n)
• Opening statement provides context
• Each bullet point is specific and detailed
• Empty line before closing statement (\n\n)
• Closing statement summarizes without emoji

EXAMPLE:
Referenced Documents: Koda Business Plan V12.pdf

The business plan projects aggressive revenue growth over three years, scaling from initial market entry to enterprise dominance.

• Year 1 targets 280 users generating $670,800 in revenue
• Year 2 projects 995 users with $2,395,000 in revenue (257% YoY growth)
• Year 3 forecasts 2,600 users producing $6,240,000 in revenue (161% YoY growth)
• Gross margins improve from 65% to 78% by Year 3
• Break-even projected at Month 18 with 450 users

These projections are based on a tiered pricing model and 95% retention rate.`;
  }

  /**
   * Type 2: Structured List Format
   * For specific attribute queries like "What features does KODA have?"
   */
  private buildStructuredListPrompt(): string {
    return `FORMAT TYPE: STRUCTURED LIST

STRUCTURE:
Referenced Documents: [Document1.pdf]

[Brief introduction]

• [Item 1] — [Description with details]
• [Item 2] — [Description with details]
• [Item 3] — [Description with details]
• [Additional items as needed]

[Closing statement without emoji]

RULES:
• Use bullet points (•) for all items
• Use em dash (—) not hyphen (-) to separate item from description
• NO emoji anywhere
• Start with "Referenced Documents:" if applicable
• Brief introduction sets context
• Each bullet has item name followed by em dash and description
• Empty line before closing statement (\n\n)
• Closing statement wraps up without emoji

EXAMPLE:
Referenced Documents: KODA Technical Specifications.pdf

KODA offers comprehensive document intelligence capabilities designed for enterprise workflows.

• Semantic Search — Natural language queries to find relevant documents based on meaning, not just keywords
• Multi-Format Support — Processes PDFs, Word docs, Excel spreadsheets, PowerPoint presentations, and images with OCR
• Intelligent Extraction — Automatically extracts data like dates, amounts, names, and key metrics from documents
• Conversation Context — Maintains context across queries to enable follow-up questions and deeper exploration

These features enable efficient document management and knowledge retrieval.`;
  }

  /**
   * Type 3: Document List Format
   * For "Which documents mention X?" queries
   * NOTE: This is typically bypassed in favor of direct formatting in rag.service.ts
   */
  private buildDocumentListPrompt(): string {
    return `FORMAT TYPE: DOCUMENT LIST

STRUCTURE:
• [filename1.ext]
• [filename2.ext]
• [filename3.ext]

RULES:
• Use bullet points (•) only
• NO emoji
• NO introductory text
• NO closing statement
• NO file sizes or metadata
• Just filenames with extensions
• One file per line
• Use line breaks (\n) between bullets

EXAMPLE:
• Montana-Rocking-CC-Sanctuary.pdf
• Lone Mountain Ranch P&L 2025.xlsx
• Koda Business Plan V12.pdf`;
  }

  /**
   * Type 4: Table Format
   * For comparison queries like "Compare X and Y"
   */
  private buildTablePrompt(): string {
    return `FORMAT TYPE: TABLE

STRUCTURE:
Referenced Documents: [Document1.pdf], [Document2.pdf]

[Brief introduction to the comparison]

Technical Documents:
• [Document 1] — [Key characteristics]
• [Document 2] — [Key characteristics]

Business Documents:
• [Document 3] — [Key characteristics]
• [Document 4] — [Key characteristics]

[Closing statement without emoji]

RULES:
• Use bullet points (•) for all items
• Group items by category with headers
• Use em dash (—) to separate name from description
• NO emoji anywhere
• Start with "Referenced Documents:"
• Empty lines after each section (\n\n)
• Headers use plain text (no special formatting)
• Closing statement summarizes without emoji

EXAMPLE:
Referenced Documents: Various KODA documents

The documents can be categorized into technical and business categories based on their content and purpose.

Technical Documents:
• KODA Architecture.pdf — System design and technical specifications
• API Documentation.docx — Endpoint references and integration guide

Business Documents:
• Business Plan V12.pdf — Revenue projections and market strategy
• Financial Report Q1.xlsx — Actual performance and metrics

This categorization helps organize documentation by intended audience and use case.`;
  }

  /**
   * Type 5: Direct Answer Format
   * For factual queries like "What is the expiration date?"
   */
  private buildDirectAnswerPrompt(): string {
    return `FORMAT TYPE: DIRECT ANSWER

STRUCTURE:
[Direct answer to the question]

• [Supporting detail 1]
• [Supporting detail 2]
• [Supporting detail 3]

RULES:
• First line is the direct answer (no bullets)
• Supporting details use bullet points (•)
• NO emoji anywhere
• NO document references unless from multiple sources
• Keep answer concise (1-2 sentences max for opening)
• 2-4 bullet points with supporting details
• NO closing statement for factual queries

EXAMPLE:
The expiration date is March 15, 2025.

• Found in Passport.pdf, page 2
• Issued on March 16, 2015 in Lisbon
• Valid for 10 years from issue date`;
  }

  /**
   * Type 6: Simple List Format
   * For entity extraction like "List all categories"
   */
  private buildSimpleListPrompt(): string {
    return `FORMAT TYPE: SIMPLE LIST

STRUCTURE:
• [Item 1]
• [Item 2]
• [Item 3]
• [Item 4]

RULES:
• Use bullet points (•) only
• NO emoji
• NO introductory text
• NO closing statement
• NO descriptions (just the item name)
• One item per line
• Use line breaks (\n) between bullets

EXAMPLE:
• Business
• Technical
• Financial
• Legal
• Personal`;
  }
}

export default new ResponseFormatterService();
