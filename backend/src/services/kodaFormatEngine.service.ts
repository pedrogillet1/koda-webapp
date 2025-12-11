/**
 * ============================================================================
 * KODA FORMAT ENGINE - UNIFIED ANSWER FORMATTING
 * ============================================================================
 *
 * This service consolidates ALL formatting logic into ONE engine.
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
 * 5. Citation formatting
 * 6. Pagination for long lists
 * 7. Persona tone consistency
 *
 * NOTE: This service integrates with kodaMarkdownContract.service.ts
 * for consistent ChatGPT-like formatting across all answer types.
 *
 * @version 2.1.0 - Updated for Koda Markdown Contract
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

  // Add hyperlinks to document names in the content
  const uniqueSourcesMap = new Map<string, { id: string; name: string }>();
  sources.forEach(s => {
    const name = s.documentName || s.fileName || 'Document';
    const id = s.documentId || s.id || 'doc';
    if (!uniqueSourcesMap.has(name)) {
      uniqueSourcesMap.set(name, { id, name });
    }
  });

  // Replace document names with hyperlinks in content
  uniqueSourcesMap.forEach(({ id, name }) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedName})\\b`, 'g');
    formattedContent = formattedContent.replace(regex, `[**$1**](#doc-${id})`);
  });

  // ✅ REMOVED: "Fontes:" section - document names are now inline hyperlinks only
  // No separate sources list at the end of answers

  return { formattedContent, count: citationCount };
}

function finalCleanup(content: string): string {
  // =========================================================================
  // FIX UTF-8 MOJIBAKE (corrupted Portuguese accents)
  // =========================================================================
  // Common pattern: UTF-8 bytes decoded as Latin-1 then re-encoded
  const utf8Fixes: Array<[RegExp, string]> = [
    // Portuguese lowercase accents
    [/Ã§/g, 'ç'],
    [/Ã£/g, 'ã'],
    [/Ã©/g, 'é'],
    [/Ã¡/g, 'á'],
    [/Ã³/g, 'ó'],
    [/Ã­/g, 'í'],
    [/Ãº/g, 'ú'],
    [/Ã /g, 'à'],
    [/Ã´/g, 'ô'],
    [/Ãª/g, 'ê'],
    [/Ã¢/g, 'â'],
    [/Ãµ/g, 'õ'],
    // Portuguese uppercase accents
    [/Ã‡/g, 'Ç'],
    [/Ã/g, 'Á'],
    [/Ã€/g, 'À'],
    [/Ãƒ/g, 'Ã'],
    [/Ã‰/g, 'É'],
    [/Ã"/g, 'Ó'],
    [/Ãš/g, 'Ú'],
    // Quotes and dashes
    [/â€"/g, '—'],  // em dash
    [/â€"/g, '–'],  // en dash
    [/â€œ/g, '"'],  // left double quote
    [/â€/g, '"'],   // right double quote
    [/â€™/g, "'"],  // apostrophe
    [/â€˜/g, "'"],  // left single quote
    // Bullet points
    [/â€¢/g, '•'],
    // Ellipsis
    [/â€¦/g, '…'],
  ];

  for (const [pattern, replacement] of utf8Fixes) {
    content = content.replace(pattern, replacement);
  }

  // Remove excessive whitespace
  content = content.trim();
  content = content.replace(/ +$/gm, '');

  // Remove any control characters
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return content;
}

/**
 * Format a list of documents for display
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
