/**
 * ============================================================================
 * KODA BM25 KEYWORD CONFIGURATION
 * ============================================================================
 *
 * Complete keyword mapping for BM25 boosting and intent detection.
 * Organized by skill domain and skill type.
 *
 * Usage:
 * 1. Intent detection: Match query tokens against keyword sets
 * 2. BM25 boosting: Add matched keywords to BM25 query for better retrieval
 * 3. Skill routing: Use keyword scores to route to appropriate skill
 *
 * ============================================================================
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface SkillKeywords {
  skillId: string;
  skillName: string;
  pt: string[]; // Portuguese keywords
  en: string[]; // English keywords
}

export interface DomainKeywords {
  domain: string;
  skills: SkillKeywords[];
}

// ============================================================================
// GLOBAL / UTILITY KEYWORDS
// ============================================================================

export const GLOBAL_KEYWORDS = {
  // Document/file/contract references
  pt: [
    'documento', 'documentos', 'arquivo', 'arquivos', 'contrato', 'contratos',
    'cláusula', 'cláusulas', 'seção', 'seções', 'capítulo', 'capítulos',
    'parágrafo', 'parágrafos', 'termo', 'termos', 'anexo', 'anexos',
    'apêndice', 'apêndices', 'slide', 'slides', 'apresentação',
    'planilha', 'planilhas'
  ],
  en: [
    'document', 'documents', 'file', 'files', 'contract', 'contracts',
    'clause', 'clauses', 'section', 'sections', 'chapter', 'chapters',
    'paragraph', 'paragraphs', 'term', 'terms', 'annex', 'appendix',
    'slide', 'slides', 'presentation', 'spreadsheet', 'sheet', 'workbook'
  ]
};

// ============================================================================
// DOMAIN KEYWORD REGISTRY
// ============================================================================

export const BM25_KEYWORD_REGISTRY: DomainKeywords[] = [
  // ========================================================================
  // GENERAL DOCUMENT SKILLS
  // ========================================================================
  {
    domain: 'GENERAL',
    skills: [
      {
        skillId: 'GENERAL.LIST_DOCUMENTS',
        skillName: 'List Documents / Meta Info',
        pt: [
          'quantos documentos', 'listar documentos', 'liste documentos',
          'todos os documentos', 'meus documentos', 'tipos de arquivos',
          'tipos de documentos', 'extensão', 'tamanho', 'última modificação',
          'data de upload', 'número de arquivos'
        ],
        en: [
          'how many documents', 'list documents', 'list all documents',
          'my documents', 'all my files', 'file types', 'document types',
          'extension', 'size', 'last modified', 'upload date',
          'number of files', 'number of documents'
        ]
      },
      {
        skillId: 'GENERAL.SUMMARIZE_DOCUMENT',
        skillName: 'Summarize Document / Section',
        pt: [
          'resumo', 'resuma', 'resumir', 'visão geral',
          'visão geral do documento', 'em poucas palavras',
          'explicar por cima', 'explicação geral', 'síntese', 'sumário'
        ],
        en: [
          'summary', 'summarize', 'summarise', 'short summary',
          'high-level overview', 'overview of the document',
          'explain briefly', 'in a nutshell', 'quick summary', 'synopsis'
        ]
      },
      {
        skillId: 'GENERAL.EXPLAIN_SECTION',
        skillName: 'Explain Section / Clause',
        pt: [
          'explique', 'explicação', 'em termos simples', 'em linguagem simples',
          'o que significa', 'significado', 'interpretar', 'interpretação',
          'detalhe', 'detalhar', 'explicar cláusula', 'explicar seção',
          'explicar parágrafo'
        ],
        en: [
          'explain', 'explanation', 'in simple terms', 'in plain language',
          'what does it mean', 'meaning', 'interpret', 'interpretation',
          'break down', 'break it down', 'explain clause', 'explain section',
          'explain paragraph'
        ]
      },
      {
        skillId: 'GENERAL.FIND_WHERE_IT_SAYS_X',
        skillName: 'Find Where It Says X',
        pt: [
          'onde diz', 'onde fala', 'em que parte', 'em qual parte',
          'onde menciona', 'localizar trecho', 'localizar citação',
          'mostrar trecho', 'trecho exato', 'texto exato', 'frase exata',
          'parágrafo exato'
        ],
        en: [
          'where does it say', 'where does it mention', 'in which part',
          'in what section', 'where is it written', 'locate passage',
          'locate quote', 'show the exact part', 'exact wording',
          'exact phrase', 'exact paragraph'
        ]
      },
      {
        skillId: 'GENERAL.CHECK_MISSING_PIECES',
        skillName: 'Check Missing Pieces',
        pt: [
          'falta', 'faltando', 'incompleto', 'incompleta', 'está completo',
          'completude', 'está faltando algo', 'o que está faltando',
          'seções ausentes', 'partes ausentes', 'seção obrigatória',
          'cláusula obrigatória'
        ],
        en: [
          'missing', 'incomplete', 'not complete', 'is it complete',
          'completeness', 'what is missing', 'missing sections',
          'missing parts', 'required section', 'required clause',
          'standard sections', 'standard clauses'
        ]
      },
      {
        skillId: 'GENERAL.OUTLINE_DOCUMENT',
        skillName: 'Outline / Structure',
        pt: [
          'outline', 'sumário', 'índice', 'estrutura do projeto',
          'etapas', 'fases', 'fase', 'cronograma', 'plano do projeto',
          'objetivos', 'escopo', 'escopo do projeto', 'entregáveis',
          'entregas', 'riscos', 'stakeholders'
        ],
        en: [
          'outline', 'table of contents', 'structure', 'project structure',
          'stages', 'phases', 'timeline', 'project plan', 'objectives',
          'goals', 'scope', 'project scope', 'deliverables', 'risks',
          'stakeholders'
        ]
      }
    ]
  },

  // ========================================================================
  // LEGAL SKILLS
  // ========================================================================
  {
    domain: 'LEGAL',
    skills: [
      {
        skillId: 'LEGAL.EXPLAIN_CLAUSE',
        skillName: 'Explain Clause (Legal)',
        pt: [
          'cláusula', 'cláusula X', 'cláusula 5.3', 'rescisão', 'renovação',
          'multa', 'penalidade', 'foro', 'jurisdição', 'vigência',
          'confidencialidade', 'não concorrência', 'não-compete',
          'responsabilidade', 'obrigações', 'direitos'
        ],
        en: [
          'clause', 'section', 'termination clause', 'renewal', 'penalty',
          'penalties', 'jurisdiction', 'governing law', 'term of the contract',
          'confidentiality', 'non-compete', 'liability', 'obligations', 'rights'
        ]
      },
      {
        skillId: 'LEGAL.SCAN_FOR_RISKS',
        skillName: 'Scan for Legal Risks',
        pt: [
          'riscos', 'risco jurídico', 'risco legal', 'riscos legais',
          'riscos contratuais', 'perigos', 'red flags', 'alertas',
          'pontos críticos', 'pontos preocupantes', 'desvantagens',
          'exposição', 'vulnerabilidade'
        ],
        en: [
          'risks', 'legal risk', 'contractual risk', 'red flags',
          'warning signs', 'concerns', 'problematic clauses', 'critical points',
          'issues', 'disadvantages', 'exposure', 'liability risk'
        ]
      },
      {
        skillId: 'LEGAL.CHECK_COMPLETENESS_LEGAL',
        skillName: 'Check Completeness (Legal)',
        pt: [
          'cláusulas padrão', 'cláusulas obrigatórias', 'completo',
          'incompleto', 'está faltando cláusula', 'falta cláusula',
          'está bem estruturado', 'estrutura do contrato', 'boas práticas',
          'modelo de contrato', 'padrão de mercado'
        ],
        en: [
          'standard clauses', 'boilerplate', 'mandatory clauses',
          'complete contract', 'incomplete contract', 'missing clause',
          'missing clauses', 'well-structured', 'contract structure',
          'best practices', 'market standard'
        ]
      },
      {
        skillId: 'LEGAL.CHECK_LGPD_COMPLIANCE',
        skillName: 'LGPD / Personal Data',
        pt: [
          'LGPD', 'dados pessoais', 'proteção de dados', 'privacidade',
          'consentimento', 'controlador', 'operador', 'encarregado', 'DPO',
          'base legal', 'tratamento de dados', 'anonimização', 'criptografia',
          'política de privacidade', 'direitos do titular',
          'revogação de consentimento'
        ],
        en: [
          'LGPD', 'GDPR', 'personal data', 'data protection', 'privacy',
          'consent', 'controller', 'processor', 'data subject', 'DPO',
          'legal basis', 'data processing', 'anonymization', 'encryption',
          'privacy policy', 'data subject rights', 'revoke consent'
        ]
      },
      {
        skillId: 'LEGAL.IDENTIFY_DEADLINES',
        skillName: 'Deadlines, Obligations, Penalties',
        pt: [
          'prazo', 'prazos', 'prazo de 30 dias', 'prazo de 60 dias',
          'vigência', 'vencimento', 'data limite', 'obrigação', 'obrigações',
          'deveres', 'responsabilidades', 'penalidade', 'penalidades',
          'multa', 'multa de rescisão', 'multa contratual', 'juros', 'mora'
        ],
        en: [
          'deadline', 'deadlines', '30 days', '60 days', 'term', 'duration',
          'expiration', 'expiry', 'due date', 'obligation', 'obligations',
          'duties', 'responsibilities', 'penalty', 'penalties',
          'termination fee', 'contractual penalty', 'interest', 'default'
        ]
      }
    ]
  },

  // ========================================================================
  // FINANCIAL SKILLS
  // ========================================================================
  {
    domain: 'FINANCIAL',
    skills: [
      {
        skillId: 'FINANCIAL.CHECK_CALCULATIONS',
        skillName: 'Check Calculations / Verify Math',
        pt: [
          'cálculo', 'cálculos', 'contas', 'somar', 'somatório', 'subtotal',
          'total', 'lucro líquido', 'lucro bruto', 'receita', 'despesa',
          'custo', 'custos', 'margem', 'conferir contas', 'conferir cálculos',
          'bater números', 'bater as contas'
        ],
        en: [
          'calculation', 'calculations', 'compute', 'sum', 'subtotal', 'total',
          'net profit', 'gross profit', 'revenue', 'expenses', 'cost', 'costs',
          'margin', 'check the math', 'verify calculations', 'numbers add up'
        ]
      },
      {
        skillId: 'FINANCIAL.SCENARIO_ANALYSIS',
        skillName: 'Scenario Analysis & ROI',
        pt: [
          'cenário conservador', 'cenário otimista', 'cenário pessimista',
          'projeção', 'projeções', 'simulação', 'cenário', 'cenários', 'ROI',
          'retorno sobre investimento', 'payback', 'TIR',
          'taxa interna de retorno', 'fluxo de caixa', 'viabilidade',
          'análise de viabilidade', 'vale a pena'
        ],
        en: [
          'conservative scenario', 'optimistic scenario', 'pessimistic scenario',
          'scenario analysis', 'projection', 'projections', 'simulation', 'ROI',
          'return on investment', 'payback', 'IRR', 'internal rate of return',
          'cash flow', 'feasibility', 'feasibility analysis', 'worth it'
        ]
      },
      {
        skillId: 'FINANCIAL.EXTRACT_FINANCIALS',
        skillName: 'Extract Financials / Track Trends',
        pt: [
          'receita', 'faturamento', 'lucro', 'lucro líquido', 'lucro bruto',
          'despesa', 'despesas', 'custos fixos', 'custos variáveis',
          'investimento', 'investimento inicial', 'CAPEX', 'OPEX',
          'receita adicional', 'área locável', 'preço por m²', 'custo por m²',
          'mensal', 'anual', 'trimestre', 'mês', 'ano'
        ],
        en: [
          'revenue', 'turnover', 'profit', 'net profit', 'gross profit',
          'expense', 'expenses', 'fixed costs', 'variable costs', 'investment',
          'initial investment', 'capex', 'opex', 'additional revenue',
          'rentable area', 'rental price per m²', 'cost per m²', 'monthly',
          'yearly', 'annual', 'quarterly'
        ]
      },
      {
        skillId: 'FINANCIAL.RECALCULATE',
        skillName: 'What-if / Recalculate',
        pt: [
          'recalcule', 'recalcular', 'e se', 'simular', 'simulação',
          'considere', 'suponha que', 'caso a receita seja', 'caso o custo seja',
          'nova taxa', 'nova taxa de desconto', 'aumentar', 'reduzir',
          'diminuir', 'alternativa'
        ],
        en: [
          'recalculate', 'recompute', 'what if', 'simulate', 'simulation',
          'assume that', 'suppose that', 'if revenue is', 'if cost is',
          'new rate', 'discount rate', 'increase', 'decrease',
          'alternative scenario'
        ]
      }
    ]
  },

  // ========================================================================
  // PROJECT MANAGEMENT SKILLS
  // ========================================================================
  {
    domain: 'PROJECT',
    skills: [
      {
        skillId: 'PROJECT.EXPLAIN_METHOD',
        skillName: 'Methods (Scrum, Kanban, Agile)',
        pt: [
          'Scrum', 'Kanban', 'ágil', 'metodologia ágil', 'gestão ágil',
          'sprint', 'backlog', 'daily', 'reunião diária', 'quadro kanban',
          'tarefas', 'trabalho em progresso', 'WIP', 'gestão de projetos',
          'PMBOK', 'PMI', 'cronograma', 'entregáveis'
        ],
        en: [
          'Scrum', 'Kanban', 'agile', 'agile methodology',
          'agile project management', 'sprint', 'backlog', 'daily standup',
          'kanban board', 'tasks', 'work in progress', 'WIP',
          'project management', 'PMBOK', 'PMI', 'schedule', 'milestones',
          'deliverables'
        ]
      }
    ]
  },

  // ========================================================================
  // COMPARISON / NAVIGATION SKILLS
  // ========================================================================
  {
    domain: 'COMPARISON',
    skills: [
      {
        skillId: 'COMPARISON.COMPARE_DOCUMENTS',
        skillName: 'Compare Documents / Versions',
        pt: [
          'comparar', 'compare', 'diferença', 'diferenças', 'o que muda',
          'mudou o quê', 'versão 1', 'versão 2', 'versão antiga',
          'versão nova', 'comparação', 'lado a lado', 'versus', 'vs'
        ],
        en: [
          'compare', 'comparison', 'differences', 'difference', 'what changed',
          "what's different", 'version 1', 'version 2', 'old version',
          'new version', 'side by side', 'versus', 'vs'
        ]
      },
      {
        skillId: 'COMPARISON.FIND_DEFINITION',
        skillName: 'Find Definition / Examples',
        pt: [
          'definição', 'defina', 'o que é', 'conceito', 'conceito de',
          'explique o conceito', 'exemplos', 'exemplo de', 'casos',
          'casos práticos', 'ilustração', 'ilustra'
        ],
        en: [
          'definition', 'define', 'what is', 'concept', 'concept of',
          'explain the concept', 'examples', 'example of', 'case', 'cases',
          'practical cases', 'illustration'
        ]
      },
      {
        skillId: 'COMPARISON.EXTRACT_ENTITIES',
        skillName: 'Extract Entities',
        pt: [
          'quem são', 'quais pessoas', 'quais empresas', 'partes envolvidas',
          'cliente', 'fornecedor', 'contratante', 'contratado', 'datas',
          'data de início', 'data de término', 'endereço', 'endereços',
          'CPF', 'CNPJ'
        ],
        en: [
          'who are', 'which people', 'which companies', 'parties',
          'parties involved', 'client', 'customer', 'supplier', 'contractor',
          'counterparty', 'dates', 'start date', 'end date', 'addresses',
          'ID', 'identification', 'tax ID'
        ]
      }
    ]
  },

  // ========================================================================
  // META / SYSTEM QUERIES
  // ========================================================================
  {
    domain: 'META',
    skills: [
      {
        skillId: 'META.ABOUT_ASSISTANT',
        skillName: 'About Koda',
        pt: [
          'quem é você', 'o que você pode fazer', 'como você funciona',
          'como usar', 'o que você faz com meus documentos', 'sem documentos',
          'me ajuda', 'assistente', 'Koda'
        ],
        en: [
          'who are you', 'what can you do', 'how do you work', 'how to use',
          'what do you do with my documents', 'without documents',
          'can you help', 'assistant', 'Koda'
        ]
      }
    ]
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all keywords for a specific skill
 */
export function getSkillKeywords(skillId: string): { pt: string[]; en: string[] } | null {
  for (const domain of BM25_KEYWORD_REGISTRY) {
    const skill = domain.skills.find(s => s.skillId === skillId);
    if (skill) {
      return { pt: skill.pt, en: skill.en };
    }
  }
  return null;
}

/**
 * Get keywords for a domain
 */
export function getDomainKeywords(domainName: string): SkillKeywords[] {
  const domain = BM25_KEYWORD_REGISTRY.find(d => d.domain === domainName);
  return domain ? domain.skills : [];
}

/**
 * Calculate keyword match score for a query
 */
export function calculateKeywordScore(
  query: string,
  keywords: { pt: string[]; en: string[] }
): { score: number; matchedKeywords: string[] } {
  const queryLower = query.toLowerCase();

  const allKeywords = [...keywords.pt, ...keywords.en];
  const matchedKeywords: string[] = [];

  for (const keyword of allKeywords) {
    const keywordLower = keyword.toLowerCase();

    // Check if keyword appears in query
    if (queryLower.includes(keywordLower)) {
      matchedKeywords.push(keyword);
    }
  }

  // Score is number of matched keywords
  return {
    score: matchedKeywords.length,
    matchedKeywords
  };
}

/**
 * Find top N skills by keyword match
 */
export function findTopSkillsByKeywords(
  query: string,
  topN: number = 3
): Array<{ skillId: string; score: number; matchedKeywords: string[] }> {
  const results: Array<{ skillId: string; score: number; matchedKeywords: string[] }> = [];

  for (const domain of BM25_KEYWORD_REGISTRY) {
    for (const skill of domain.skills) {
      const { score, matchedKeywords } = calculateKeywordScore(query, {
        pt: skill.pt,
        en: skill.en
      });

      if (score > 0) {
        results.push({
          skillId: skill.skillId,
          score,
          matchedKeywords
        });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top N
  return results.slice(0, topN);
}

/**
 * Get BM25 boost keywords for a query based on detected skill
 */
export function getBM25BoostKeywords(query: string): string[] {
  const topSkills = findTopSkillsByKeywords(query, 1);

  if (topSkills.length === 0) {
    return [];
  }

  const topSkill = topSkills[0];
  const skillKeywords = getSkillKeywords(topSkill.skillId);

  if (!skillKeywords) {
    return [];
  }

  // Detect language from query (simple heuristic)
  const isPortuguese = /[àáâãéêíóôõúç]|^(o que|qual|quais|como|onde|quando|porque|quem)\b/i.test(query);

  // Return keywords from detected language, plus some from the other
  const primaryKeywords = isPortuguese ? skillKeywords.pt : skillKeywords.en;
  const secondaryKeywords = isPortuguese ? skillKeywords.en : skillKeywords.pt;

  // Return primary keywords + top 3 from secondary
  return [...primaryKeywords.slice(0, 5), ...secondaryKeywords.slice(0, 3)];
}

/**
 * Get all skill IDs from registry
 */
export function getAllSkillIds(): string[] {
  const skillIds: string[] = [];
  for (const domain of BM25_KEYWORD_REGISTRY) {
    for (const skill of domain.skills) {
      skillIds.push(skill.skillId);
    }
  }
  return skillIds;
}

/**
 * Get skill by ID
 */
export function getSkillById(skillId: string): SkillKeywords | null {
  for (const domain of BM25_KEYWORD_REGISTRY) {
    const skill = domain.skills.find(s => s.skillId === skillId);
    if (skill) {
      return skill;
    }
  }
  return null;
}
