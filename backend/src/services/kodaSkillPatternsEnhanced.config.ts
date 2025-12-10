/**
 * ============================================================================
 * KODA SKILL PATTERNS - ENHANCED WITH MULTILINGUAL SUPPORT
 * ============================================================================
 *
 * Enhanced pattern definitions for all Koda skills with:
 * - Portuguese and English patterns
 * - Document reference patterns (pronouns, explicit names)
 * - Example queries for testing
 *
 * This extends the existing kodaSkillTaxonomyExtended.ts with more patterns
 * from the comprehensive skill mapping document.
 *
 * ============================================================================
 */

// ============================================================================
// DOCUMENT REFERENCE PATTERNS (Global)
// ============================================================================

export const DOCUMENT_REFERENCE_PATTERNS = {
  // Explicit document name references
  explicitName: {
    pt: [
      /\bno\s+documento\s+([^\s,]+)/i,
      /\bno\s+arquivo\s+([^\s,]+)/i,
      /\bem\s+([^\s,]+\.(?:pdf|docx|pptx|xlsx))/i,
    ],
    en: [
      /\bin\s+the\s+document\s+([^\s,]+)/i,
      /\bin\s+the\s+file\s+([^\s,]+)/i,
      /\bin\s+([^\s,]+\.(?:pdf|docx|pptx|xlsx))/i,
    ]
  },

  // Pronouns (require conversation context)
  pronouns: {
    pt: [
      /\bneste\s+contrato\b/i,
      /\bnesse\s+documento\b/i,
      /\bneste\s+arquivo\b/i,
      /\baqui\b/i,
      /\bele\b/i,
      /\bess[ea]\b/i,
      /\biss[oa]\b/i,
    ],
    en: [
      /\bin\s+this\s+contract\b/i,
      /\bin\s+this\s+document\b/i,
      /\bin\s+this\s+file\b/i,
      /\bhere\b/i,
      /\bit\b/i,
      /\bthis\b/i,
      /\bthat\b/i,
    ]
  }
};

// ============================================================================
// ENHANCED SKILL PATTERNS
// ============================================================================

export interface EnhancedSkillPattern {
  skillId: string;
  skillName: string;
  patterns: {
    pt: RegExp[];
    en: RegExp[];
  };
  examples: {
    pt: string[];
    en: string[];
  };
}

export const ENHANCED_SKILL_PATTERNS: EnhancedSkillPattern[] = [
  // ========================================================================
  // GENERAL SKILLS
  // ========================================================================

  {
    skillId: 'GENERAL.LIST_DOCUMENTS',
    skillName: 'List Documents / Meta Info',
    patterns: {
      pt: [
        /\bquantos\s+documentos\b/i,
        /\bliste?\s+(todos\s+)?(?:os\s+)?(?:meus\s+)?documentos\b/i,
        /\bmostr(?:ar|e)\s+(?:todos\s+)?(?:os\s+)?documentos\b/i,
        /\bque\s+tipos\s+de\s+arquivos\b/i,
        /\bquais\s+documentos\s+falam\s+sobre\b/i,
      ],
      en: [
        /\bhow\s+many\s+documents\b/i,
        /\blist\s+(?:all\s+)?(?:my\s+)?documents\b/i,
        /\bshow\s+(?:all\s+)?(?:my\s+)?documents\b/i,
        /\bwhat\s+kinds?\s+of\s+files\b/i,
        /\bwhich\s+documents\s+talk\s+about\b/i,
      ]
    },
    examples: {
      pt: [
        'Quantos documentos eu tenho?',
        'Liste todos os meus documentos',
        'Que tipos de arquivos eu tenho?',
        'Quais documentos falam sobre LGPD?'
      ],
      en: [
        'How many documents do I have?',
        'List all my documents',
        'What kinds of files do I have?',
        'Which documents talk about GDPR?'
      ]
    }
  },

  {
    skillId: 'GENERAL.SUMMARIZE_DOCUMENT',
    skillName: 'Summarize Document / Section',
    patterns: {
      pt: [
        /\bresum(?:a|o|ir|e)\s+(?:o\s+)?documento\b/i,
        /\bresum(?:a|o|ir|e)\s+(?:o\s+)?contrato\b/i,
        /\bresum(?:a|o|ir|e)\s+(?:a\s+)?se[çc][ãa]o\b/i,
        /\bfaça\s+um\s+resumo\b/i,
        /\bvisão\s+geral\s+(?:do|sobre)\b/i,
        /\bresumo\s+geral\b/i,
      ],
      en: [
        /\bsummari[sz]e\s+(?:the\s+)?document\b/i,
        /\bsummari[sz]e\s+(?:the\s+)?contract\b/i,
        /\bsummari[sz]e\s+(?:the\s+)?section\b/i,
        /\bgive\s+me\s+a\s+summary\b/i,
        /\bhigh-level\s+overview\b/i,
        /\bgeneral\s+summary\b/i,
      ]
    },
    examples: {
      pt: [
        'Resuma o documento analise_mezanino.pdf',
        'Faça um resumo do contrato',
        'Resuma a seção 3',
        'Resumo geral sobre o projeto'
      ],
      en: [
        'Summarize the document analysis.pdf',
        'Give me a summary of this contract',
        'Summarize section 3',
        'High-level summary of the project'
      ]
    }
  },

  {
    skillId: 'GENERAL.EXPLAIN_SECTION',
    skillName: 'Explain Section / Clause',
    patterns: {
      pt: [
        /\bexpliqu?e?\s+(?:a\s+)?(?:cláusula|se[çc][ãa]o|parágrafo|parte|trecho)\b/i,
        /\bexpliqu?e?\s+em\s+termos\s+simples\b/i,
        /\bo\s+que\s+(?:significa|quer\s+dizer)\b/i,
        /\bexplica[çc][ãa]o\s+(?:da|de|sobre)\b/i,
        /\bme\s+explica\b/i,
      ],
      en: [
        /\bexplain\s+(?:the\s+)?(?:clause|section|paragraph|part)\b/i,
        /\bexplain\s+in\s+simple\s+terms\b/i,
        /\bwhat\s+does\s+.+\s+mean\b/i,
        /\bexplanation\s+of\b/i,
        /\bbreak\s+down\b/i,
      ]
    },
    examples: {
      pt: [
        'Explique em termos simples a cláusula 5.3',
        'Explique a seção 2',
        'O que isso quer dizer: "prazo de 30 dias"?',
        'Me explica esse trecho'
      ],
      en: [
        'Explain clause 5.3 in simple terms',
        'Explain section 2',
        'What does this mean: "30 days notice"?',
        'Break down this part for me'
      ]
    }
  },

  {
    skillId: 'GENERAL.FIND_WHERE_IT_SAYS_X',
    skillName: 'Find Where It Says X',
    patterns: {
      pt: [
        /\bonde\s+(?:o\s+documento\s+)?(?:diz|fala|menciona)\b/i,
        /\bem\s+que\s+parte\s+(?:diz|fala|menciona)\b/i,
        /\bmostre\s+o\s+trecho\s+(?:exato\s+)?onde\b/i,
        /\blocalizar?\s+(?:trecho|cita[çc][ãa]o)\b/i,
      ],
      en: [
        /\bwhere\s+does\s+(?:it|the\s+document)\s+(?:say|mention|talk\s+about)\b/i,
        /\bin\s+which\s+(?:part|section)\s+(?:does\s+it|is\s+it)\b/i,
        /\bshow\s+(?:me\s+)?(?:the\s+)?exact\s+(?:part|wording)\b/i,
        /\blocate\s+(?:passage|quote)\b/i,
      ]
    },
    examples: {
      pt: [
        'Onde o documento menciona prazo de 30 dias?',
        'Onde fala sobre multa?',
        'Em que parte fala de LGPD?',
        'Mostre o trecho exato onde diz isso'
      ],
      en: [
        'Where does the document mention 30 days?',
        'Where does it talk about penalties?',
        'In which section does it mention GDPR?',
        'Show me the exact part where it says this'
      ]
    }
  },

  {
    skillId: 'GENERAL.CHECK_MISSING_PIECES',
    skillName: 'Check Missing Pieces',
    patterns: {
      pt: [
        /\bo\s+que\s+(?:está\s+)?falta(?:ndo)?\b/i,
        /\best[áa]\s+(?:faltando|incompleto)\b/i,
        /\best[áa]\s+completo\b/i,
        /\bfalta\s+alguma?\s+(?:informa[çc][ãa]o|se[çc][ãa]o|cláusula)\b/i,
        /\bquais\s+se[çc][õo]es\s+deveriam\s+existir\b/i,
      ],
      en: [
        /\bwhat\s+is\s+missing\b/i,
        /\bis\s+(?:this|it)\s+(?:complete|incomplete)\b/i,
        /\bis\s+(?:there\s+)?any(?:thing)?\s+missing\b/i,
        /\bwhich\s+sections\s+should\s+be\s+(?:here|present)\b/i,
      ]
    },
    examples: {
      pt: [
        'O que está faltando neste documento?',
        'Esse contrato está completo?',
        'Está faltando alguma informação importante?',
        'Quais seções deveriam existir e não existem?'
      ],
      en: [
        'What is missing in this document?',
        'Is this contract complete?',
        'Is there any important information missing?',
        'Which sections should be here but are not?'
      ]
    }
  },

  {
    skillId: 'GENERAL.OUTLINE_DOCUMENT',
    skillName: 'Outline / Structure',
    patterns: {
      pt: [
        /\bfa[çc]a\s+um\s+outline\b/i,
        /\bliste\s+os\s+pontos\s+principais\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?as\s+etapas\b/i,
        /\bestrutura\s+do\s+(?:projeto|documento)\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?os\s+entregáveis\b/i,
      ],
      en: [
        /\bcreate\s+an\s+outline\b/i,
        /\blist\s+(?:the\s+)?main\s+points\b/i,
        /\bwhat\s+are\s+the\s+stages\b/i,
        /\b(?:project|document)\s+structure\b/i,
        /\bwhat\s+are\s+the\s+(?:key\s+)?deliverables\b/i,
      ]
    },
    examples: {
      pt: [
        'Faça um outline do projeto',
        'Liste os pontos principais do projeto da Guarda Bens',
        'Quais são as etapas do projeto?',
        'Quais são os entregáveis principais?'
      ],
      en: [
        'Create an outline of this project',
        'List the main points of the Guarda Bens project',
        'What are the stages of the project?',
        'What are the key deliverables?'
      ]
    }
  },

  // ========================================================================
  // LEGAL SKILLS
  // ========================================================================

  {
    skillId: 'LEGAL.EXPLAIN_CLAUSE',
    skillName: 'Explain Clause (Legal)',
    patterns: {
      pt: [
        /\bexpliqu?e?\s+a\s+cláusula\b/i,
        /\bexpliqu?e?\s+a\s+parte\s+de\s+(?:rescis[ãa]o|renova[çc][ãa]o|multa)\b/i,
        /\bo\s+que\s+diz\s+sobre\s+(?:rescis[ãa]o|renova[çc][ãa]o|multa)\b/i,
      ],
      en: [
        /\bexplain\s+(?:the\s+)?clause\b/i,
        /\bexplain\s+(?:the\s+)?(?:termination|renewal|penalty)\s+(?:clause|conditions)\b/i,
        /\bwhat\s+does\s+it\s+say\s+about\s+(?:termination|renewal|cancellation)\b/i,
      ]
    },
    examples: {
      pt: [
        'Explique a cláusula 7',
        'Explique a parte de rescisão',
        'O que diz sobre renovação automática?'
      ],
      en: [
        'Explain clause 7',
        'Explain the termination clause',
        'What does it say about automatic renewal?'
      ]
    }
  },

  {
    skillId: 'LEGAL.SCAN_FOR_RISKS',
    skillName: 'Scan for Legal Risks',
    patterns: {
      pt: [
        /\bquais\s+(?:s[ãa]o\s+)?os\s+(?:principais\s+)?riscos\s+(?:jurídicos|legais)\b/i,
        /\bveja\s+os\s+riscos\b/i,
        /\besse\s+contrato\s+tem\s+algum\s+risco\b/i,
        /\bquais\s+pontos\s+preocupantes\b/i,
        /\bred\s+flags\b/i,
      ],
      en: [
        /\bwhat\s+are\s+the\s+(?:main\s+)?(?:legal|contractual)\s+risks\b/i,
        /\bscan\s+(?:this\s+)?(?:contract|document)\s+for\s+risks\b/i,
        /\bare\s+there\s+any\s+red\s+flags\b/i,
        /\bwhat\s+clauses\s+are\s+risky\b/i,
      ]
    },
    examples: {
      pt: [
        'Quais são os principais riscos jurídicos deste contrato?',
        'Veja os riscos para mim',
        'Esse contrato tem algum risco escondido?',
        'Quais pontos preocupantes você vê aqui?'
      ],
      en: [
        'What are the main legal risks in this contract?',
        'Scan this contract for risks',
        'Are there any red flags here?',
        'What clauses are risky for me?'
      ]
    }
  },

  {
    skillId: 'LEGAL.CHECK_COMPLETENESS_LEGAL',
    skillName: 'Check Completeness (Legal)',
    patterns: {
      pt: [
        /\besse\s+contrato\s+tem\s+todas\s+as\s+cláusulas\s+padr[ãa]o\b/i,
        /\bfalta\s+alguma\s+cláusula\s+importante\b/i,
        /\best[áa]\s+bem\s+estruturado\b/i,
        /\best[áa]\s+de\s+acordo\s+com\s+(?:as\s+)?boas\s+práticas\b/i,
      ],
      en: [
        /\bdoes\s+this\s+contract\s+have\s+all\s+standard\s+clauses\b/i,
        /\bis\s+any\s+important\s+clause\s+missing\b/i,
        /\bis\s+this\s+(?:contract|document)\s+well-structured\b/i,
        /\bis\s+this\s+aligned\s+with\s+best\s+practices\b/i,
      ]
    },
    examples: {
      pt: [
        'Esse contrato tem todas as cláusulas padrão?',
        'Falta alguma cláusula importante?',
        'Esse contrato está bem estruturado?',
        'Está de acordo com as boas práticas?'
      ],
      en: [
        'Does this contract have all standard clauses?',
        'Is any important clause missing?',
        'Is this contract well-structured?',
        'Is this aligned with best practices?'
      ]
    }
  },

  {
    skillId: 'LEGAL.CHECK_LGPD_COMPLIANCE',
    skillName: 'LGPD / GDPR Compliance',
    patterns: {
      pt: [
        /\besse\s+documento\s+est[áa]\s+em\s+conformidade\s+com\s+a\s+LGPD\b/i,
        /\bquais\s+dados\s+pessoais\s+(?:s[ãa]o\s+)?mencionados\b/i,
        /\bonde\s+aparecem\s+(?:CPF|RG|endere[çc]o|e-mail)\b/i,
        /\balguma\s+coisa\s+aqui\s+pode\s+violar\s+a\s+LGPD\b/i,
      ],
      en: [
        /\bis\s+this\s+document\s+compliant\s+with\s+(?:GDPR|LGPD)\b/i,
        /\bwhat\s+personal\s+data\s+is\s+mentioned\b/i,
        /\bwhere\s+do\s+we\s+see\s+(?:names|IDs|addresses|emails)\b/i,
        /\bcould\s+anything\s+here\s+violate\s+(?:GDPR|LGPD)\b/i,
      ]
    },
    examples: {
      pt: [
        'Esse documento está em conformidade com a LGPD?',
        'Quais dados pessoais são mencionados aqui?',
        'Onde aparecem CPF, RG, endereço, e-mail?',
        'Alguma coisa aqui pode violar a LGPD?'
      ],
      en: [
        'Is this document compliant with GDPR/LGPD?',
        'What personal data is mentioned here?',
        'Where do we see names, IDs, addresses, emails?',
        'Could anything here violate GDPR/LGPD?'
      ]
    }
  },

  {
    skillId: 'LEGAL.IDENTIFY_DEADLINES',
    skillName: 'Deadlines, Obligations, Penalties',
    patterns: {
      pt: [
        /\bquais\s+(?:s[ãa]o\s+)?os\s+prazos\b/i,
        /\bo\s+que\s+eu\s+sou\s+obrigado\s+a\s+fazer\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?as\s+(?:minhas\s+)?obriga[çc][õo]es\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?as\s+penalidades\b/i,
        /\bqual\s+(?:[ée]\s+)?a\s+multa\s+de\s+rescis[ãa]o\b/i,
      ],
      en: [
        /\bwhat\s+are\s+the\s+deadlines\b/i,
        /\bwhat\s+am\s+I\s+obligated\s+to\s+do\b/i,
        /\bwhat\s+are\s+(?:my\s+)?obligations\b/i,
        /\bwhat\s+are\s+the\s+penalties\b/i,
        /\bwhat\s+is\s+the\s+termination\s+fee\b/i,
      ]
    },
    examples: {
      pt: [
        'Quais são os prazos deste contrato?',
        'O que eu sou obrigado a fazer?',
        'Quais são as minhas obrigações?',
        'Qual é a multa de rescisão?'
      ],
      en: [
        'What are the deadlines in this contract?',
        'What am I obligated to do?',
        'What are my obligations?',
        'What is the termination fee?'
      ]
    }
  },

  // ========================================================================
  // FINANCIAL SKILLS
  // ========================================================================

  {
    skillId: 'FINANCIAL.CHECK_CALCULATIONS',
    skillName: 'Check Calculations / Verify Math',
    patterns: {
      pt: [
        /\bverifique\s+(?:se\s+)?os\s+cálculos\b/i,
        /\besses\s+números\s+est[ãa]o\s+corretos\b/i,
        /\bveja\s+se\s+o\s+lucro\s+líquido\b/i,
        /\bessas\s+contas\s+batem\b/i,
        /\bconferir\s+(?:contas|cálculos)\b/i,
      ],
      en: [
        /\bcheck\s+(?:if\s+)?(?:these\s+)?calculations\b/i,
        /\bare\s+these\s+numbers\s+correct\b/i,
        /\bverify\s+(?:the\s+)?(?:monthly\s+)?(?:net\s+)?profit\b/i,
        /\bdo\s+these\s+numbers\s+match\b/i,
        /\bcheck\s+the\s+math\b/i,
      ]
    },
    examples: {
      pt: [
        'Verifique se os cálculos fazem sentido',
        'Esses números estão corretos?',
        'Veja se o lucro líquido mensal está certo',
        'Essas contas batem com os dados do documento?'
      ],
      en: [
        'Check if these calculations make sense',
        'Are these numbers correct?',
        'Verify the monthly net profit',
        'Do these numbers match the document data?'
      ]
    }
  },

  {
    skillId: 'FINANCIAL.SCENARIO_ANALYSIS',
    skillName: 'Scenario Analysis & ROI',
    patterns: {
      pt: [
        /\bcompar(?:ar|e)\s+(?:o\s+)?cenário\s+(?:conservador|otimista|pessimista)\b/i,
        /\bcalcule\s+o\s+ROI\b/i,
        /\besse\s+investimento\s+[ée]\s+viável\b/i,
        /\bqual\s+(?:o|é\s+o)\s+payback\b/i,
        /\bo\s+que\s+muda\s+se\s+a\s+receita\s+for\b/i,
      ],
      en: [
        /\bcompare\s+(?:the\s+)?(?:conservative|optimistic|pessimistic)\s+scenario\b/i,
        /\bcalculate\s+(?:the\s+)?ROI\b/i,
        /\bis\s+this\s+investment\s+viable\b/i,
        /\bwhat\s+is\s+the\s+(?:approximate\s+)?payback\b/i,
        /\bwhat\s+happens\s+if\s+revenue\s+is\b/i,
      ]
    },
    examples: {
      pt: [
        'Compare o cenário conservador e otimista',
        'Calcule o ROI e diga se vale a pena',
        'Esse investimento é viável?',
        'Qual o payback aproximado?'
      ],
      en: [
        'Compare the conservative and optimistic scenarios',
        'Calculate the ROI and tell me if it\'s worth it',
        'Is this investment viable?',
        'What is the approximate payback period?'
      ]
    }
  },

  {
    skillId: 'FINANCIAL.EXTRACT_FINANCIALS',
    skillName: 'Extract Financials / Track Trends',
    patterns: {
      pt: [
        /\bqual\s+(?:[ée]\s+)?o\s+lucro\s+líquido\b/i,
        /\bqual\s+(?:[ée]\s+)?o\s+custo\s+por\s+m[²2]\b/i,
        /\bqual\s+(?:[ée]\s+)?a\s+receita\s+adicional\b/i,
        /\bcompar(?:ar|e)\s+a\s+receita\s+de\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?as\s+tendências\s+de\s+receita\b/i,
      ],
      en: [
        /\bwhat\s+is\s+the\s+(?:monthly\s+)?net\s+profit\b/i,
        /\bwhat\s+is\s+the\s+cost\s+per\s+(?:square\s+meter|m[²2])\b/i,
        /\bwhat\s+is\s+the\s+additional\s+revenue\b/i,
        /\bcompare\s+revenue\s+for\b/i,
        /\bwhat\s+are\s+the\s+revenue\s+trends\b/i,
      ]
    },
    examples: {
      pt: [
        'Qual é o lucro líquido mensal?',
        'Qual é o custo por m²?',
        'Qual é a receita adicional com o mezanino?',
        'Compare a receita de 2023 e 2024'
      ],
      en: [
        'What is the monthly net profit?',
        'What is the cost per square meter?',
        'What is the additional revenue from the mezzanine?',
        'Compare revenue for 2023 and 2024'
      ]
    }
  },

  {
    skillId: 'FINANCIAL.RECALCULATE',
    skillName: 'What-if / Recalculate',
    patterns: {
      pt: [
        /\brecalcule\s+considerando\b/i,
        /\be\s+se\s+os\s+custos\s+forem\b/i,
        /\brefa[çc]a\s+as\s+contas\s+com\b/i,
        /\bmostre\s+como\s+fica\s+o\s+resultado\s+se\b/i,
      ],
      en: [
        /\brecalculate\s+with\b/i,
        /\bwhat\s+if\s+costs\s+are\b/i,
        /\brecompute\s+using\b/i,
        /\bshow\s+results\s+if\b/i,
      ]
    },
    examples: {
      pt: [
        'Recalcule considerando um aluguel de R$ 50/m²',
        'E se os custos forem 10% maiores?',
        'Refaça as contas com taxa de desconto de 10%',
        'Mostre como fica o resultado se a ocupação for 80%'
      ],
      en: [
        'Recalculate with rent at $50 per m²',
        'What if costs are 10% higher?',
        'Recompute using a 10% discount rate',
        'Show results if occupancy is 80%'
      ]
    }
  },

  // ========================================================================
  // PROJECT MANAGEMENT SKILLS
  // ========================================================================

  {
    skillId: 'PROJECT.EXPLAIN_METHOD',
    skillName: 'Methods (Scrum, Kanban, Agile)',
    patterns: {
      pt: [
        /\bo\s+que\s+[ée]\s+(?:Kanban|Scrum|ágil)\s+segundo\s+meus\s+documentos\b/i,
        /\bo\s+que\s+meus\s+documentos\s+falam\s+sobre\s+(?:Kanban|Scrum|ágil)\b/i,
        /\bquais\s+métodos\s+de\s+gest[ãa]o\s+(?:s[ãa]o\s+)?mencionados\b/i,
        /\bexpliqu?e?\s+como\s+o\s+projeto\s+[ée]\s+gerenciado\b/i,
      ],
      en: [
        /\bwhat\s+is\s+(?:Kanban|Scrum|Agile)\s+according\s+to\s+my\s+documents\b/i,
        /\bwhat\s+do\s+my\s+documents\s+say\s+about\s+(?:Kanban|Scrum|Agile)\b/i,
        /\bwhich\s+management\s+methods\s+are\s+mentioned\b/i,
        /\bexplain\s+how\s+(?:this\s+)?project\s+is\s+managed\b/i,
      ]
    },
    examples: {
      pt: [
        'O que é Kanban segundo meus documentos?',
        'O que meus documentos falam sobre Scrum?',
        'Quais métodos de gestão são mencionados?',
        'Explique como o projeto é gerenciado'
      ],
      en: [
        'What is Kanban according to my documents?',
        'What do my documents say about Scrum?',
        'Which management methods are mentioned?',
        'Explain how this project is managed'
      ]
    }
  },

  // ========================================================================
  // COMPARISON SKILLS
  // ========================================================================

  {
    skillId: 'COMPARISON.COMPARE_DOCUMENTS',
    skillName: 'Compare Documents / Versions',
    patterns: {
      pt: [
        /\bcompar(?:ar|e)\s+(?:o\s+)?documento\s+.+\s+com\b/i,
        /\bo\s+que\s+muda\s+entre\s+as\s+duas\s+vers[õo]es\b/i,
        /\be\s+no\s+documento\s+.+,\s+o\s+que\s+muda\b/i,
        /\bquais\s+(?:s[ãa]o\s+)?as\s+diferen[çc]as\s+principais\b/i,
      ],
      en: [
        /\bcompare\s+document\s+.+\s+(?:and|with)\b/i,
        /\bwhat\s+changes\s+between\s+version\b/i,
        /\band\s+in\s+.+,\s+what'?s\s+different\b/i,
        /\bwhat\s+are\s+the\s+main\s+differences\b/i,
      ]
    },
    examples: {
      pt: [
        'Compare o documento A com B',
        'O que muda entre as duas versões do contrato?',
        'E no documento Trabalho projeto.pdf, o que muda?',
        'Quais são as diferenças principais entre esses dois arquivos?'
      ],
      en: [
        'Compare document A and B',
        'What changes between version 1 and version 2?',
        'And in project_work.pdf, what\'s different?',
        'What are the main differences between these two files?'
      ]
    }
  },

  {
    skillId: 'COMPARISON.FIND_DEFINITION',
    skillName: 'Find Definition / Examples',
    patterns: {
      pt: [
        /\bqual\s+(?:[ée]\s+)?a\s+defini[çc][ãa]o\s+de\b/i,
        /\bo\s+que\s+[ée]\s+.+\s+segundo\s+meus\s+documentos\b/i,
        /\bmostre\s+exemplos\s+de\b/i,
        /\bonde\s+explica\b/i,
      ],
      en: [
        /\bwhat\s+is\s+the\s+definition\s+of\b/i,
        /\bwhat\s+is\s+.+\s+according\s+to\s+my\s+documents\b/i,
        /\bshow\s+examples\s+of\b/i,
        /\bwhere\s+does\s+it\s+explain\b/i,
      ]
    },
    examples: {
      pt: [
        'Qual é a definição de LGPD?',
        'O que é LGPD segundo meus documentos?',
        'Mostre exemplos de não conformidade',
        'Onde explica esse termo técnico?'
      ],
      en: [
        'What is the definition of GDPR?',
        'What is GDPR according to my documents?',
        'Show examples of non-compliance',
        'Where does it explain this technical term?'
      ]
    }
  },

  {
    skillId: 'COMPARISON.EXTRACT_ENTITIES',
    skillName: 'Extract Entities',
    patterns: {
      pt: [
        /\bquem\s+(?:s[ãa]o|[ée])\s+(?:os?\s+)?(?:clientes?|fornecedores?|partes?)\b/i,
        /\bquais\s+(?:pessoas|empresas)\s+(?:s[ãa]o\s+)?mencionad[ao]s\b/i,
        /\bquais\s+datas\s+importantes\b/i,
        /\bquais\s+endere[çc]os\s+aparecem\b/i,
      ],
      en: [
        /\bwho\s+(?:is|are)\s+(?:the\s+)?(?:clients?|suppliers?|parties?)\b/i,
        /\bwhich\s+(?:people|companies)\s+are\s+mentioned\b/i,
        /\bwhat\s+important\s+dates\b/i,
        /\bwhich\s+addresses\s+appear\b/i,
      ]
    },
    examples: {
      pt: [
        'Quem são os clientes ideais da Guarda Bens?',
        'Quais pessoas / empresas são mencionadas?',
        'Quais datas importantes aparecem nesse contrato?',
        'Quais endereços aparecem aqui?'
      ],
      en: [
        'Who is the ideal client for Guarda Bens?',
        'Which people/companies are mentioned?',
        'What important dates appear in this contract?',
        'Which addresses appear here?'
      ]
    }
  },

  // ========================================================================
  // META SKILLS
  // ========================================================================

  {
    skillId: 'META.ABOUT_ASSISTANT',
    skillName: 'About Koda',
    patterns: {
      pt: [
        /\bquem\s+(?:[ée]|és)\s+(?:você|vc)\b/i,
        /\bo\s+que\s+(?:você|vc)\s+(?:pode\s+)?faz(?:er)?\b/i,
        /\bcomo\s+(?:você|vc)\s+funciona\b/i,
        /\b(?:você|vc)\s+consegue\s+me\s+ajudar\b/i,
      ],
      en: [
        /\bwho\s+are\s+you\b/i,
        /\bwhat\s+can\s+you\s+do\b/i,
        /\bhow\s+do\s+you\s+work\b/i,
        /\bcan\s+you\s+help\s+me\b/i,
      ]
    },
    examples: {
      pt: [
        'Quem é você e o que você pode fazer?',
        'O que você consegue fazer com meus documentos?',
        'Como você funciona?',
        'Você consegue me ajudar mesmo sem documentos?'
      ],
      en: [
        'Who are you and what can you do?',
        'What can you do with my documents?',
        'How do you work?',
        'Can you help me even without documents?'
      ]
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get enhanced patterns for a specific skill
 */
export function getEnhancedPatterns(skillId: string): EnhancedSkillPattern | null {
  return ENHANCED_SKILL_PATTERNS.find(p => p.skillId === skillId) || null;
}

/**
 * Test if query matches any pattern for a skill
 */
export function testSkillPatterns(
  query: string,
  skillId: string
): { matched: boolean; language: 'pt' | 'en' | null } {
  const patterns = getEnhancedPatterns(skillId);
  if (!patterns) return { matched: false, language: null };

  // Test Portuguese patterns
  for (const pattern of patterns.patterns.pt) {
    if (pattern.test(query)) {
      return { matched: true, language: 'pt' };
    }
  }

  // Test English patterns
  for (const pattern of patterns.patterns.en) {
    if (pattern.test(query)) {
      return { matched: true, language: 'en' };
    }
  }

  return { matched: false, language: null };
}

/**
 * Test all skills and return matches
 */
export function findMatchingSkills(query: string): Array<{
  skillId: string;
  skillName: string;
  language: 'pt' | 'en';
}> {
  const matches: Array<{
    skillId: string;
    skillName: string;
    language: 'pt' | 'en';
  }> = [];

  for (const skill of ENHANCED_SKILL_PATTERNS) {
    const result = testSkillPatterns(query, skill.skillId);
    if (result.matched && result.language) {
      matches.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        language: result.language
      });
    }
  }

  return matches;
}

/**
 * Extract document reference from query
 */
export function extractDocumentReference(query: string): {
  type: 'explicit' | 'pronoun' | null;
  documentName?: string;
  language: 'pt' | 'en' | null;
} {
  // Try explicit name patterns (PT)
  for (const pattern of DOCUMENT_REFERENCE_PATTERNS.explicitName.pt) {
    const match = query.match(pattern);
    if (match) {
      return {
        type: 'explicit',
        documentName: match[1],
        language: 'pt'
      };
    }
  }

  // Try explicit name patterns (EN)
  for (const pattern of DOCUMENT_REFERENCE_PATTERNS.explicitName.en) {
    const match = query.match(pattern);
    if (match) {
      return {
        type: 'explicit',
        documentName: match[1],
        language: 'en'
      };
    }
  }

  // Try pronoun patterns (PT)
  for (const pattern of DOCUMENT_REFERENCE_PATTERNS.pronouns.pt) {
    if (pattern.test(query)) {
      return {
        type: 'pronoun',
        language: 'pt'
      };
    }
  }

  // Try pronoun patterns (EN)
  for (const pattern of DOCUMENT_REFERENCE_PATTERNS.pronouns.en) {
    if (pattern.test(query)) {
      return {
        type: 'pronoun',
        language: 'en'
      };
    }
  }

  return { type: null, language: null };
}

/**
 * Get all skill IDs from enhanced patterns
 */
export function getAllEnhancedSkillIds(): string[] {
  return ENHANCED_SKILL_PATTERNS.map(p => p.skillId);
}

/**
 * Get examples for a skill (for testing)
 */
export function getSkillExamples(skillId: string): { pt: string[]; en: string[] } | null {
  const skill = ENHANCED_SKILL_PATTERNS.find(p => p.skillId === skillId);
  return skill ? skill.examples : null;
}
