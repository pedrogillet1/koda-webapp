/**
 * Semantic Chunker Service
 * Chunks documents respecting semantic boundaries:
 * - Sections stay together
 * - Tables kept with captions
 * - No mid-sentence splits
 * - Overlap for context continuity
 */

import documentStructureDetectorService, {
  DocumentStructure,
  Table
} from './documentStructureDetector.service';

export interface Chunk {
  text: string;
  heading?: string;
  startToken: number;
  endToken: number;
  metadata: {
    isTable?: boolean;
    tableCaption?: string;
    tableRows?: number;
    tableColumns?: number;
    isList?: boolean;
    listItems?: number;
    chunkIndex: number;
    totalChunks?: number;
  };
}

interface ChunkingOptions {
  maxTokens: number;
  overlapTokens: number;
}

class SemanticChunkerService {
  private readonly DEFAULT_MAX_TOKENS = 512;
  private readonly DEFAULT_OVERLAP_TOKENS = 50;

  /**
   * Chunks document respecting semantic boundaries
   */
  async chunkDocument(
    content: string,
    options: Partial<ChunkingOptions> = {}
  ): Promise<Chunk[]> {
    const { maxTokens, overlapTokens } = {
      maxTokens: options.maxTokens || this.DEFAULT_MAX_TOKENS,
      overlapTokens: options.overlapTokens || this.DEFAULT_OVERLAP_TOKENS
    };

    console.log(`📄 Semantic chunking: maxTokens=${maxTokens}, overlap=${overlapTokens}`);

    // Step 1: Detect document structure
    const structure = documentStructureDetectorService.detectStructure(content);

    // Step 2: Create section-based chunks
    const chunks: Chunk[] = [];

    // If no headings, chunk by paragraphs
    if (structure.headings.length === 0) {
      return this.chunkByParagraphs(content, { maxTokens, overlapTokens });
    }

    // Chunk by sections (heading-based)
    for (let i = 0; i < structure.headings.length; i++) {
      const heading = structure.headings[i];
      const nextHeading = structure.headings[i + 1];

      const sectionStart = heading.position;
      const sectionEnd = nextHeading ? nextHeading.position : content.length;
      const sectionContent = content.substring(sectionStart, sectionEnd);

      // Check if section has tables
      const sectionTables = structure.tables.filter(t =>
        t.start >= sectionStart && t.end <= sectionEnd
      );

      if (sectionTables.length > 0) {
        // Handle tables specially
        chunks.push(...this.chunkSectionWithTables(
          sectionContent,
          heading.text,
          sectionTables,
          sectionStart,
          { maxTokens, overlapTokens }
        ));
      } else {
        // Regular chunking with overlap
        chunks.push(...this.chunkSection(
          sectionContent,
          heading.text,
          { maxTokens, overlapTokens }
        ));
      }
    }

    // Add chunk indices
    chunks.forEach((chunk, idx) => {
      chunk.metadata.chunkIndex = idx;
      chunk.metadata.totalChunks = chunks.length;
    });

    console.log(`   ✅ Created ${chunks.length} semantic chunks`);

    return chunks;
  }

  /**
   * Chunks section with tables (keeps tables intact)
   */
  private chunkSectionWithTables(
    content: string,
    heading: string,
    tables: Table[],
    sectionStart: number,
    options: ChunkingOptions
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let currentPos = 0;

    for (const table of tables) {
      // Chunk content before table
      const beforeTableStart = currentPos;
      const beforeTableEnd = table.start - sectionStart;

      if (beforeTableEnd > beforeTableStart) {
        const beforeTable = content.substring(beforeTableStart, beforeTableEnd);
        chunks.push(...this.chunkSection(beforeTable, heading, options));
      }

      // Add table as single chunk (with caption)
      const tableContent = content.substring(
        table.start - sectionStart,
        table.end - sectionStart
      );

      const tableChunk: Chunk = {
        text: `${heading}\n\n${table.caption || 'Table'}\n\n${tableContent}`,
        heading,
        startToken: Math.floor((table.start - sectionStart) / 4), // Rough token estimate
        endToken: Math.floor((table.end - sectionStart) / 4),
        metadata: {
          isTable: true,
          tableCaption: table.caption,
          tableRows: table.rows,
          tableColumns: table.columns,
          chunkIndex: 0
        }
      };

      chunks.push(tableChunk);
      currentPos = table.end - sectionStart;
    }

    // Chunk remaining content after last table
    if (currentPos < content.length) {
      const afterTables = content.substring(currentPos);
      chunks.push(...this.chunkSection(afterTables, heading, options));
    }

    return chunks;
  }

  /**
   * Chunks section with overlap
   */
  private chunkSection(
    content: string,
    heading: string,
    options: ChunkingOptions
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const tokens = this.tokenize(content);

    let start = 0;
    while (start < tokens.length) {
      const end = Math.min(start + options.maxTokens, tokens.length);

      // Find semantic boundary (sentence/paragraph end)
      const adjustedEnd = this.findSemanticBoundary(tokens, end);

      const chunkTokens = tokens.slice(start, adjustedEnd);
      const chunkText = this.detokenize(chunkTokens);

      // Add heading as context
      chunks.push({
        text: `${heading}\n\n${chunkText}`,
        heading,
        startToken: start,
        endToken: adjustedEnd,
        metadata: {
          chunkIndex: 0
        }
      });

      // Move with overlap
      start = adjustedEnd - options.overlapTokens;

      // Ensure we make progress
      if (start < 0 || start >= tokens.length) break;
    }

    return chunks;
  }

  /**
   * Chunks by paragraphs when no headings detected
   */
  private chunkByParagraphs(
    content: string,
    options: ChunkingOptions
  ): Chunk[] {
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    const chunks: Chunk[] = [];

    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paraTokens = this.estimateTokens(paragraph);

      // If adding this paragraph exceeds limit, save current chunk
      if (currentTokens + paraTokens > options.maxTokens && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.join('\n\n'),
          startToken: 0,
          endToken: currentTokens,
          metadata: {
            chunkIndex: 0
          }
        });

        // Start new chunk with overlap
        currentChunk = [];
        currentTokens = 0;
      }

      currentChunk.push(paragraph);
      currentTokens += paraTokens;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n\n'),
        startToken: 0,
        endToken: currentTokens,
        metadata: {
          chunkIndex: 0
        }
      });
    }

    return chunks;
  }

  /**
   * Finds semantic boundary (sentence/paragraph end)
   */
  private findSemanticBoundary(tokens: string[], idealEnd: number): number {
    if (idealEnd >= tokens.length) {
      return tokens.length;
    }

    // Look back up to 50 tokens for good boundary
    const searchStart = Math.max(idealEnd - 50, 0);

    for (let i = idealEnd - 1; i >= searchStart; i--) {
      // Paragraph break (best)
      if (tokens[i] === '\n' && tokens[i - 1] === '\n') {
        return i;
      }

      // Sentence end (good)
      if (tokens[i].match(/[.!?]$/) && tokens[i + 1]?.match(/^[A-Z\n]/)) {
        return i + 1;
      }
    }

    // No good boundary found, use ideal end
    return idealEnd;
  }

  /**
   * Simple tokenization (split by whitespace and punctuation)
   */
  private tokenize(text: string): string[] {
    // Split by whitespace and punctuation while keeping them
    return text.split(/(\s+|[.,!?;:(){}[\]])/g).filter(t => t.length > 0);
  }

  /**
   * Detokenize (join tokens back into text)
   */
  private detokenize(tokens: string[]): string {
    return tokens.join('').trim();
  }

  /**
   * Estimates token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validates chunk quality
   */
  validateChunk(chunk: Chunk): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check minimum length
    if (chunk.text.length < 50) {
      issues.push('Chunk too short (< 50 characters)');
    }

    // Check maximum length
    if (chunk.text.length > 3000) {
      issues.push('Chunk too long (> 3000 characters)');
    }

    // Check for incomplete sentences (unless it's a table)
    if (!chunk.metadata.isTable && !chunk.text.match(/[.!?]$/)) {
      issues.push('Chunk ends mid-sentence');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export default new SemanticChunkerService();
export { SemanticChunkerService, ChunkingOptions };
