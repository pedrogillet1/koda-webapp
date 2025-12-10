/**
 * ============================================================================
 * KODA SKILL TAXONOMY - EXTENDED WITH STYLE METADATA
 * ============================================================================
 *
 * Complete skill definitions including:
 * - Detection patterns
 * - Retrieval strategies
 * - Answer style and formatting
 * - Speed profiles
 * - Token budgets
 *
 * ============================================================================
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum SkillDomain {
  GENERAL = 'GENERAL',
  LEGAL = 'LEGAL',
  FINANCIAL = 'FINANCIAL',
  PROJECT = 'PROJECT',
  TECHNICAL = 'TECHNICAL',
}

export enum SkillMode {
  META = 'META', // No docs needed (greetings, help, counts)
  GENERIC_CHAT = 'GENERIC_CHAT', // General conversation
  DOC_FACT = 'DOC_FACT', // Simple fact extraction
  DOC_EXPLAIN = 'DOC_EXPLAIN', // Explanation of content
  DOC_ANALYSIS = 'DOC_ANALYSIS', // Deep analysis
  MULTI_DOC_ANALYSIS = 'MULTI_DOC_ANALYSIS', // Cross-document analysis
}

export enum SkillComplexity {
  LIGHT = 'LIGHT', // 2-4 sentences
  NORMAL = 'NORMAL', // 2-3 paragraphs or sections
  DEEP = 'DEEP', // 2-4 sections with headings and bullets
}

export enum SpeedProfile {
  ULTRA_FAST = 'ULTRA_FAST', // <1.5s - no RAG
  FAST = 'FAST', // 1.5-3s - shallow RAG
  NORMAL = 'NORMAL', // 3-5s - normal RAG
  DEEP = 'DEEP', // 5-8s - full RAG with analysis
}

export enum OutputFormat {
  FACT = 'FACT', // Direct answer + brief explanation
  SUMMARY = 'SUMMARY', // Condensed overview
  EXPLANATION = 'EXPLANATION', // Detailed explanation
  LIST = 'LIST', // Bulleted or numbered list
  COMPARISON = 'COMPARISON', // Side-by-side comparison
  DIAGNOSTIC = 'DIAGNOSTIC', // Structured assessment (present/missing/weak)
  OUTLINE = 'OUTLINE', // Hierarchical structure
  QUOTE = 'QUOTE', // Verbatim text extraction
}

export enum TokenBudget {
  SHORT = 'SHORT', // 200-300 tokens
  MEDIUM = 'MEDIUM', // 600-900 tokens
  LONG = 'LONG', // 1000-1500 tokens
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface SkillConfig {
  skillId: string;
  skillName: string;
  domain: SkillDomain;
  mode: SkillMode;
  depthDefault: SkillComplexity;
  speedProfile: SpeedProfile;
  outputFormat: OutputFormat;

  // Detection
  patterns: RegExp[];
  examples: string[];

  // Retrieval
  retrievalStrategy: 'semantic' | 'keyword' | 'hybrid' | 'full-doc' | 'none';
  requiresMultiDoc: boolean;
  requiresCalculation: boolean;
  topKDefault: number;

  // Answer Style
  defaultSections?: string[];
  useBullets: boolean;
  useHeadings: boolean;
  highlightRules: string[]; // What to bold: numbers, names, etc.
  tokenBudget: TokenBudget;

  // Prompt Template
  promptTemplateId: string;
}

// ============================================================================
// SKILL REGISTRY
// ============================================================================

export const EXTENDED_SKILL_REGISTRY: Record<string, SkillConfig> = {
  // ===== GENERAL SKILLS =====

  'GENERAL.LIST_DOCUMENTS': {
    skillId: 'GENERAL.LIST_DOCUMENTS',
    skillName: 'List Documents',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.META,
    depthDefault: SkillComplexity.LIGHT,
    speedProfile: SpeedProfile.ULTRA_FAST,
    outputFormat: OutputFormat.LIST,

    patterns: [
      /\b(list(ar?|e)?|mostr(ar?|e)|exib(ir|a)|quais?|quantos?)\s+(meus?\s+)?(documentos?|arquivos?|files?|pdfs?)\b/i,
      /\b(what|which)\s+documents?\s+(do\s+i\s+have|are\s+there)\b/i,
    ],
    examples: [
      'Liste meus documentos',
      'Quais documentos eu tenho?',
      'Quantos arquivos tenho sobre LGPD?',
    ],

    retrievalStrategy: 'none',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 0,

    useBullets: true,
    useHeadings: true,
    highlightRules: ['document names', 'counts'],
    tokenBudget: TokenBudget.SHORT,

    promptTemplateId: 'list_documents',
  },

  'GENERAL.EXPLAIN_SECTION': {
    skillId: 'GENERAL.EXPLAIN_SECTION',
    skillName: 'Explain Section',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.DOC_EXPLAIN,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.EXPLANATION,

    patterns: [
      /\b(expliqu?e|explica|explicar|o\s+que\s+(é|significa)|clarifica|descreva?)\b.*\b(seção|se[cç][aã]o|parágrafo|parte|trecho)\b/i,
      /\bwhat\s+does\s+.+\s+mean\b/i,
    ],
    examples: [
      'Explique a seção 3.2',
      'O que significa essa cláusula?',
      'Me explica esse trecho',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 10,

    defaultSections: [
      'O que essa seção diz',
      'O que significa na prática',
      'Pontos importantes',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['key terms', 'important concepts'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'explain_section',
  },

  'GENERAL.SUMMARIZE_DOCUMENT': {
    skillId: 'GENERAL.SUMMARIZE_DOCUMENT',
    skillName: 'Summarize Document',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.DOC_EXPLAIN,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.SUMMARY,

    patterns: [
      /\b(resum(ir?|o|a|e)|sumári(o|a)|tldr|visão\s+geral|overview)\b.*\b(documento|arquivo|pdf|contrato)\b/i,
      /\b(resum(ir?|o|a|e))\s+(est[ea]|ess[ea]|o|a)\s/i,
      /\bwhat\s+is\s+.+\s+about\b/i,
    ],
    examples: [
      'Resuma este documento',
      'Qual é o resumo do contrato?',
      'Me dá uma visão geral',
    ],

    retrievalStrategy: 'full-doc',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 20,

    defaultSections: ['Visão geral', 'Tópicos principais', 'Decisões/conclusões'],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['key topics', 'main conclusions'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'summarize_document',
  },

  'GENERAL.FIND_WHERE_IT_SAYS_X': {
    skillId: 'GENERAL.FIND_WHERE_IT_SAYS_X',
    skillName: 'Find Where It Says X',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.DOC_FACT,
    depthDefault: SkillComplexity.LIGHT,
    speedProfile: SpeedProfile.FAST,
    outputFormat: OutputFormat.QUOTE,

    patterns: [
      /\b(onde|aonde)\s+(diz|fala|menciona|está\s+escrito|aparece)\b/i,
      /\b(find|locate)\s+where\b/i,
      /\bwhich\s+(section|page|paragraph)\s+(says|mentions)\b/i,
    ],
    examples: [
      'Onde diz que o prazo é 30 dias?',
      'Onde fala sobre multa?',
      'Em qual seção está a definição de LGPD?',
    ],

    retrievalStrategy: 'keyword',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 5,

    useBullets: false,
    useHeadings: false,
    highlightRules: ['section names', 'page numbers', 'quoted text'],
    tokenBudget: TokenBudget.SHORT,

    promptTemplateId: 'find_where_it_says',
  },

  'GENERAL.COMPARE_TWO_SECTIONS': {
    skillId: 'GENERAL.COMPARE_TWO_SECTIONS',
    skillName: 'Compare Two Sections',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.COMPARISON,

    patterns: [
      /\b(compar(ar?|a|e)|diferença\s+entre|contrast(ar?|e))\s+.+\s+(e|com|vs|versus)\b/i,
      /\bhow\s+(do|does)\s+.+\s+differ\b/i,
    ],
    examples: [
      'Compare a seção 3 com a seção 5',
      'Qual a diferença entre cláusula A e B?',
      'Compare versão 1 e 2',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 15,

    defaultSections: ['Semelhanças', 'Diferenças', 'Impacto prático'],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['section names', 'key differences', 'similarities'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'compare_sections',
  },

  'GENERAL.CHECK_MISSING_PIECES': {
    skillId: 'GENERAL.CHECK_MISSING_PIECES',
    skillName: 'Check Missing Pieces',
    domain: SkillDomain.GENERAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(o\s+que\s+(está\s+)?falta(ndo)?|missing|incomplete|lacunas|gaps)\b/i,
      /\b(está\s+completo|check\s+completeness)\b/i,
    ],
    examples: [
      'O que está faltando nesse documento?',
      'Esse documento está completo?',
      'Identifique as lacunas',
    ],

    retrievalStrategy: 'full-doc',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 30,

    defaultSections: [
      'O que está presente',
      'O que está presente mas fraco',
      'O que parece faltar',
      'Sugestões de melhoria',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['missing items', 'weak sections', 'recommendations'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'check_missing_pieces',
  },

  // ===== LEGAL SKILLS =====

  'LEGAL.EXPLAIN_CLAUSE': {
    skillId: 'LEGAL.EXPLAIN_CLAUSE',
    skillName: 'Explain Legal Clause',
    domain: SkillDomain.LEGAL,
    mode: SkillMode.DOC_EXPLAIN,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.EXPLANATION,

    patterns: [
      /\b(expliqu?e|explica|explicar|o\s+que\s+significa)\b.*\b(cláusula|cl[áa]usula|artigo|termo)\b/i,
      /\bwhat\s+does\s+clause\s+\d+\s+mean\b/i,
    ],
    examples: [
      'Explique a cláusula 5.3',
      'O que significa a cláusula de indenização?',
      'Me explica esse termo',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 10,

    defaultSections: [
      'O que a cláusula diz',
      'Na prática isso significa',
      'Pontos de atenção',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['clause numbers', 'obligations', 'rights', 'risks'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'explain_clause',
  },

  'LEGAL.SCAN_FOR_RISKS': {
    skillId: 'LEGAL.SCAN_FOR_RISKS',
    skillName: 'Scan for Legal Risks',
    domain: SkillDomain.LEGAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.DEEP,
    speedProfile: SpeedProfile.DEEP,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(escanei(ar?|a)|identific(ar?|a)|quais\s+(são\s+)?os)\s+(riscos?|red\s+flags|preocupa[çc][õo]es)\b/i,
      /\bscan\s+for\s+risks\b/i,
    ],
    examples: [
      'Escaneie esse contrato por riscos',
      'Quais são os riscos legais?',
      'Identifique red flags',
    ],

    retrievalStrategy: 'full-doc',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 40,

    defaultSections: ['Riscos identificados', 'Impacto prático', 'Recomendações'],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['risk severity (Alto/Médio/Baixo)', 'clause names', 'recommendations'],
    tokenBudget: TokenBudget.LONG,

    promptTemplateId: 'scan_for_risks',
  },

  'LEGAL.CHECK_COMPLETENESS_LEGAL': {
    skillId: 'LEGAL.CHECK_COMPLETENESS_LEGAL',
    skillName: 'Check Legal Completeness',
    domain: SkillDomain.LEGAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.DEEP,
    speedProfile: SpeedProfile.DEEP,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(esse\s+contrato\s+(está\s+)?completo|tem\s+todas\s+as\s+cláusulas|cláusulas\s+padrão)\b/i,
      /\bdoes\s+this\s+contract\s+have\s+the\s+usual\s+clauses\b/i,
    ],
    examples: [
      'Esse contrato está completo?',
      'Tem todas as cláusulas padrão?',
      'O que falta nesse contrato?',
    ],

    retrievalStrategy: 'full-doc',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 40,

    defaultSections: [
      'Cláusulas presentes e claras',
      'Cláusulas presentes mas fracas',
      'Cláusulas ausentes',
      'Sugestões',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['clause names', 'status (presente/ausente)', 'recommendations'],
    tokenBudget: TokenBudget.LONG,

    promptTemplateId: 'check_completeness_legal',
  },

  'LEGAL.CHECK_LGPD_COMPLIANCE': {
    skillId: 'LEGAL.CHECK_LGPD_COMPLIANCE',
    skillName: 'Check LGPD Compliance',
    domain: SkillDomain.LEGAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.DEEP,
    speedProfile: SpeedProfile.DEEP,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(lgpd|lei\s+geral\s+de\s+prote[çc][ãa]o\s+de\s+dados)\b/i,
      /\b(check\s+lgpd|lgpd\s+compliance|compliant\s+with\s+lgpd)\b/i,
    ],
    examples: [
      'Esse contrato segue LGPD?',
      'Check LGPD compliance',
      'Quais pontos de LGPD estão aqui?',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 30,

    defaultSections: [
      'Aspectos em conformidade',
      'Aspectos frágeis/incompletos',
      'Pontos ausentes',
      'Recomendações',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['LGPD elements', 'compliance status', 'recommendations'],
    tokenBudget: TokenBudget.LONG,

    promptTemplateId: 'check_lgpd_compliance',
  },

  // ===== FINANCIAL SKILLS =====

  'FINANCIAL.CHECK_CALCULATIONS': {
    skillId: 'FINANCIAL.CHECK_CALCULATIONS',
    skillName: 'Check Calculations',
    domain: SkillDomain.FINANCIAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.DEEP,
    speedProfile: SpeedProfile.DEEP,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(verifiqu?e|verifica|verificar|confira|conferir|check)\b.*\b(cálculos?|contas?|números?|math|planilha)\b/i,
      /\besses\s+números\s+batem\b/i,
    ],
    examples: [
      'Verifique os cálculos',
      'Esses números batem?',
      'Confira essa planilha',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: true,
    topKDefault: 20,

    defaultSections: [
      'O que o documento diz',
      'O que foi recalculado',
      'Diferenças encontradas',
      'Possíveis causas',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['numbers', 'calculations', 'differences', 'status (correto/erro)'],
    tokenBudget: TokenBudget.LONG,

    promptTemplateId: 'check_calculations',
  },

  'FINANCIAL.SCENARIO_ANALYSIS': {
    skillId: 'FINANCIAL.SCENARIO_ANALYSIS',
    skillName: 'Scenario Analysis',
    domain: SkillDomain.FINANCIAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.DEEP,
    speedProfile: SpeedProfile.DEEP,
    outputFormat: OutputFormat.COMPARISON,

    patterns: [
      /\banálise\s+de\s+cenários?\b/i,
      /\b(cenário|scenario|what\s+if|sensibilidade|sensitivity)\b.*\b(analysis|análise)\b/i,
      /\b(melhor\s+caso|pior\s+caso|best\s+case|worst\s+case)\b/i,
    ],
    examples: [
      'Faça uma análise de cenários',
      'E se a receita aumentar 10%?',
      'Mostre melhor e pior caso',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: true,
    topKDefault: 25,

    defaultSections: [
      'Resumo dos cenários',
      'ROI e indicadores',
      'Comparação',
      'Minha leitura',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['scenario names', 'numbers', 'ROI', 'key metrics'],
    tokenBudget: TokenBudget.LONG,

    promptTemplateId: 'scenario_analysis',
  },

  'FINANCIAL.EXPLAIN_MODEL': {
    skillId: 'FINANCIAL.EXPLAIN_MODEL',
    skillName: 'Explain Financial Model',
    domain: SkillDomain.FINANCIAL,
    mode: SkillMode.DOC_EXPLAIN,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.EXPLANATION,

    patterns: [
      /\b(explic(ar?|a|ue)|como\s+funciona)\s+(o\s+|esse\s+)?(modelo|fórmula|cálculo)\b/i,
      /\bhow\s+is\s+.+\s+calculated\b/i,
    ],
    examples: [
      'Explique esse modelo financeiro',
      'Como é calculado o NPV?',
      'Como funciona essa fórmula?',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: false,
    topKDefault: 15,

    defaultSections: [
      'Como o modelo funciona',
      'Principais premissas',
      'O que o resultado te diz',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['formula names', 'key assumptions', 'inputs/outputs'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'explain_model',
  },

  'FINANCIAL.CHECK_SANITY_NUMBERS': {
    skillId: 'FINANCIAL.CHECK_SANITY_NUMBERS',
    skillName: 'Check Sanity of Numbers',
    domain: SkillDomain.FINANCIAL,
    mode: SkillMode.DOC_ANALYSIS,
    depthDefault: SkillComplexity.NORMAL,
    speedProfile: SpeedProfile.NORMAL,
    outputFormat: OutputFormat.DIAGNOSTIC,

    patterns: [
      /\b(sanity\s+check|esses\s+números\s+fazem\s+sentido|razoáveis?|outliers?)\b/i,
      /\bdo\s+these\s+numbers\s+make\s+sense\b/i,
    ],
    examples: [
      'Sanity check nesses números',
      'Esses números fazem sentido?',
      'Identifique outliers',
    ],

    retrievalStrategy: 'semantic',
    requiresMultiDoc: false,
    requiresCalculation: true,
    topKDefault: 20,

    defaultSections: [
      'Números que parecem consistentes',
      'Números que parecem agressivos/estranhos',
      'Pontos para revisar',
    ],
    useBullets: true,
    useHeadings: true,
    highlightRules: ['numbers', 'outliers', 'status (consistente/estranho)'],
    tokenBudget: TokenBudget.MEDIUM,

    promptTemplateId: 'check_sanity_numbers',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get skill config by ID
 */
export function getSkillConfig(skillId: string): SkillConfig | null {
  return EXTENDED_SKILL_REGISTRY[skillId] || null;
}

/**
 * Get all skills for a domain
 */
export function getSkillsByDomain(domain: SkillDomain): SkillConfig[] {
  return Object.values(EXTENDED_SKILL_REGISTRY).filter((skill) => skill.domain === domain);
}

/**
 * Get all skills for a mode
 */
export function getSkillsByMode(mode: SkillMode): SkillConfig[] {
  return Object.values(EXTENDED_SKILL_REGISTRY).filter((skill) => skill.mode === mode);
}

/**
 * Get all skills for a speed profile
 */
export function getSkillsBySpeedProfile(speedProfile: SpeedProfile): SkillConfig[] {
  return Object.values(EXTENDED_SKILL_REGISTRY).filter((skill) => skill.speedProfile === speedProfile);
}

/**
 * Get token limit for a token budget
 */
export function getTokenLimit(tokenBudget: TokenBudget): number {
  switch (tokenBudget) {
    case TokenBudget.SHORT:
      return 300;
    case TokenBudget.MEDIUM:
      return 900;
    case TokenBudget.LONG:
      return 1500;
    default:
      return 900;
  }
}

export default {
  EXTENDED_SKILL_REGISTRY,
  getSkillConfig,
  getSkillsByDomain,
  getSkillsByMode,
  getSkillsBySpeedProfile,
  getTokenLimit,
};
