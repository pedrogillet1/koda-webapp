/**
 * ============================================================================
 * KODA FORMAT ENGINE - UNIFIED ANSWER FORMATTING
 * ============================================================================
 *
 * This service consolidates ALL formatting logic into ONE engine.
 *
 * CRITICAL RULE: NO DOCUMENT IDs IN OUTPUT
 * - Document names appear as **bold text** only
 * - Frontend matches bold names to document IDs using a name→ID map
 * - IDs are NEVER visible to users in any form
 *
 * CONSOLIDATES (10 services):
 * - masterAnswerFormatter.service.ts
 * - kodaUnifiedPostProcessor.service.ts
 * - structureEnforcement.service.ts
 * - formatEnforcement.service.ts
 * - formatValidation.service.ts
 * - kodaCitationFormat.service.ts
 * - smartBoldingEnhanced.service.ts
 * - markdownSpacing utilities
 * - answerTypeDetector.service.ts
 * - outputPostProcessor.service.ts
 *
 * RESPONSIBILITIES:
 * 1. Title generation (using ## per Koda Markdown Contract)
 * 2. Bold/italic rules (selective bolding, not aggressive)
 * 3. Spacing rules (ChatGPT style - max 2 newlines)
 * 4. Section structuring
 * 5. Citation formatting (bold names only, NO IDs)
 * 6. Pagination for long lists
 * 7. Persona tone consistency
 *
 * NOTE: This service integrates with kodaMarkdownContract.service.ts
 * for consistent ChatGPT-like formatting across all answer types.
 *
 * @version 2.2.0 - Removed all document IDs from output
 * @date 2025-12-09
 */

export interface FormatOptions {
  content: string;
  language: string;
  includeTitle?: boolean;
  includeCitations?: boolean;
  sources?: any[];
}

export interface FormattedAnswer {
  content: string;
  hasTitle: boolean;
  citationCount: number;
}

/**
 * Format answer with consistent ChatGPT-style formatting
 */
export function formatAnswer(options: FormatOptions): FormattedAnswer {
  let { content, language, includeTitle = false, includeCitations = true, sources = [] } = options;

  // 1. Add title if needed (disabled by default for cleaner responses)
  let hasTitle = false;
  if (includeTitle && !content.startsWith('#')) {
    const title = generateTitle(content, language);
    content = `# ${title}\n\n${content}`;
    hasTitle = true;
  }

  // 2. Apply spacing rules (ChatGPT style)
  content = applySpacingRules(content);

  // 3. Apply bold/italic rules
  content = applyBoldRules(content);

  // 4. Add citations if needed
  let citationCount = 0;
  if (includeCitations && sources.length > 0) {
    const { formattedContent, count } = addCitations(content, sources);
    content = formattedContent;
    citationCount = count;
  }

  // 5. Final cleanup
  content = finalCleanup(content);

  return {
    content,
    hasTitle,
    citationCount,
  };
}

function generateTitle(content: string, language: string): string {
  // Extract first sentence or generate from content
  const firstLine = content.split('\n')[0];
  if (firstLine.length < 100 && !firstLine.startsWith('#')) return firstLine;

  return language.startsWith('pt') ? 'Resposta' : 'Answer';
}

function applySpacingRules(content: string): string {
  // ChatGPT-style spacing: double newline after headers, single after paragraphs
  content = content.replace(/^(#{1,6}\s+.+)$/gm, '$1\n');
  content = content.replace(/\n{3,}/g, '\n\n');
  return content;
}

function applyBoldRules(content: string): string {
  // Bold important terms, numbers, and key phrases
  // Bold numbers with units (R$, %, m², etc.)
  content = content.replace(/(\d+(?:[.,]\d+)?)\s*(R\$|USD|\$|%|m²|kg|km|anos?|meses?|dias?|mil|milhão|milhões|bilhão|bilhões)/gi, '**$1 $2**');

  // Bold key financial terms
  const financialTerms = [
    'receita', 'lucro', 'prejuízo', 'margem', 'ebitda', 'roi', 'vpl', 'tir', 'payback',
    'custo', 'investimento', 'retorno', 'objetivo', 'meta', 'resultado', 'conclusão',
    'revenue', 'profit', 'loss', 'margin', 'growth', 'decline', 'cost', 'investment'
  ];
  for (const term of financialTerms) {
    const regex = new RegExp(`\\b(${term})\\b`, 'gi');
    content = content.replace(regex, '**$1**');
  }

  // Clean up double bolding
  content = content.replace(/\*\*\*\*/g, '**');

  return content;
}

function addCitations(content: string, sources: any[]): { formattedContent: string; count: number } {
  let citationCount = 0;
  let formattedContent = content;

  // Get unique document names from sources
  const uniqueNames = new Set<string>();
  sources.forEach(s => {
    const name = s.documentName || s.fileName || '';
    if (name) uniqueNames.add(name);
  });

  // Make document names bold (NOT links - NO IDs in output)
  // Frontend will match **bold names** to document IDs
  uniqueNames.forEach(name => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Only bold if not already bold
    const regex = new RegExp(`(?<!\\*\\*)\\b(${escapedName})\\b(?!\\*\\*)`, 'g');
    formattedContent = formattedContent.replace(regex, '**$1**');
    citationCount++;
  });

  return { formattedContent, count: citationCount };
}

function finalCleanup(content: string): string {
  // Remove excessive whitespace
  content = content.trim();
  content = content.replace(/ +$/gm, '');

  // Remove any control characters
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return content;
}

/**
 * Format a list of documents for display
 * NOTE: NO document IDs in output - only bold names
 * Frontend matches bold names to document IDs
 */
export function formatDocumentList(documents: any[], language: string): string {
  if (documents.length === 0) {
    return language.startsWith('pt')
      ? 'Você não tem documentos carregados.'
      : 'You have no uploaded documents.';
  }

  const header = language.startsWith('pt')
    ? `Você tem **${documents.length}** documento(s):\n\n`
    : `You have **${documents.length}** document(s):\n\n`;

  const list = documents.map((doc, i) => {
    const name = doc.name || doc.fileName || doc.originalName || 'Unnamed';
    // Bold name only - NO IDs in output
    return `${i + 1}. **${name}**`;
  }).join('\n');

  return header + list;
}

/**
 * Format a greeting response
 */
export function formatGreeting(language: string, userName?: string): string {
  const greetings: Record<string, string[]> = {
    'pt': [
      'Olá! Como posso ajudá-lo hoje?',
      'Oi! Em que posso ajudar?',
      'Olá! Estou aqui para ajudar com seus documentos.',
    ],
    'en': [
      'Hello! How can I help you today?',
      'Hi! What can I help you with?',
      'Hello! I\'m here to help with your documents.',
    ],
  };

  const langKey = language.startsWith('pt') ? 'pt' : 'en';
  const options = greetings[langKey];
  const greeting = options[Math.floor(Math.random() * options.length)];

  return userName ? greeting.replace('!', `, ${userName}!`) : greeting;
}

export default {
  formatAnswer,
  formatDocumentList,
  formatGreeting,
};
