/* ============================================
   BACKEND RESPONSE TEMPLATES
   Exact format for all Koda responses
   ============================================ */

/**
 * CRITICAL RULES FOR BACKEND RESPONSE GENERATION:
 *
 * 1. Structure: Headline → Micro Label → Details (bullets) → Next Step
 * 2. Headline: 1-2 lines max, 16px, semibold
 * 3. Micro Labels: ALL CAPS (DETALHES, PRINCIPAIS ARQUIVOS, etc.)
 * 4. Details: ALWAYS as bullets (•), never paragraphs unless explaining concept
 * 5. Bold: ONLY for file names, key numbers, critical terms
 * 6. Next Step: 1 line, neutral tone, not salesy
 * 7. NO spacing between bullets (handled by CSS)
 * 8. Spacing between sections: 8-12px (handled by CSS)
 */

// ============================================
// TEMPLATE 1: Document List Response
// ============================================

export const formatDocumentListResponse = (
  query: string,
  documents: Array<{name: string, path: string, date: string, size: string}>,
  totalCount: number
): string => {
  const displayCount = Math.min(documents.length, 7);
  const remainingCount = totalCount - displayCount;

  return `Encontrei ${totalCount} documentos que mencionam "${query}".

### PRINCIPAIS ARQUIVOS

${documents.slice(0, displayCount).map(doc =>
  `• **${doc.name}**\n  Pasta: ${doc.path} · Atualizado em ${doc.date}`
).join('\n')}

${remainingCount > 0 ? `+ ${remainingCount} arquivos adicionais. Ver todos em Documentos > Pesquisa: "${query}".\n\n` : '\n'}Se quiser, posso resumir o conteúdo desses arquivos em até 5 pontos.`;
};

// Example output:
// Encontrei 16 documentos que mencionam "Koda".
//
// ### PRINCIPAIS ARQUIVOS
//
// • **Relatório_Koda_Implementação.pdf**
//   Pasta: /Clientes/Koda · Atualizado em 02/11/2025
//
// • **Koda_Integration_Guide_5_Presentation.pdf**
//   Pasta: /Projetos/Koda · Atualizado em 15/10/2025
//
// + 11 arquivos adicionais. Ver todos em Documentos > Pesquisa: "Koda".
//
// Se quiser, posso resumir o conteúdo desses arquivos em até 5 pontos.

// ============================================
// TEMPLATE 2: Comparison Response
// ============================================

export const formatComparisonResponse = (
  projects: Array<{name: string, goal: string, phase: string, methodology: string}>
): string => {
  return `Encontrei detalhes sobre ${projects.length} projetos distintos nos seus documentos.

### COMPARAÇÃO RÁPIDA

| Aspecto | ${projects[0].name} | ${projects[1].name} |
|---------|${'-'.repeat(projects[0].name.length + 2)}|${'-'.repeat(projects[1].name.length + 2)}|
| Objetivo Principal | ${projects[0].goal} | ${projects[1].goal} |
| Fase Atual | ${projects[0].phase} | ${projects[1].phase} |
| Metodologia | ${projects[0].methodology} | ${projects[1].methodology} |

### DETALHES

${projects.map((p, i) =>
  `• O projeto **"${p.name}"** está em fase de ${p.phase.toLowerCase()} e usa ${p.methodology.toLowerCase()}.`
).join('\n')}

Você quer que eu aprofunde em algum aspecto específico desses projetos?`;
};

// ============================================
// TEMPLATE 3: Fallback Response
// ============================================

export const formatFallbackResponse = (
  query: string,
  reason: 'no_context' | 'no_documents' | 'unclear'
): string => {
  const headlines: Record<string, string> = {
    no_context: `Não consigo responder o que é "${query}" com base no contexto da conversa atual.`,
    no_documents: `Não encontrei documentos relacionados a "${query}" nos seus arquivos.`,
    unclear: `Preciso de mais informações para responder sobre "${query}".`
  };

  const details: Record<string, string[]> = {
    no_context: [
      'Não encontrei informações suficientes no histórico da conversa.',
      `Você pode fazer upload do documento **"${query}"** para que eu possa analisá-lo.`,
      'Ou me forneça mais contexto sobre o que você está procurando.'
    ],
    no_documents: [
      'Verifiquei todos os documentos disponíveis na sua conta.',
      `Você pode fazer upload de documentos relacionados a **"${query}"**.`,
      'Ou tente reformular sua pergunta com outros termos.'
    ],
    unclear: [
      'Sua pergunta pode ser interpretada de várias formas.',
      'Você pode ser mais específico sobre o que deseja saber?',
      `Por exemplo: "Qual é o objetivo de ${query}?" ou "Quando foi criado ${query}?"`
    ]
  };

  return `${headlines[reason]}

### DETALHES

${details[reason].map(d => `• ${d}`).join('\n')}

Posso ajudar de outra forma?`;
};

// ============================================
// TEMPLATE 4: Summary Response
// ============================================

export const formatSummaryResponse = (
  title: string,
  keyPoints: string[],
  nextSteps?: string[]
): string => {
  return `${title}

### RESUMO RÁPIDO

${keyPoints.map(point => `• ${point}`).join('\n')}

${nextSteps && nextSteps.length > 0 ? `
### PRÓXIMOS PASSOS

${nextSteps.map(step => `• ${step}`).join('\n')}
` : ''}

Quer que eu aprofunde em algum desses pontos?`;
};

// ============================================
// TEMPLATE 5: Calculation Response
// ============================================

export const formatCalculationResponse = (
  expression: string,
  result: number | string,
  steps?: string[]
): string => {
  return `O resultado de **${expression}** é **${result}**.

${steps && steps.length > 0 ? `
### CÁLCULO

${steps.map(step => `• ${step}`).join('\n')}
` : ''}

Posso ajudar com outro cálculo?`;
};

// ============================================
// TEMPLATE 6: Excel Data Response
// ============================================

export const formatExcelDataResponse = (
  fileName: string,
  data: Array<Record<string, any>>,
  query: string
): string => {
  const columns = Object.keys(data[0]);

  return `Encontrei os dados solicitados em **${fileName}**.

### DADOS

| ${columns.join(' | ')} |
|${columns.map(() => '---').join('|')}|
${data.map(row => `| ${columns.map(col => row[col]).join(' | ')} |`).join('\n')}

Quer que eu analise esses dados ou gere um gráfico?`;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format file name with bold
 * Example: "report.pdf" → "**report.pdf**"
 */
export const boldFileName = (fileName: string): string => {
  return `**${fileName}**`;
};

/**
 * Format key number with bold
 * Example: "16 documentos" → "**16 documentos**"
 */
export const boldNumber = (text: string): string => {
  return text.replace(/(\d+)/g, '**$1**');
};

/**
 * Format meta text (paths, dates)
 * Example: "/path/to/file" → "`/path/to/file`"
 */
export const formatMetaText = (text: string): string => {
  return `\`${text}\``;
};

/**
 * Validate response format
 * Checks if response follows the correct structure
 */
export const validateResponseFormat = (response: string): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Check if headline exists (first line)
  const lines = response.trim().split('\n');
  if (lines.length === 0) {
    errors.push('Response is empty');
    return { valid: false, errors };
  }

  const headline = lines[0];

  // Check headline length (1-2 lines, max ~100 chars)
  if (headline.length > 120) {
    errors.push('Headline too long (max 120 chars)');
  }

  // Check if headline starts with ## (should NOT)
  if (headline.startsWith('##')) {
    errors.push('Headline should NOT start with ## (use plain text)');
  }

  // Check for micro labels (### UPPERCASE)
  const hasMicroLabels = response.match(/### [A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ\s]+/);
  if (!hasMicroLabels) {
    errors.push('Missing micro labels (### DETALHES, ### PRINCIPAIS ARQUIVOS, etc.)');
  }

  // Check for bullets
  const hasBullets = response.includes('• ');
  if (!hasBullets) {
    errors.push('Missing bullets (details should be in bullet format)');
  }

  // Check for bold usage (should have some **text**)
  const hasBold = response.includes('**');
  if (!hasBold) {
    errors.push('Missing bold text (file names, numbers should be bold)');
  }

  // Check for next step (last line should be a question or suggestion)
  const lastLine = lines[lines.length - 1].trim();
  if (!lastLine.endsWith('?') && !lastLine.includes('posso') && !lastLine.includes('quer')) {
    errors.push('Missing next step suggestion at the end');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================
// SYSTEM PROMPT ADDITION
// ============================================

export const RESPONSE_FORMAT_INSTRUCTIONS = `
FORMATO DE RESPOSTA (OBRIGATÓRIO):

Estrutura:
1. Headline (1-2 linhas, direto ao ponto)
2. Micro label (### DETALHES, ### PRINCIPAIS ARQUIVOS, etc.)
3. Details (bullets com •, nunca parágrafos)
4. Next step (1 linha, pergunta ou sugestão)

Tipografia:
- Headline: Texto normal, sem ##
- Micro labels: ### TEXTO EM MAIÚSCULAS
- Details: • Bullet points
- Bold: **APENAS** para nomes de arquivos, números-chave, termos críticos

Regras:
- NUNCA use ## para headline (apenas texto normal)
- SEMPRE use ### para micro labels (MAIÚSCULAS)
- SEMPRE use bullets (•) para details
- NUNCA coloque espaçamento entre bullets (CSS cuida disso)
- SEMPRE termine com uma pergunta ou sugestão
- NUNCA deixe bold em frases inteiras
- Máximo 7 bullets por seção

Exemplo:
Encontrei 16 documentos que mencionam "Koda".

### PRINCIPAIS ARQUIVOS

• **Relatório_Koda_Implementação.pdf**
  Pasta: /Clientes/Koda · Atualizado em 02/11/2025

• **Koda_Integration_Guide.pdf**
  Pasta: /Projetos/Koda · Atualizado em 15/10/2025

+ 14 arquivos adicionais. Ver todos em Documentos > Pesquisa: "Koda".

Se quiser, posso resumir o conteúdo desses arquivos em até 5 pontos.
`;

// ============================================
// EXPORT ALL TEMPLATES
// ============================================

export default {
  formatDocumentListResponse,
  formatComparisonResponse,
  formatFallbackResponse,
  formatSummaryResponse,
  formatCalculationResponse,
  formatExcelDataResponse,
  boldFileName,
  boldNumber,
  formatMetaText,
  validateResponseFormat,
  RESPONSE_FORMAT_INSTRUCTIONS
};
