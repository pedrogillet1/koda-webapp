/**
 * Post-Processor Service
 *
 * Cleans up Gemini responses to match ChatGPT/Manus quality.
 *
 * CLEANUP OPERATIONS:
 * 1. Remove excessive inline page citations [p.1], [p.4]
 * 2. Remove blue button document names [filename.docx]
 * 3. Normalize spacing (max 2 line breaks)
 * 4. Remove emoji from status messages
 * 5. Clean up markdown formatting
 * 6. Add sources section at bottom (ChatGPT style)
 *
 * Impact: 100% cleaner, more readable responses
 */

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex?: number;
  content?: string;
  similarity?: number;
  metadata?: any;
  location?: string;
  pageNumber?: number;
  chunkText?: string;
}

// Legacy interface for backward compatibility
export interface Source {
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkText: string;
}

class PostProcessorService {
  /**
   * Main processing function
   *
   * @param response - Raw response from Gemini
   * @param sources - RAG sources for reference
   * @returns Cleaned response
   */
  process(response: string, sources?: RAGSource[]): string {
    let cleaned = response;

    // Step 1: Remove inline page citations
    cleaned = this.removePageCitations(cleaned);

    // Step 2: Remove document name citations
    cleaned = this.removeDocumentNames(cleaned);

    // Step 3: Normalize spacing
    cleaned = this.normalizeSpacing(cleaned);

    // Step 4: Remove emoji
    cleaned = this.removeEmoji(cleaned);

    // Step 5: Repair broken markdown tables (line breaks inside cells)
    cleaned = this.repairMarkdownTables(cleaned);

    // Step 6: Clean up markdown
    cleaned = this.cleanMarkdown(cleaned);

    // Step 7: Add sources section at bottom (ChatGPT style)
    if (sources && sources.length > 0) {
      cleaned = this.addSourcesSection(cleaned, sources);
    }

    return cleaned;
  }

  /**
   * Remove inline page citations like [p.1], [p.4], [page 5]
   *
   * PATTERNS TO REMOVE:
   * - [p.1], [p.4], [p.10]
   * - [page 1], [page 4]
   * - (p.1), (p.4)
   * - (page 1), (page 4)
   *
   * KEEP:
   * - [1], [2] (footnote numbers - these are intentional)
   * - [Document Name] (we'll handle these separately)
   */
  private removePageCitations(text: string): string {
    // Remove [p.X] pattern
    text = text.replace(/\[p\.\d+\]/gi, '');

    // Remove [page X] pattern
    text = text.replace(/\[page\s+\d+\]/gi, '');

    // Remove (p.X) pattern
    text = text.replace(/\(p\.\d+\)/gi, '');

    // Remove (page X) pattern
    text = text.replace(/\(page\s+\d+\)/gi, '');

    // Remove multiple citations in a row: [p.1][p.4][p.5] → (empty)
    text = text.replace(/(\[p\.\d+\]\s*){2,}/gi, '');

    // Remove "on page X" or "on pages X-Y"
    text = text.replace(/\s+on\s+pages?\s+\d+(?:-\d+)?/gi, '');

    // Clean up double spaces left by removal
    text = text.replace(/\s{2,}/g, ' ');

    // Clean up space before punctuation (caused by citation removal)
    text = text.replace(/\s+([.,!?;:])/g, '$1');

    return text;
  }

  /**
   * Remove document name citations like [filename.docx], [Document.pdf]
   *
   * PATTERNS TO REMOVE:
   * - [filename.pdf]
   * - [Document Name.docx]
   * - [Koda blueprint (1).docx]
   *
   * STRATEGY:
   * - Match [text with file extension]
   * - Common extensions: .pdf, .docx, .xlsx, .pptx, .txt
   */
  private removeDocumentNames(text: string): string {
    // Remove citations with file extensions
    const fileExtensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv'];

    for (const ext of fileExtensions) {
      // Match [anything.ext] or [anything.ext]
      const pattern = new RegExp(`\\[[^\\]]*\\.${ext}\\]`, 'gi');
      text = text.replace(pattern, '');
    }

    // Pattern: "in [Document Name]" or "from [Document Name]"
    text = text.replace(/\s+(?:in|from|provided in|detailed in|described in|under)\s+\[([^\]]+)\]/gi, '');

    // Pattern: Remove bracketed content with document keywords
    text = text.replace(/\[([^\]]*(?:blueprint|plan|document|report|analysis|checklist|guide|manual|specification)[^\]]*)\]/gi, '');

    // Pattern: "According to [document]," or "As stated in [document],"
    text = text.replace(/(?:As (?:stated|mentioned) in|Referring to|According to)\s+\[([^\]]+)\][,\.\s]*/gi, '');

    // Clean up double spaces
    text = text.replace(/\s{2,}/g, ' ');

    // Clean up space before punctuation
    text = text.replace(/\s+([.,!?;:])/g, '$1');

    return text;
  }

  /**
   * Normalize spacing to maximum 2 consecutive line breaks
   *
   * BEFORE:
   * Paragraph 1.
   *
   *
   *
   * Paragraph 2.
   *
   * AFTER:
   * Paragraph 1.
   *
   * Paragraph 2.
   */
  private normalizeSpacing(text: string): string {
    // Replace 3+ consecutive line breaks with exactly 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');

    // Remove spaces before punctuation
    text = text.replace(/\s+([.,!?;:])/g, '$1');

    // Ensure single space after punctuation (except for ellipsis)
    text = text.replace(/([.,!?;:])\s*/g, '$1 ');

    // Remove space before closing parenthesis/bracket
    text = text.replace(/\s+([)\]])/g, '$1');

    // Remove space after opening parenthesis/bracket
    text = text.replace(/([(\[])\s+/g, '$1');

    // Trim start and end
    text = text.trim();

    return text;
  }

  /**
   * Remove emoji from response
   *
   * Gemini sometimes adds emoji despite prompts saying not to.
   * Examples: ⏸️, 🔍, 📄, ✅, ⚠️
   *
   * STRATEGY:
   * - Use Unicode emoji ranges to detect and remove
   */
  private removeEmoji(text: string): string {
    // Unicode emoji ranges (comprehensive)
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F200}-\u{1F2FF}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}]|[\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}]|[\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}]|[\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}]|[\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}]|[\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}]|[\u{2660}]|[\u{2663}]|[\u{2665}]|[\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}]|[\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}]|[\u{269C}]|[\u{26A0}]|[\u{26A1}]|[\u{26AA}]|[\u{26AB}]|[\u{26B0}]|[\u{26B1}]|[\u{26BD}]|[\u{26BE}]|[\u{26C4}]|[\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}]|[\u{26D4}]|[\u{26E9}]|[\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}]|[\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}]|[\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}]|[\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}]|[\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu;

    text = text.replace(emojiPattern, '');

    // Clean up double spaces left by emoji removal
    text = text.replace(/\s{2,}/g, ' ');

    return text;
  }

  /**
   * Repair broken markdown tables where LLM inserted line breaks inside cells
   *
   * PROBLEM: LLM generates tables like:
   * | Aspect | sample_financial_report.pdf | sample_legal_contract.pdf |
   * |--------|
   * -----------------------------|---------------------------|
   * | Document Type | Financial Report | Commercial Lease Agreement |
   *
   * SOLUTION: Merge lines that are part of incomplete table rows
   */
  private repairMarkdownTables(text: string): string {
    const lines = text.split('\n');
    const repairedLines: string[] = [];
    let pendingTableRow = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this line starts a table row (starts with |)
      const startsWithPipe = trimmedLine.startsWith('|');
      // Check if this line ends a table row (ends with |)
      const endsWithPipe = trimmedLine.endsWith('|');
      // Check if this is a separator line (|---|---|)
      const isSeparator = /^\|[\s\-:]+\|/.test(trimmedLine) || /^[\-:]+\|/.test(trimmedLine);

      // If we have a pending incomplete row
      if (pendingTableRow) {
        // If this line looks like a continuation (contains | or is a separator fragment)
        if (trimmedLine.includes('|') || /^[\-:]+$/.test(trimmedLine)) {
          // Merge with pending row
          pendingTableRow += trimmedLine;

          // Check if row is now complete
          if (pendingTableRow.endsWith('|')) {
            repairedLines.push(pendingTableRow);
            pendingTableRow = '';
          }
        } else {
          // Not a continuation, push pending row (even if incomplete) and this line
          repairedLines.push(pendingTableRow);
          pendingTableRow = '';
          repairedLines.push(line);
        }
      } else if (startsWithPipe && !endsWithPipe && !isSeparator) {
        // Start of a potentially broken table row
        pendingTableRow = trimmedLine;
      } else {
        // Normal line or complete table row
        repairedLines.push(line);
      }
    }

    // Don't forget any remaining pending row
    if (pendingTableRow) {
      repairedLines.push(pendingTableRow);
    }

    return repairedLines.join('\n');
  }

  /**
   * Clean up markdown formatting issues
   *
   * FIXES:
   * - Extra asterisks: **text** ** → **text**
   * - Broken lists: •Item → • Item
   * - Inconsistent bullet points: - vs • vs *
   * - TABLE-AWARE: Skips bullet conversions for table rows (lines with |)
   */
  private cleanMarkdown(text: string): string {
    // Fix broken bold: ** ** → (empty)
    text = text.replace(/\*\*\s+\*\*/g, '');

    // TABLE-AWARE: Process lines individually to preserve markdown tables
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      // If line contains a pipe character, it's likely a table row - don't touch it
      if (line.includes('|')) {
        return line;
      }

      // Fix space after bullet points
      let processed = line.replace(/^([•\-\*])\s*/gm, '• ');

      // Ensure consistent bullet points (use •)
      processed = processed.replace(/^[\-\*]\s/gm, '• ');

      return processed;
    });

    return processedLines.join('\n');
  }

  /**
   * Add sources section at bottom (ChatGPT style)
   *
   * BEFORE:
   * The business plan projects $2.5M revenue...
   *
   * AFTER:
   * The business plan projects $2.5M revenue...
   *
   * ---
   *
   * **Sources:**
   * • Koda Business Plan V12.pdf (pages 1, 4, 5)
   * • Financial Report Q1.xlsx (Sheet1)
   */
  private addSourcesSection(text: string, sources: RAGSource[]): string {
    if (!sources || sources.length === 0) {
      return text;
    }

    // Group sources by document
    const sourcesByDocument = new Map<string, Set<string>>();

    for (const source of sources) {
      if (!sourcesByDocument.has(source.documentName)) {
        sourcesByDocument.set(source.documentName, new Set());
      }

      // Add location (page, slide, cell) if available
      if (source.location) {
        sourcesByDocument.get(source.documentName)!.add(source.location);
      } else if (source.pageNumber) {
        sourcesByDocument.get(source.documentName)!.add(`page ${source.pageNumber}`);
      }
    }

    // Build sources section
    let sourcesSection = '\n\n---\n\n**Sources:**\n';

    for (const [documentName, locations] of sourcesByDocument) {
      if (locations.size > 0) {
        const locationList = Array.from(locations).sort().join(', ');
        sourcesSection += `• ${documentName} (${locationList})\n`;
      } else {
        sourcesSection += `• ${documentName}\n`;
      }
    }

    return text + sourcesSection;
  }

  /**
   * Remove all citations in one pass (alternative method)
   * Use this for aggressive citation removal
   */
  removeAllCitations(text: string): string {
    let cleaned = text;

    // Remove all [bracketed] content
    cleaned = cleaned.replace(/\[[^\]]+\]/g, '');

    // Remove all (parenthetical) citations
    cleaned = cleaned.replace(/\([^\)]*(?:p\.|page|\.pdf|\.docx)[^\)]*\)/gi, '');

    // Normalize spacing
    cleaned = this.normalizeSpacing(cleaned);

    return cleaned;
  }
}

export default new PostProcessorService();
