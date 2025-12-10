/**
 * Domain Detector Service
 *
 * Automatically detects the domain of a query and documents to inject
 * the appropriate skill pack into the RAG prompt.
 *
 * Domains: finance, accounting, legal, medical, education, research, general
 */

export type Domain =
  | 'finance'
  | 'accounting'
  | 'legal'
  | 'medical'
  | 'education'
  | 'research'
  | 'general';

export interface DomainDetectionResult {
  domain: Domain;
  confidence: number; // 0-1
  signals: string[]; // What triggered this detection
  secondaryDomain?: Domain; // If applicable
}

interface DomainKeywords {
  domain: Domain;
  keywords: string[];
  weight: number;
}

/**
 * Domain keyword patterns with weights
 */
const DOMAIN_PATTERNS: DomainKeywords[] = [
  // FINANCE
  {
    domain: 'finance',
    keywords: [
      'roi', 'retorno sobre investimento', 'return on investment',
      'payback', 'vpl', 'npv', 'valor presente líquido', 'net present value',
      'tir', 'irr', 'taxa interna de retorno', 'internal rate of return',
      'capex', 'opex', 'ebitda', 'lucro', 'profit', 'receita', 'revenue',
      'investimento', 'investment', 'viabilidade financeira', 'financial feasibility',
      'fluxo de caixa', 'cash flow', 'dre', 'dfc',
      'margem bruta', 'gross margin', 'margem líquida', 'net margin',
      'custo', 'cost', 'despesa', 'expense', 'faturamento',
      'rentabilidade', 'profitability', 'lucratividade',
      'análise financeira', 'financial analysis', 'projeção financeira',
      'cenário conservador', 'cenário otimista', 'cenário base',
      'conservative scenario', 'optimistic scenario', 'base scenario',
      'break-even', 'ponto de equilíbrio', 'valuation', 'múltiplos',
      'dcf', 'desconto', 'discount', 'taxa de desconto', 'discount rate',
      'reais', 'milhões', 'bilhões', 'capital', 'ativo', 'passivo'
    ],
    weight: 1.0
  },

  // ACCOUNTING
  {
    domain: 'accounting',
    keywords: [
      'balanço patrimonial', 'balance sheet', 'demonstração', 'statement',
      'contábil', 'accounting', 'contabilidade',
      'ativo circulante', 'current assets', 'passivo circulante', 'current liabilities',
      'patrimônio líquido', 'shareholders equity', 'equity',
      'depreciação', 'depreciation', 'amortização', 'amortization',
      'lançamento contábil', 'journal entry', 'débito', 'debit', 'crédito', 'credit',
      'plano de contas', 'chart of accounts', 'razão', 'ledger', 'balancete', 'trial balance',
      'auditoria', 'audit', 'inventário', 'inventory', 'estoque', 'stock',
      'contas a pagar', 'accounts payable', 'contas a receber', 'accounts receivable',
      'regime de competência', 'accrual basis', 'regime de caixa', 'cash basis',
      'provisão', 'provision', 'liquidez', 'liquidity', 'solvência', 'solvency',
      'endividamento', 'leverage', 'capital de giro', 'working capital',
      'análise vertical', 'vertical analysis', 'análise horizontal', 'horizontal analysis',
      'índice', 'ratio', 'indicador', 'indicator'
    ],
    weight: 1.0
  },

  // LEGAL
  {
    domain: 'legal',
    keywords: [
      'contrato', 'contract', 'cláusula', 'clause', 'acordo', 'agreement',
      'termo', 'term', 'condições', 'conditions', 'obrigação', 'obligation',
      'direito', 'right', 'dever', 'duty', 'penalidade', 'penalty', 'multa', 'fine',
      'rescisão', 'termination', 'vigência', 'validity', 'prazo', 'deadline',
      'vencimento', 'due date', 'pagamento', 'payment',
      'confidencialidade', 'confidentiality', 'nda', 'sigilo', 'secrecy',
      'lgpd', 'gdpr', 'proteção de dados', 'data protection',
      'consentimento', 'consent', 'titular', 'data subject',
      'controlador', 'controller', 'operador', 'processor', 'dpo',
      'tratamento de dados', 'data processing', 'dados pessoais', 'personal data',
      'dados sensíveis', 'sensitive data', 'lei', 'law', 'artigo', 'article',
      'inciso', 'item', 'parágrafo', 'paragraph', 'jurídico', 'legal',
      'contratante', 'contracting party', 'contratado', 'contractor',
      'partes', 'parties', 'foro', 'forum', 'jurisdição', 'jurisdiction',
      'procuração', 'power of attorney', 'estatuto', 'bylaws',
      'notificação', 'notice', 'intimação', 'summons'
    ],
    weight: 1.0
  },

  // MEDICAL
  {
    domain: 'medical',
    keywords: [
      'exame', 'exam', 'test', 'laudo', 'report', 'diagnóstico', 'diagnosis',
      'médico', 'medical', 'doctor', 'clínico', 'clinical', 'paciente', 'patient',
      'hemograma', 'cbc', 'complete blood count', 'glicose', 'glucose', 'blood sugar',
      'colesterol', 'cholesterol', 'creatinina', 'creatinine', 'hemoglobina', 'hemoglobin',
      'leucócitos', 'leukocytes', 'white blood cells', 'plaquetas', 'platelets',
      'tsh', 't4', 'hormônio', 'hormone',
      'raio-x', 'x-ray', 'tomografia', 'ct scan', 'ressonância', 'mri',
      'ultrassom', 'ultrasound', 'imagem', 'imaging',
      'achados', 'findings', 'impressão', 'impression', 'conclusão', 'conclusion',
      'normal', 'alterado', 'abnormal', 'referência', 'reference',
      'valor de referência', 'reference value', 'elevado', 'elevated', 'reduzido', 'reduced',
      'mg/dl', 'g/dl', 'mm³', 'ui/l', 'ng/ml',
      'sintoma', 'symptom', 'tratamento', 'treatment', 'medicamento', 'medication',
      'dosagem', 'dosage', 'prescrição', 'prescription',
      'consulta', 'consultation', 'prontuário', 'medical record',
      'atestado', 'certificate', 'procedimento', 'procedure'
    ],
    weight: 1.0
  },

  // EDUCATION
  {
    domain: 'education',
    keywords: [
      'redação', 'essay', 'dissertação', 'dissertation', 'trabalho acadêmico', 'academic work',
      'tcc', 'monografia', 'thesis', 'introdução', 'introduction',
      'desenvolvimento', 'development', 'conclusão', 'conclusion',
      'argumento', 'argument', 'tese', 'thesis statement',
      'parágrafo', 'paragraph', 'texto', 'text', 'escrita', 'writing',
      'coesão', 'cohesion', 'coerência', 'coherence',
      'resumo', 'summary', 'resenha', 'review', 'análise textual', 'textual analysis',
      'interpretação', 'interpretation', 'plano de aula', 'lesson plan',
      'objetivo de aprendizagem', 'learning objective', 'pedagógico', 'pedagogical',
      'estudante', 'student', 'aluno', 'professor', 'teacher',
      'ensino', 'teaching', 'aprendizagem', 'learning',
      'avaliação', 'assessment', 'prova', 'test', 'exercício', 'exercise',
      'atividade', 'activity', 'tarefa', 'task',
      'didático', 'didactic', 'educacional', 'educational',
      'escolar', 'school', 'acadêmico', 'academic'
    ],
    weight: 1.0
  },

  // RESEARCH
  {
    domain: 'research',
    keywords: [
      'artigo científico', 'scientific article', 'paper', 'pesquisa', 'research',
      'estudo', 'study', 'investigação', 'investigation',
      'hipótese', 'hypothesis', 'metodologia', 'methodology', 'método', 'method',
      'resultados', 'results', 'discussão', 'discussion',
      'abstract', 'resumo científico', 'scientific abstract',
      'amostra', 'sample', 'participantes', 'participants',
      'variável', 'variable', 'experimental', 'controle', 'control',
      'estatística', 'statistics', 'significância', 'significance',
      'valor-p', 'p-value', 'correlação', 'correlation',
      'média', 'mean', 'desvio padrão', 'standard deviation',
      'variância', 'variance', 'intervalo de confiança', 'confidence interval',
      'randomizado', 'randomized', 'cego', 'blind', 'placebo',
      'protocolo', 'protocol', 'ética', 'ethics',
      'revisão de literatura', 'literature review', 'estado da arte', 'state of the art',
      'meta-análise', 'meta-analysis', 'limitações', 'limitations',
      'viés', 'bias', 'replicabilidade', 'replicability', 'validade', 'validity',
      'doutorado', 'phd', 'mestrado', 'masters'
    ],
    weight: 1.0
  }
];

/**
 * Entity patterns that strongly indicate domain
 */
const ENTITY_PATTERNS: Record<Domain, RegExp[]> = {
  finance: [
    /R\$\s*[\d.,]+/gi, // Currency BRL
    /\$\s*[\d.,]+/gi, // Currency USD
    /\d+%\s*(roi|tir|irr|margem|margin)/gi, // Percentages with financial terms
    /payback\s*(de|of)?\s*\d+/gi, // Payback periods
  ],
  accounting: [
    /balanço\s*patrimonial/gi,
    /balance\s*sheet/gi,
    /dre|demonstração\s*(do\s*)?resultado/gi,
    /income\s*statement/gi,
    /ativo\s*(circulante|não\s*circulante)/gi,
    /current\s*assets/gi,
  ],
  legal: [
    /cláusula\s*\d+/gi, // Clause numbers
    /clause\s*\d+/gi,
    /artigo\s*\d+/gi, // Article numbers
    /article\s*\d+/gi,
    /lgpd|gdpr|lei\s*geral\s*de\s*proteção\s*de\s*dados/gi,
  ],
  medical: [
    /\d+\s*(mg\/dl|g\/dl|mm³|ui\/l|ng\/ml)/gi, // Lab values with units
    /valor\s*de\s*referência/gi,
    /reference\s*value/gi,
    /hemograma|glicose|colesterol|glucose|cholesterol/gi,
  ],
  education: [
    /introdução.*desenvolvimento.*conclusão/gi,
    /introduction.*development.*conclusion/gi,
    /tcc|monografia|thesis/gi,
  ],
  research: [
    /p\s*[<>=]\s*0\.\d+/gi, // p-values
    /n\s*=\s*\d+/gi, // Sample size notation
    /método.*resultado.*discussão/gi,
    /method.*result.*discussion/gi,
  ],
  general: []
};

/**
 * Document type patterns
 */
const DOCUMENT_TYPE_PATTERNS: Record<Domain, string[]> = {
  finance: ['viabilidade', 'feasibility', 'investimento', 'investment', 'projeto financeiro', 'financial project', 'análise financeira', 'financial analysis'],
  accounting: ['balanço', 'balance', 'demonstração', 'statement', 'balancete', 'trial balance', 'auditoria', 'audit'],
  legal: ['contrato', 'contract', 'acordo', 'agreement', 'termo', 'term', 'política de privacidade', 'privacy policy'],
  medical: ['laudo', 'report', 'exame', 'exam', 'relatório médico', 'medical report', 'prescrição', 'prescription'],
  education: ['redação', 'essay', 'trabalho', 'assignment', 'plano de aula', 'lesson plan', 'atividade', 'activity'],
  research: ['artigo', 'article', 'paper', 'tese', 'thesis', 'dissertação', 'dissertation', 'estudo', 'study'],
  general: []
};

/**
 * Detect domain from query text
 */
export function detectDomainFromQuery(query: string): DomainDetectionResult {
  const queryLower = query.toLowerCase();
  const scores: Record<Domain, number> = {
    finance: 0,
    accounting: 0,
    legal: 0,
    medical: 0,
    education: 0,
    research: 0,
    general: 0
  };

  const signals: string[] = [];

  // Check keyword patterns
  for (const pattern of DOMAIN_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        scores[pattern.domain] += pattern.weight;
        signals.push(`keyword: ${keyword}`);
      }
    }
  }

  // Check entity patterns
  for (const [domain, patterns] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        scores[domain as Domain] += 2.0; // Entities are strong signals
        signals.push(`entity: ${domain}`);
      }
    }
  }

  // Find highest score
  let maxScore = 0;
  let detectedDomain: Domain = 'general';
  let secondaryDomain: Domain | undefined;
  let secondaryScore = 0;

  for (const [domain, score] of Object.entries(scores)) {
    if (score > maxScore) {
      secondaryScore = maxScore;
      secondaryDomain = detectedDomain !== 'general' ? detectedDomain : undefined;
      maxScore = score;
      detectedDomain = domain as Domain;
    } else if (score > secondaryScore && score > 0) {
      secondaryScore = score;
      secondaryDomain = domain as Domain;
    }
  }

  // Calculate confidence (0-1)
  const confidence = Math.min(maxScore / 10, 1.0);

  // If confidence is too low, default to general
  if (confidence < 0.2) {
    return {
      domain: 'general',
      confidence: 1.0,
      signals: ['low confidence in specific domain']
    };
  }

  return {
    domain: detectedDomain,
    confidence,
    signals: signals.slice(0, 5), // Top 5 signals
    secondaryDomain: secondaryScore > 2 ? secondaryDomain : undefined
  };
}

/**
 * Detect domain from document metadata
 */
export function detectDomainFromDocument(
  documentName: string,
  documentType?: string,
  chunkClassifications?: string[]
): DomainDetectionResult {
  const textToAnalyze = `${documentName} ${documentType || ''} ${chunkClassifications?.join(' ') || ''}`;
  const lowerText = textToAnalyze.toLowerCase();

  const scores: Record<Domain, number> = {
    finance: 0,
    accounting: 0,
    legal: 0,
    medical: 0,
    education: 0,
    research: 0,
    general: 0
  };

  const signals: string[] = [];

  // Check document type patterns
  for (const [domain, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        scores[domain as Domain] += 3.0; // Document type is strong signal
        signals.push(`doc_type: ${pattern}`);
      }
    }
  }

  // Check keyword patterns
  for (const pattern of DOMAIN_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[pattern.domain] += pattern.weight * 0.5; // Lower weight for doc metadata
        signals.push(`keyword: ${keyword}`);
      }
    }
  }

  // Find highest score
  let maxScore = 0;
  let detectedDomain: Domain = 'general';

  for (const [domain, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedDomain = domain as Domain;
    }
  }

  const confidence = Math.min(maxScore / 8, 1.0);

  if (confidence < 0.3) {
    return {
      domain: 'general',
      confidence: 1.0,
      signals: ['insufficient domain signals in document']
    };
  }

  return {
    domain: detectedDomain,
    confidence,
    signals: signals.slice(0, 5)
  };
}

/**
 * Combine query and document domain detection
 */
export function detectDomainCombined(
  query: string,
  documentNames: string[],
  documentTypes?: string[],
  chunkClassifications?: string[][]
): DomainDetectionResult {
  const queryDetection = detectDomainFromQuery(query);

  // If no documents, return query detection
  if (documentNames.length === 0) {
    return queryDetection;
  }

  // Detect from each document
  const documentDetections = documentNames.map((name, idx) =>
    detectDomainFromDocument(
      name,
      documentTypes?.[idx],
      chunkClassifications?.[idx]
    )
  );

  // Aggregate scores
  const combinedScores: Record<Domain, number> = {
    finance: 0,
    accounting: 0,
    legal: 0,
    medical: 0,
    education: 0,
    research: 0,
    general: 0
  };

  // Query has 60% weight
  combinedScores[queryDetection.domain] += queryDetection.confidence * 0.6;

  // Documents have 40% weight (distributed)
  const docWeight = 0.4 / documentDetections.length;
  for (const detection of documentDetections) {
    combinedScores[detection.domain] += detection.confidence * docWeight;
  }

  // Find highest score
  let maxScore = 0;
  let detectedDomain: Domain = 'general';

  for (const [domain, score] of Object.entries(combinedScores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedDomain = domain as Domain;
    }
  }

  const allSignals = [
    ...queryDetection.signals.map(s => `query: ${s}`),
    ...documentDetections.flatMap((d, idx) =>
      d.signals.map(s => `doc${idx}: ${s}`)
    )
  ];

  return {
    domain: detectedDomain,
    confidence: maxScore,
    signals: allSignals.slice(0, 10),
    secondaryDomain: queryDetection.secondaryDomain
  };
}

/**
 * Get domain display name
 */
export function getDomainDisplayName(domain: Domain): string {
  const names: Record<Domain, string> = {
    finance: 'Finance',
    accounting: 'Accounting',
    legal: 'Legal',
    medical: 'Medical',
    education: 'Education',
    research: 'Research',
    general: 'General'
  };
  return names[domain];
}

/**
 * Get domain disclaimer text
 */
export function getDomainDisclaimer(domain: Domain): string | null {
  const disclaimers: Partial<Record<Domain, string>> = {
    legal: '**Important:** This analysis is based exclusively on the document provided. For specific legal guidance, consult a lawyer.',
    medical: '**Important:** This is only an explanation of the document content. For clinical interpretation and treatment guidance, consult your doctor.'
  };
  return disclaimers[domain] || null;
}

export default {
  detectDomainFromQuery,
  detectDomainFromDocument,
  detectDomainCombined,
  getDomainDisplayName,
  getDomainDisclaimer
};
