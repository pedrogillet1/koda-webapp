/**
 * ============================================================================
 * SMART BOLDING ENHANCED SERVICE
 * ============================================================================
 *
 * Comprehensive smart bolding system that makes answers more engaging by
 * automatically bolding:
 * - Key terms and concepts
 * - Numbers, percentages, currency values
 * - Dates and deadlines
 * - Document names
 * - Entity names (people, companies, locations)
 * - Important phrases and conclusions
 * - Section headings
 *
 * This replaces the basic ensureBoldFormatting() in masterAnswerFormatter.service.ts
 *
 * ============================================================================
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface BoldingConfig {
  boldNumbers: boolean;
  boldDates: boolean;
  boldCurrency: boolean;
  boldPercentages: boolean;
  boldDocumentNames: boolean;
  boldEntityNames: boolean;
  boldKeyTerms: boolean;
  boldHeadings: boolean;
  boldImportantPhrases: boolean;
  boldQuotedText: boolean;
}

export const DEFAULT_BOLDING_CONFIG: BoldingConfig = {
  boldNumbers: true,
  boldDates: true,
  boldCurrency: true,
  boldPercentages: true,
  boldDocumentNames: true,
  boldEntityNames: true,
  boldKeyTerms: true,
  boldHeadings: true,
  boldImportantPhrases: true,
  boldQuotedText: false, // Usually quoted text is already emphasized
};

// ============================================================================
// MAIN SMART BOLDING FUNCTION
// ============================================================================

/**
 * Apply comprehensive smart bolding to answer text
 *
 * @param answer - The answer text to format
 * @param config - Bolding configuration (optional)
 * @returns Formatted answer with smart bolding
 */
export function applySmartBolding(
  answer: string,
  config: Partial<BoldingConfig> = {}
): string {
  const fullConfig = { ...DEFAULT_BOLDING_CONFIG, ...config };
  let formatted = answer;

  // Apply bolding in order of specificity (most specific first)
  // This prevents double-bolding and ensures correct precedence

  // 1. Bold headings (must be first to avoid conflicts)
  if (fullConfig.boldHeadings) {
    formatted = boldHeadings(formatted);
  }

  // 2. Bold currency values (before numbers to capture full value)
  if (fullConfig.boldCurrency) {
    formatted = boldCurrency(formatted);
  }

  // 3. Bold percentages (before numbers)
  if (fullConfig.boldPercentages) {
    formatted = boldPercentages(formatted);
  }

  // 4. Bold dates (before numbers)
  if (fullConfig.boldDates) {
    formatted = boldDates(formatted);
  }

  // 5. Bold numbers (general)
  if (fullConfig.boldNumbers) {
    formatted = boldNumbers(formatted);
  }

  // 6. Bold document names
  if (fullConfig.boldDocumentNames) {
    formatted = boldDocumentNames(formatted);
  }

  // 7. Bold entity names
  if (fullConfig.boldEntityNames) {
    formatted = boldEntityNames(formatted);
  }

  // 8. Bold key terms
  if (fullConfig.boldKeyTerms) {
    formatted = boldKeyTerms(formatted);
  }

  // 9. Bold important phrases
  if (fullConfig.boldImportantPhrases) {
    formatted = boldImportantPhrases(formatted);
  }

  // 10. Bold quoted text (if enabled)
  if (fullConfig.boldQuotedText) {
    formatted = boldQuotedText(formatted);
  }

  // 11. Clean up any double-bolding
  formatted = cleanupBolding(formatted);

  return formatted;
}

// ============================================================================
// BOLDING FUNCTIONS
// ============================================================================

/**
 * Bold section headings and titles
 */
function boldHeadings(text: string): string {
  let formatted = text;

  // Pattern 1: Capitalized headings followed by colon (not already bold)
  // Example: "Visão Geral:" → "**Visão Geral:**"
  formatted = formatted.replace(
    /^(?!\*\*)([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][A-ZÀÁÃÂÉÊÍÓÕÔÚÇa-zàáãâéêíóõôúç\s]+):(?!\*\*)/gm,
    '**$1:**'
  );

  // Pattern 2: Numbered headings (not already bold)
  // Example: "1. Principais Riscos" → "**1. Principais Riscos**"
  formatted = formatted.replace(
    /^(?!\*\*)(\d+\.\s+[A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][A-Za-zàáãâéêíóõôúç\s]+)(?!\*\*)/gm,
    '**$1**'
  );

  // Pattern 3: Key terms followed by colon and definition (start of line)
  // Example: "ROI: Return on Investment" → "**ROI:** Return on Investment"
  formatted = formatted.replace(
    /^(?!\*\*)([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][a-zàáãâéêíóõôúç]+(?:\s+[A-ZÀÁÃÂÉÊÍÓÕÔÚÇ]?[a-zàáãâéêíóõôúç]+)*):(?!\*\*)\s/gm,
    '**$1:** '
  );

  return formatted;
}

/**
 * Bold currency values
 */
function boldCurrency(text: string): string {
  let formatted = text;

  // Pattern 1: R$ values (Brazilian Real)
  // Example: "R$ 1.500,00" → "**R$ 1.500,00**"
  formatted = formatted.replace(
    /(?<!\*\*)\bR\$\s*[\d.,]+(?!\*\*)/g,
    (match) => `**${match}**`
  );

  // Pattern 2: USD values
  // Example: "$1,500.00" or "USD 1,500.00" → "**$1,500.00**"
  formatted = formatted.replace(
    /(?<!\*\*)(?:\$|USD)\s*[\d.,]+(?!\*\*)/g,
    (match) => `**${match}**`
  );

  // Pattern 3: EUR values
  // Example: "€1,500.00" or "EUR 1,500.00" → "**€1,500.00**"
  formatted = formatted.replace(
    /(?<!\*\*)(?:€|EUR)\s*[\d.,]+(?!\*\*)/g,
    (match) => `**${match}**`
  );

  // Pattern 4: Currency values with "reais", "dólares", etc.
  // Example: "1.500 reais" → "**1.500 reais**"
  formatted = formatted.replace(
    /(?<!\*\*)\b([\d.,]+)\s+(reais|dólares|euros|libras)(?!\*\*)/gi,
    '**$1 $2**'
  );

  return formatted;
}

/**
 * Bold percentages
 */
function boldPercentages(text: string): string {
  let formatted = text;

  // Pattern: Number followed by %
  // Example: "15%" or "15 %" → "**15%**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(\d+(?:[.,]\d+)?)\s*%(?!\*\*)/g,
    '**$1%**'
  );

  return formatted;
}

/**
 * Bold dates and deadlines
 */
function boldDates(text: string): string {
  let formatted = text;

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  // Example: "15/03/2024" → "**15/03/2024**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?!\*\*)/g,
    '**$1**'
  );

  // Pattern 2: YYYY-MM-DD (ISO format)
  // Example: "2024-03-15" → "**2024-03-15**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(\d{4}-\d{2}-\d{2})(?!\*\*)/g,
    '**$1**'
  );

  // Pattern 3: Month names with year (Portuguese)
  // Example: "março de 2024" → "**março de 2024**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})(?!\*\*)/gi,
    '**$1 de $2**'
  );

  // Pattern 4: English month names
  // Example: "March 2024" → "**March 2024**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})(?!\*\*)/g,
    '**$1 $2**'
  );

  // Pattern 5: Deadline phrases
  // Example: "prazo de 30 dias" → "prazo de **30 dias**"
  formatted = formatted.replace(
    /\b(prazo|deadline|within|até|until)\s+(?:de\s+)?(?<!\*\*)(\d+\s+(?:dias?|days?|meses|months?|anos?|years?))(?!\*\*)/gi,
    '$1 **$2**'
  );

  return formatted;
}

/**
 * Bold numbers (general)
 */
function boldNumbers(text: string): string {
  let formatted = text;

  // Pattern 1: Large numbers with separators
  // Example: "1.500.000" or "1,500,000" → "**1.500.000**"
  formatted = formatted.replace(
    /(?<!\*\*)(?<![R$€\d])\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)(?!\*\*)(?![%\d])/g,
    '**$1**'
  );

  // Pattern 2: Numbers with units (m², km, kg, etc.)
  // Example: "500 m²" → "**500 m²**"
  formatted = formatted.replace(
    /(?<!\*\*)\b(\d+(?:[.,]\d+)?)\s*(m[²2]|km|kg|ton|litros?|metros?|quilômetros?)(?!\*\*)/gi,
    '**$1 $2**'
  );

  // Pattern 3: Standalone significant numbers (3+ digits)
  // Example: "1500" → "**1500**" (but not "5" or "10")
  formatted = formatted.replace(
    /(?<!\*\*)(?<![R$€\d])\b(\d{3,})(?!\*\*)(?![%\d.,])/g,
    '**$1**'
  );

  return formatted;
}

/**
 * Bold document names
 */
function boldDocumentNames(text: string): string {
  let formatted = text;

  // Pattern: Filenames with common extensions
  // Example: "contrato_locacao.pdf" → "**contrato_locacao.pdf**"
  // Skip if already has [[DOC: marker (handled by documentNameFormatter)
  formatted = formatted.replace(
    /(?<!\*\*)(?<!\[\[DOC:[^\]]*)\b([A-Za-z0-9_\-]+\.(?:pdf|docx|xlsx|pptx|doc|xls|ppt|txt|csv))(?!\*\*)(?!\]\])/g,
    '**$1**'
  );

  return formatted;
}

/**
 * Bold entity names (people, companies, locations)
 */
function boldEntityNames(text: string): string {
  let formatted = text;

  // Pattern 1: Capitalized names (2+ words, all capitalized)
  // Example: "Guarda Bens Self Storage" → "**Guarda Bens Self Storage**"
  formatted = formatted.replace(
    /(?<!\*\*)(?<![.]\s)\b([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][a-zàáãâéêíóõôúç]+(?:\s+[A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][a-zàáãâéêíóõôúç]+){1,4})(?!\*\*)/g,
    (match, p1, offset, string) => {
      // Don't bold if it's at the start of a sentence (likely just a sentence start)
      if (offset === 0 || string[offset - 1] === '\n' || (offset >= 2 && string[offset - 2] === '.')) {
        return match;
      }
      // Don't bold if it's a common phrase
      const commonPhrases = [
        'De Acordo Com', 'Em Conformidade', 'Por Favor', 'Muito Obrigado',
        'Bom Dia', 'Boa Tarde', 'Boa Noite', 'Por Exemplo', 'No Entanto',
        'Além Disso', 'Em Resumo', 'Em Conclusão'
      ];
      if (commonPhrases.some(phrase => p1.includes(phrase))) {
        return match;
      }
      return `**${match}**`;
    }
  );

  // Pattern 2: Company suffixes (Ltda, S.A., Inc, LLC, etc.)
  // Example: "Empresa XYZ Ltda" → "**Empresa XYZ Ltda**"
  formatted = formatted.replace(
    /(?<!\*\*)\b([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][A-Za-zàáãâéêíóõôúç\s]+(?:Ltda|S\.A\.|Inc|LLC|Corp|Ltd))(?!\*\*)/g,
    '**$1**'
  );

  return formatted;
}

/**
 * Bold key legal/financial/technical terms
 */
function boldKeyTerms(text: string): string {
  let formatted = text;

  // Define key terms to bold (case-insensitive)
  const keyTerms = [
    // Legal terms
    'LGPD', 'GDPR', 'rescisão', 'multa', 'penalidade', 'cláusula',
    'obrigação', 'responsabilidade', 'prazo', 'vigência', 'foro',
    'jurisdição', 'confidencialidade', 'não concorrência',
    'contratante', 'contratado', 'locador', 'locatário',

    // Financial terms
    'ROI', 'TIR', 'IRR', 'payback', 'fluxo de caixa', 'cash flow',
    'CAPEX', 'OPEX', 'lucro líquido', 'lucro bruto', 'receita',
    'despesa', 'investimento', 'viabilidade', 'rentabilidade',
    'margem', 'markup', 'break-even',

    // Project management terms
    'Scrum', 'Kanban', 'sprint', 'backlog', 'milestone', 'entregável',
    'cronograma', 'stakeholder', 'PMO', 'PMBOK',

    // General important terms
    'risco', 'riscos', 'oportunidade', 'objetivo', 'meta', 'estratégia',
    'análise', 'conclusão', 'recomendação', 'vantagem', 'desvantagem'
  ];

  // Bold each key term (whole word only, not already bold)
  for (const term of keyTerms) {
    const regex = new RegExp(
      `(?<!\\*\\*)\\b(${escapeRegex(term)})\\b(?!\\*\\*)`,
      'gi'
    );
    formatted = formatted.replace(regex, '**$1**');
  }

  return formatted;
}

/**
 * Bold important phrases and conclusions
 */
function boldImportantPhrases(text: string): string {
  let formatted = text;

  // Define important phrase patterns
  const importantPhrases = [
    // Conclusions (Portuguese)
    /\b(em resumo)\b/gi,
    /\b(em conclusão)\b/gi,
    /\b(portanto)\b/gi,
    /\b(assim sendo)\b/gi,
    /\b(concluindo)\b/gi,

    // Conclusions (English)
    /\b(in summary)\b/gi,
    /\b(in conclusion)\b/gi,
    /\b(therefore)\b/gi,
    /\b(to summarize)\b/gi,

    // Emphasis (Portuguese)
    /\b(é importante)\b/gi,
    /\b(é fundamental)\b/gi,
    /\b(é crucial)\b/gi,
    /\b(é essencial)\b/gi,
    /\b(vale ressaltar)\b/gi,
    /\b(destaca-se)\b/gi,

    // Emphasis (English)
    /\b(it's important)\b/gi,
    /\b(it is important)\b/gi,
    /\b(it's essential)\b/gi,
    /\b(it's crucial)\b/gi,

    // Warnings
    /\b(atenção)\b/gi,
    /\b(cuidado)\b/gi,
    /\b(alerta)\b/gi,
    /\b(attention)\b/gi,
    /\b(warning)\b/gi,
    /\b(caution)\b/gi,

    // Recommendations
    /\b(recomenda-se)\b/gi,
    /\b(sugere-se)\b/gi,
    /\b(aconselha-se)\b/gi,
    /\b(it's recommended)\b/gi,
  ];

  for (const pattern of importantPhrases) {
    formatted = formatted.replace(pattern, (match) => {
      // Don't bold if already bold
      const index = formatted.indexOf(match);
      if (index > 1 && formatted.substring(index - 2, index) === '**') {
        return match;
      }
      return `**${match}**`;
    });
  }

  return formatted;
}

/**
 * Bold quoted text (optional)
 */
function boldQuotedText(text: string): string {
  let formatted = text;

  // Pattern: Text in quotes
  // Example: "prazo de 30 dias" → **"prazo de 30 dias"**
  formatted = formatted.replace(
    /(?<!\*\*)"([^"]+)"(?!\*\*)/g,
    '**"$1"**'
  );

  return formatted;
}

/**
 * Clean up double-bolding and formatting issues
 */
function cleanupBolding(text: string): string {
  let formatted = text;

  // Remove quadruple or more asterisks
  // Example: "****text****" → "**text**"
  formatted = formatted.replace(/\*{4,}/g, '**');

  // Fix nested bold - remove inner markers
  // Example: "**text **inner** text**" → "**text inner text**"
  let prevFormatted = '';
  while (prevFormatted !== formatted) {
    prevFormatted = formatted;
    formatted = formatted.replace(/\*\*([^*]*)\*\*([^*]*)\*\*([^*]*)\*\*/g, '**$1$2$3**');
  }

  // Remove bold from empty strings
  // Example: "** **" → " "
  formatted = formatted.replace(/\*\*\s*\*\*/g, '');

  // Fix spacing around bold markers (remove leading/trailing spaces inside)
  // Example: "** text**" → "**text**"
  formatted = formatted.replace(/\*\*\s+([^*]+)\*\*/g, '**$1**');
  formatted = formatted.replace(/\*\*([^*]+)\s+\*\*/g, '**$1**');

  return formatted;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Test smart bolding with sample text
 */
export function testSmartBolding(): void {
  const testCases = [
    {
      name: 'Currency',
      input: 'O investimento inicial é de R$ 1.500.000,00 e o retorno esperado é de $50,000.',
    },
    {
      name: 'Percentages',
      input: 'A margem de lucro é de 15% e o crescimento anual é de 8,5%.',
    },
    {
      name: 'Dates',
      input: 'O contrato vence em 15/03/2024 e tem prazo de 30 dias.',
    },
    {
      name: 'Document names',
      input: 'Veja o documento analise_mezanino.pdf e o contrato_locacao.docx.',
    },
    {
      name: 'Headings',
      input: 'Principais Riscos:\nO projeto apresenta riscos financeiros.',
    },
    {
      name: 'Key terms',
      input: 'O ROI do projeto é positivo e a LGPD está em conformidade.',
    },
    {
      name: 'Important phrases',
      input: 'É importante notar que o prazo é crucial. Em conclusão, o projeto é viável.',
    },
    {
      name: 'Combined',
      input: `Análise Financeira:
O investimento de R$ 500.000,00 tem ROI de 15% ao ano.
O contrato vence em 15/03/2024, com prazo de 30 dias para rescisão.
Em conclusão, é importante considerar os riscos antes de prosseguir.`,
    }
  ];

  console.log('=== SMART BOLDING TEST ===\n');

  for (const testCase of testCases) {
    const result = applySmartBolding(testCase.input);
    const boldCount = (result.match(/\*\*/g) || []).length / 2;

    console.log(`Test: ${testCase.name}`);
    console.log(`Input:    ${testCase.input.replace(/\n/g, '\\n')}`);
    console.log(`Output:   ${result.replace(/\n/g, '\\n')}`);
    console.log(`Bold items: ${boldCount}`);
    console.log(`Status:   ${boldCount > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  applySmartBolding,
  testSmartBolding,
  DEFAULT_BOLDING_CONFIG,
};
