/**
 * ============================================================================
 * KODA MARKDOWN CONTRACT SERVICE
 * ============================================================================
 *
 * This service implements the "Koda Markdown Spec" - a strict contract between
 * backend and frontend to ensure ChatGPT-like clean, tight formatting.
 *
 * CORE PRINCIPLE:
 * - Backend = semantic markdown only (what it is, not how it looks)
 * - Frontend = visual spacing only (how it looks, not what it is)
 *
 * RULES:
 * 1. Max 2 newlines between blocks (never 3+)
 * 2. No blank lines inside lists
 * 3. Use ## for titles (not #)
 * 4. Normalize bullets to - (not •)
 * 5. No aggressive bolding (only key terms)
 * 6. No duplicate content
 * 7. No broken markdown
 *
 * ============================================================================
 */

export interface MarkdownContractOptions {
  maxNewlines?: number;          // Max consecutive newlines (default: 2)
  normalizeHeadings?: boolean;    // Convert # to ## (default: true)
  normalizeBullets?: boolean;     // Convert • to - (default: true)
  tightLists?: boolean;           // Remove blank lines in lists (default: true)
  selectiveBold?: boolean;        // Only bold key terms (default: true)
  removeArtifacts?: boolean;      // Remove [THINKING] etc (default: true)
}

const DEFAULT_OPTIONS: MarkdownContractOptions = {
  maxNewlines: 2,
  normalizeHeadings: true,
  normalizeBullets: true,
  tightLists: true,
  selectiveBold: true,
  removeArtifacts: true
};

/**
 * Apply Koda Markdown Contract to raw markdown
 * This is the MAIN function to call from post-processing
 */
export function applyMarkdownContract(
  markdown: string,
  options: MarkdownContractOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let result = markdown;

  // Step 1: Remove artifacts ([THINKING], [SYSTEM], etc.)
  if (opts.removeArtifacts) {
    result = removeArtifacts(result);
  }

  // Step 2: Normalize headings (# → ##)
  if (opts.normalizeHeadings) {
    result = normalizeHeadings(result);
  }

  // Step 3: Normalize bullets (• → -)
  if (opts.normalizeBullets) {
    result = normalizeBullets(result);
  }

  // Step 4: Tighten lists (remove blank lines between bullets)
  if (opts.tightLists) {
    result = tightenLists(result);
  }

  // Step 5: Limit consecutive newlines
  result = limitNewlines(result, opts.maxNewlines!);

  // Step 6: Fix broken markdown (unbalanced ** and ```)
  result = fixBrokenMarkdown(result);

  // Step 7: Final cleanup
  result = finalCleanup(result);

  return result;
}

/**
 * Remove artifacts like [THINKING], [SYSTEM], [DEBUG]
 */
function removeArtifacts(markdown: string): string {
  // Remove [THINKING]...[/THINKING] blocks
  markdown = markdown.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '');

  // Remove [SYSTEM]...[/SYSTEM] blocks
  markdown = markdown.replace(/\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi, '');

  // Remove [DEBUG]...[/DEBUG] blocks
  markdown = markdown.replace(/\[DEBUG\][\s\S]*?\[\/DEBUG\]/gi, '');

  // Remove standalone [THINKING], [SYSTEM], [DEBUG] tags
  markdown = markdown.replace(/\[(THINKING|SYSTEM|DEBUG|INTERNAL|METADATA)\]/gi, '');

  return markdown;
}

/**
 * Normalize headings: # → ##
 * Avoids huge H1 margins in chat bubbles
 */
function normalizeHeadings(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Convert # Title → ## Title
    if (line.match(/^#\s+/)) {
      result.push(line.replace(/^#\s+/, '## '));
    }
    // Keep ## and ### as is
    else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Normalize bullets: • → -
 * Ensures consistent list rendering
 */
function normalizeBullets(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Convert • Item → - Item
    if (line.match(/^\s*•\s+/)) {
      result.push(line.replace(/^\s*•\s+/, '- '));
    }
    // Convert * Item → - Item (for consistency)
    else if (line.match(/^\s*\*\s+/)) {
      result.push(line.replace(/^\s*\*\s+/, '- '));
    }
    else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Tighten lists: remove blank lines between bullets
 */
function tightenLists(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let lastWasBullet = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = line.match(/^\s*[-*]\s+/);
    const isBlank = line.trim() === '';

    if (isBullet) {
      // Start of list or continuation
      inList = true;
      result.push(line);
      lastWasBullet = true;
    }
    else if (isBlank && inList && lastWasBullet) {
      // Skip blank line inside list
      // Don't add to result
      lastWasBullet = false;
    }
    else {
      // Not a bullet, not a blank line in list
      if (!isBullet && !isBlank) {
        inList = false;
      }
      result.push(line);
      lastWasBullet = false;
    }
  }

  return result.join('\n');
}

/**
 * Limit consecutive newlines to max
 */
function limitNewlines(markdown: string, max: number): string {
  // Build regex: \n{max+1,} → \n{max}
  const regex = new RegExp(`\\n{${max + 1},}`, 'g');
  const replacement = '\n'.repeat(max);
  return markdown.replace(regex, replacement);
}

/**
 * Fix broken markdown (unbalanced ** and ```)
 */
export function fixBrokenMarkdown(markdown: string): string {
  // Count ** (bold markers)
  const boldCount = (markdown.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    // Odd number of **, append one more at the end
    markdown += '**';
  }

  // Count ``` (code fence markers)
  const codeCount = (markdown.match(/```/g) || []).length;
  if (codeCount % 2 !== 0) {
    // Odd number of ```, append one more at the end
    markdown += '\n```';
  }

  return markdown;
}

/**
 * Final cleanup
 */
function finalCleanup(markdown: string): string {
  // Trim leading/trailing whitespace
  markdown = markdown.trim();

  // Ensure exactly one trailing newline
  markdown = markdown.replace(/\n*$/, '\n');

  // Fix spacing after periods (if missing)
  markdown = markdown.replace(/\.([A-Z])/g, '. $1');

  // Remove trailing spaces on each line
  markdown = markdown.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  return markdown;
}

/**
 * Selective bold: only bold truly important terms
 * (Not every number/currency/date)
 */
export function applySelectiveBold(markdown: string): string {
  // Only bold these patterns:
  // 1. Document names (already done by formatDocumentNames)
  // 2. Section labels like "Key Points:", "Summary:", "Important:"
  // 3. Critical keywords in context

  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    let processedLine = line;

    // Bold section labels at start of line
    processedLine = processedLine.replace(
      /^(Key Points?|Summary|Important|Note|Warning|Conclusion|Overview|Details|Requirements?):/i,
      '**$1:**'
    );

    // Bold "Important:" mid-sentence
    processedLine = processedLine.replace(
      /\b(Important|Note|Warning):/gi,
      '**$1:**'
    );

    result.push(processedLine);
  }

  return result.join('\n');
}

/**
 * Remove aggressive bolding (undo over-bolding)
 */
export function removeAggressiveBold(markdown: string): string {
  // Remove bold from ALL numbers (we'll re-add selectively)
  // Pattern: **R$ 1.500.000,00** → R$ 1.500.000,00
  markdown = markdown.replace(/\*\*(R\$\s*[\d.,]+)\*\*/g, '$1');
  markdown = markdown.replace(/\*\*(\$\s*[\d.,]+)\*\*/g, '$1');
  markdown = markdown.replace(/\*\*(€\s*[\d.,]+)\*\*/g, '$1');

  // Remove bold from dates
  // Pattern: **15/03/2024** → 15/03/2024
  markdown = markdown.replace(/\*\*(\d{1,2}\/\d{1,2}\/\d{2,4})\*\*/g, '$1');

  // Remove bold from percentages
  // Pattern: **15%** → 15%
  markdown = markdown.replace(/\*\*(\d+(?:\.\d+)?%)\*\*/g, '$1');

  return markdown;
}

/**
 * Check if markdown follows contract
 * Returns array of violations
 */
export function validateMarkdownContract(markdown: string): string[] {
  const violations: string[] = [];

  // Check 1: No more than 2 consecutive newlines
  if (markdown.match(/\n{3,}/)) {
    violations.push('Contains 3+ consecutive newlines');
  }

  // Check 2: No # headings (should be ##)
  if (markdown.match(/^#\s+/m)) {
    violations.push('Contains # headings (should be ##)');
  }

  // Check 3: No • bullets (should be -)
  if (markdown.match(/^\s*•\s+/m)) {
    violations.push('Contains • bullets (should be -)');
  }

  // Check 4: No blank lines inside lists
  const listBlankLinePattern = /^-\s+.*\n\n-\s+/m;
  if (markdown.match(listBlankLinePattern)) {
    violations.push('Contains blank lines inside lists');
  }

  // Check 5: No unbalanced **
  const boldCount = (markdown.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    violations.push('Unbalanced ** (bold markers)');
  }

  // Check 6: No unbalanced ```
  const codeCount = (markdown.match(/```/g) || []).length;
  if (codeCount % 2 !== 0) {
    violations.push('Unbalanced ``` (code fences)');
  }

  return violations;
}

/**
 * Format document names with contract rules
 * - Bold: **filename.pdf**
 * - Normalize: underscores/dashes → spaces
 * - Keep extension
 */
export function formatDocumentNamesContract(markdown: string): string {
  // Pattern: filename.pdf, filename_with_underscores.docx, etc.
  const docPattern = /\b([a-zA-Z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|md|csv))\b/gi;

  return markdown.replace(docPattern, (match, filename, ext) => {
    // Normalize filename: replace _ and - with spaces
    let normalized = filename.replace(/[_-]/g, ' ');

    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Bold it
    return `**${normalized}**`;
  });
}

/**
 * Build sources section with contract rules
 * - Use ## Sources (not # Sources)
 * - Tight list (no blank lines)
 * - Bold document names
 */
export function buildSourcesSection(documentNames: string[]): string {
  if (documentNames.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Sources');
  lines.push('');

  // Deduplicate
  const unique = Array.from(new Set(documentNames));

  // Format as tight list
  for (const name of unique) {
    // Normalize name
    const normalized = name.replace(/[_-]/g, ' ').trim();
    lines.push(`- **${normalized}**`);
  }

  return lines.join('\n');
}

/**
 * Complete post-processing pipeline with contract
 */
export function processAnswerWithContract(
  rawAnswer: string,
  documentNames: string[],
  options: MarkdownContractOptions = {}
): string {
  let result = rawAnswer;

  // 1. Apply markdown contract (structure, spacing, normalization)
  result = applyMarkdownContract(result, options);

  // 2. Remove aggressive bolding
  result = removeAggressiveBold(result);

  // 3. Apply selective bolding
  result = applySelectiveBold(result);

  // 4. Format document names
  result = formatDocumentNamesContract(result);

  // 5. Add sources section (if documents used)
  if (documentNames.length > 0) {
    const sourcesSection = buildSourcesSection(documentNames);
    result += '\n\n' + sourcesSection;
  }

  // 6. Final validation
  const violations = validateMarkdownContract(result);
  if (violations.length > 0) {
    console.warn('[MARKDOWN CONTRACT] Violations found:', violations);
  }

  return result;
}

// Export all functions
export default {
  applyMarkdownContract,
  applySelectiveBold,
  removeAggressiveBold,
  validateMarkdownContract,
  formatDocumentNamesContract,
  buildSourcesSection,
  processAnswerWithContract,
  fixBrokenMarkdown
};
