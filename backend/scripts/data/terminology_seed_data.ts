/**
 * Terminology Seed Data
 *
 * Multilingual professional terminology for semantic query expansion.
 * Supports: Financial, Legal, Medical, Accounting domains
 * Languages: English (EN), Portuguese (PT), Spanish (ES)
 */

export interface TermEntry {
  term: string;
  synonyms: string[];
  domain: string;
  language: string;
  relatedTerms?: string[];
  definition?: string;
}

export const terminologySeedData: TermEntry[] = [
  // ============================================
  // FINANCIAL TERMINOLOGY - ENGLISH
  // ============================================
  {
    term: "revenue",
    synonyms: ["income", "earnings", "sales", "turnover", "gross income", "top line"],
    domain: "financial",
    language: "en",
    relatedTerms: ["profit", "expenses", "net income"],
    definition: "Total amount of money received from sales of goods or services"
  },
  {
    term: "profit",
    synonyms: ["net income", "earnings", "gain", "surplus", "bottom line", "net profit"],
    domain: "financial",
    language: "en",
    relatedTerms: ["revenue", "expenses", "margin"],
    definition: "Financial gain after deducting all expenses from revenue"
  },
  {
    term: "expenses",
    synonyms: ["costs", "expenditures", "outlays", "spending", "disbursements", "overheads"],
    domain: "financial",
    language: "en",
    relatedTerms: ["revenue", "profit", "budget"],
    definition: "Money spent or costs incurred in operations"
  },
  {
    term: "assets",
    synonyms: ["holdings", "property", "resources", "possessions", "capital goods", "valuables"],
    domain: "financial",
    language: "en",
    relatedTerms: ["liabilities", "equity", "balance sheet"],
    definition: "Resources owned by a company with economic value"
  },
  {
    term: "liabilities",
    synonyms: ["debts", "obligations", "payables", "dues", "amounts owed", "financial obligations"],
    domain: "financial",
    language: "en",
    relatedTerms: ["assets", "equity", "balance sheet"],
    definition: "Financial obligations or debts owed to others"
  },
  {
    term: "equity",
    synonyms: ["shareholders equity", "net worth", "capital", "ownership", "stockholders equity"],
    domain: "financial",
    language: "en",
    relatedTerms: ["assets", "liabilities", "shares"],
    definition: "Ownership interest in a company after deducting liabilities"
  },
  {
    term: "dividend",
    synonyms: ["distribution", "payout", "share of profits", "shareholder payment"],
    domain: "financial",
    language: "en",
    relatedTerms: ["profit", "shares", "yield"],
    definition: "Distribution of profits to shareholders"
  },
  {
    term: "investment",
    synonyms: ["capital allocation", "funding", "stake", "venture", "placement"],
    domain: "financial",
    language: "en",
    relatedTerms: ["return", "risk", "portfolio"],
    definition: "Allocation of money with expectation of future returns"
  },
  {
    term: "cash flow",
    synonyms: ["liquidity", "money flow", "cash movement", "fund flow", "working capital flow"],
    domain: "financial",
    language: "en",
    relatedTerms: ["revenue", "expenses", "operations"],
    definition: "Movement of money into and out of a business"
  },
  {
    term: "balance sheet",
    synonyms: ["statement of financial position", "financial statement", "position statement"],
    domain: "financial",
    language: "en",
    relatedTerms: ["assets", "liabilities", "equity"],
    definition: "Financial statement showing assets, liabilities and equity at a point in time"
  },
  {
    term: "depreciation",
    synonyms: ["amortization", "write-down", "value reduction", "asset decline"],
    domain: "financial",
    language: "en",
    relatedTerms: ["assets", "expenses", "book value"],
    definition: "Reduction in value of an asset over time"
  },
  {
    term: "interest rate",
    synonyms: ["rate of interest", "borrowing rate", "lending rate", "APR", "yield rate"],
    domain: "financial",
    language: "en",
    relatedTerms: ["loan", "debt", "mortgage"],
    definition: "Percentage charged on borrowed money or earned on investments"
  },
  {
    term: "ROI",
    synonyms: ["return on investment", "investment return", "yield", "profit margin", "returns"],
    domain: "financial",
    language: "en",
    relatedTerms: ["investment", "profit", "performance"],
    definition: "Measure of profitability relative to investment cost"
  },
  {
    term: "EBITDA",
    synonyms: ["operating profit", "operating earnings", "earnings before interest taxes depreciation amortization"],
    domain: "financial",
    language: "en",
    relatedTerms: ["profit", "revenue", "operating income"],
    definition: "Earnings before interest, taxes, depreciation, and amortization"
  },
  {
    term: "gross margin",
    synonyms: ["gross profit margin", "markup", "gross percentage", "profit percentage"],
    domain: "financial",
    language: "en",
    relatedTerms: ["revenue", "cost of goods sold", "profit"],
    definition: "Percentage of revenue remaining after cost of goods sold"
  },

  // ============================================
  // FINANCIAL TERMINOLOGY - PORTUGUESE
  // ============================================
  {
    term: "receita",
    synonyms: ["faturamento", "renda", "vendas", "ganhos", "entrada"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["lucro", "despesas", "resultado"],
    definition: "Total de dinheiro recebido pela venda de bens ou serviços"
  },
  {
    term: "lucro",
    synonyms: ["ganho", "resultado positivo", "benefício", "rendimento líquido", "superávit"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["receita", "despesas", "margem"],
    definition: "Ganho financeiro após deduzir todas as despesas da receita"
  },
  {
    term: "despesas",
    synonyms: ["custos", "gastos", "desembolsos", "dispêndios", "saídas"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["receita", "lucro", "orçamento"],
    definition: "Dinheiro gasto ou custos incorridos nas operações"
  },
  {
    term: "ativos",
    synonyms: ["bens", "patrimônio", "recursos", "propriedades", "capital"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["passivos", "patrimônio líquido", "balanço"],
    definition: "Recursos de propriedade da empresa com valor econômico"
  },
  {
    term: "passivos",
    synonyms: ["dívidas", "obrigações", "débitos", "compromissos financeiros"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["ativos", "patrimônio líquido", "balanço"],
    definition: "Obrigações financeiras ou dívidas a pagar"
  },
  {
    term: "patrimônio líquido",
    synonyms: ["capital próprio", "valor líquido", "equity", "capital social"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["ativos", "passivos", "ações"],
    definition: "Participação acionária após dedução dos passivos"
  },
  {
    term: "dividendo",
    synonyms: ["distribuição de lucros", "pagamento aos acionistas", "proventos"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["lucro", "ações", "rendimento"],
    definition: "Distribuição de lucros aos acionistas"
  },
  {
    term: "investimento",
    synonyms: ["aplicação", "alocação de capital", "aporte", "participação"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["retorno", "risco", "carteira"],
    definition: "Alocação de dinheiro com expectativa de retornos futuros"
  },
  {
    term: "fluxo de caixa",
    synonyms: ["liquidez", "movimento de caixa", "cash flow", "capital de giro"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["receita", "despesas", "operações"],
    definition: "Movimento de dinheiro entrando e saindo do negócio"
  },
  {
    term: "balanço patrimonial",
    synonyms: ["demonstração financeira", "balanço", "posição financeira"],
    domain: "financial",
    language: "pt",
    relatedTerms: ["ativos", "passivos", "patrimônio líquido"],
    definition: "Demonstrativo financeiro mostrando ativos, passivos e patrimônio"
  },

  // ============================================
  // FINANCIAL TERMINOLOGY - SPANISH
  // ============================================
  {
    term: "ingresos",
    synonyms: ["facturación", "ventas", "ganancias", "entradas", "recaudación"],
    domain: "financial",
    language: "es",
    relatedTerms: ["beneficio", "gastos", "resultado"],
    definition: "Total de dinero recibido por la venta de bienes o servicios"
  },
  {
    term: "beneficio",
    synonyms: ["ganancia", "utilidad", "lucro", "rendimiento", "superávit"],
    domain: "financial",
    language: "es",
    relatedTerms: ["ingresos", "gastos", "margen"],
    definition: "Ganancia financiera después de deducir todos los gastos"
  },
  {
    term: "gastos",
    synonyms: ["costos", "egresos", "desembolsos", "expensas", "salidas"],
    domain: "financial",
    language: "es",
    relatedTerms: ["ingresos", "beneficio", "presupuesto"],
    definition: "Dinero gastado o costos incurridos en operaciones"
  },
  {
    term: "activos",
    synonyms: ["bienes", "patrimonio", "recursos", "propiedades", "capital"],
    domain: "financial",
    language: "es",
    relatedTerms: ["pasivos", "patrimonio neto", "balance"],
    definition: "Recursos de propiedad de la empresa con valor económico"
  },
  {
    term: "pasivos",
    synonyms: ["deudas", "obligaciones", "compromisos", "cuentas por pagar"],
    domain: "financial",
    language: "es",
    relatedTerms: ["activos", "patrimonio neto", "balance"],
    definition: "Obligaciones financieras o deudas por pagar"
  },
  {
    term: "patrimonio neto",
    synonyms: ["capital propio", "valor neto", "capital contable", "fondos propios"],
    domain: "financial",
    language: "es",
    relatedTerms: ["activos", "pasivos", "acciones"],
    definition: "Participación en la empresa después de deducir pasivos"
  },

  // ============================================
  // LEGAL TERMINOLOGY - ENGLISH
  // ============================================
  {
    term: "contract",
    synonyms: ["agreement", "covenant", "pact", "deed", "legal agreement", "binding agreement"],
    domain: "legal",
    language: "en",
    relatedTerms: ["party", "terms", "breach"],
    definition: "Legally binding agreement between parties"
  },
  {
    term: "liability",
    synonyms: ["legal responsibility", "obligation", "accountability", "culpability"],
    domain: "legal",
    language: "en",
    relatedTerms: ["damages", "negligence", "duty"],
    definition: "Legal responsibility for actions or debts"
  },
  {
    term: "plaintiff",
    synonyms: ["claimant", "complainant", "petitioner", "litigant", "accuser"],
    domain: "legal",
    language: "en",
    relatedTerms: ["defendant", "lawsuit", "court"],
    definition: "Person or entity bringing a legal action"
  },
  {
    term: "defendant",
    synonyms: ["respondent", "accused", "appellee"],
    domain: "legal",
    language: "en",
    relatedTerms: ["plaintiff", "lawsuit", "court"],
    definition: "Person or entity being sued or accused"
  },
  {
    term: "jurisdiction",
    synonyms: ["authority", "legal power", "competence", "domain", "venue"],
    domain: "legal",
    language: "en",
    relatedTerms: ["court", "law", "territory"],
    definition: "Official power to make legal decisions and judgments"
  },
  {
    term: "tort",
    synonyms: ["civil wrong", "wrongful act", "injury", "damage"],
    domain: "legal",
    language: "en",
    relatedTerms: ["negligence", "liability", "damages"],
    definition: "Civil wrong causing harm or loss to another"
  },
  {
    term: "breach",
    synonyms: ["violation", "infringement", "non-compliance", "default"],
    domain: "legal",
    language: "en",
    relatedTerms: ["contract", "terms", "damages"],
    definition: "Failure to fulfill a legal obligation"
  },
  {
    term: "damages",
    synonyms: ["compensation", "reparation", "indemnity", "restitution", "remedy"],
    domain: "legal",
    language: "en",
    relatedTerms: ["breach", "liability", "court"],
    definition: "Monetary compensation for loss or injury"
  },
  {
    term: "injunction",
    synonyms: ["court order", "restraining order", "prohibition", "mandate"],
    domain: "legal",
    language: "en",
    relatedTerms: ["court", "remedy", "enforcement"],
    definition: "Court order requiring or prohibiting action"
  },
  {
    term: "due diligence",
    synonyms: ["investigation", "audit", "review", "examination", "assessment"],
    domain: "legal",
    language: "en",
    relatedTerms: ["contract", "acquisition", "compliance"],
    definition: "Comprehensive appraisal before a transaction"
  },
  {
    term: "intellectual property",
    synonyms: ["IP", "patents", "trademarks", "copyrights", "proprietary rights"],
    domain: "legal",
    language: "en",
    relatedTerms: ["trademark", "patent", "copyright"],
    definition: "Legal rights to creations of the mind"
  },
  {
    term: "indemnification",
    synonyms: ["indemnity", "protection", "hold harmless", "insurance"],
    domain: "legal",
    language: "en",
    relatedTerms: ["liability", "damages", "contract"],
    definition: "Security against damage or loss"
  },

  // ============================================
  // LEGAL TERMINOLOGY - PORTUGUESE
  // ============================================
  {
    term: "contrato",
    synonyms: ["acordo", "pacto", "convenção", "ajuste", "instrumento"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["parte", "termos", "inadimplemento"],
    definition: "Acordo legalmente vinculante entre partes"
  },
  {
    term: "responsabilidade",
    synonyms: ["obrigação legal", "dever", "compromisso", "encargo"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["danos", "negligência", "culpa"],
    definition: "Responsabilidade legal por ações ou dívidas"
  },
  {
    term: "autor",
    synonyms: ["requerente", "demandante", "querelante", "reclamante"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["réu", "ação", "tribunal"],
    definition: "Pessoa ou entidade que propõe uma ação legal"
  },
  {
    term: "réu",
    synonyms: ["demandado", "reclamado", "acusado"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["autor", "ação", "tribunal"],
    definition: "Pessoa ou entidade sendo processada ou acusada"
  },
  {
    term: "jurisdição",
    synonyms: ["competência", "autoridade legal", "foro", "alçada"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["tribunal", "lei", "território"],
    definition: "Poder oficial para tomar decisões legais"
  },
  {
    term: "inadimplemento",
    synonyms: ["descumprimento", "violação", "quebra de contrato", "mora"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["contrato", "termos", "danos"],
    definition: "Falha em cumprir uma obrigação legal"
  },
  {
    term: "danos",
    synonyms: ["indenização", "compensação", "reparação", "ressarcimento"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["inadimplemento", "responsabilidade", "tribunal"],
    definition: "Compensação monetária por perda ou lesão"
  },
  {
    term: "propriedade intelectual",
    synonyms: ["PI", "patentes", "marcas", "direitos autorais"],
    domain: "legal",
    language: "pt",
    relatedTerms: ["marca", "patente", "copyright"],
    definition: "Direitos legais sobre criações da mente"
  },

  // ============================================
  // LEGAL TERMINOLOGY - SPANISH
  // ============================================
  {
    term: "contrato",
    synonyms: ["acuerdo", "pacto", "convenio", "trato"],
    domain: "legal",
    language: "es",
    relatedTerms: ["parte", "términos", "incumplimiento"],
    definition: "Acuerdo legalmente vinculante entre partes"
  },
  {
    term: "responsabilidad",
    synonyms: ["obligación legal", "deber", "compromiso"],
    domain: "legal",
    language: "es",
    relatedTerms: ["daños", "negligencia", "culpa"],
    definition: "Responsabilidad legal por acciones o deudas"
  },
  {
    term: "demandante",
    synonyms: ["actor", "querellante", "reclamante", "litigante"],
    domain: "legal",
    language: "es",
    relatedTerms: ["demandado", "juicio", "tribunal"],
    definition: "Persona o entidad que presenta una acción legal"
  },
  {
    term: "demandado",
    synonyms: ["acusado", "reo", "imputado"],
    domain: "legal",
    language: "es",
    relatedTerms: ["demandante", "juicio", "tribunal"],
    definition: "Persona o entidad siendo demandada o acusada"
  },
  {
    term: "jurisdicción",
    synonyms: ["competencia", "autoridad legal", "fuero"],
    domain: "legal",
    language: "es",
    relatedTerms: ["tribunal", "ley", "territorio"],
    definition: "Poder oficial para tomar decisiones legales"
  },
  {
    term: "incumplimiento",
    synonyms: ["violación", "quebrantamiento", "infracción", "mora"],
    domain: "legal",
    language: "es",
    relatedTerms: ["contrato", "términos", "daños"],
    definition: "Falta en cumplir una obligación legal"
  },

  // ============================================
  // MEDICAL TERMINOLOGY - ENGLISH
  // ============================================
  {
    term: "diagnosis",
    synonyms: ["medical diagnosis", "determination", "assessment", "evaluation", "finding"],
    domain: "medical",
    language: "en",
    relatedTerms: ["symptoms", "treatment", "prognosis"],
    definition: "Identification of a disease or condition"
  },
  {
    term: "treatment",
    synonyms: ["therapy", "medical care", "intervention", "management", "remedy"],
    domain: "medical",
    language: "en",
    relatedTerms: ["diagnosis", "medication", "procedure"],
    definition: "Medical care given to a patient"
  },
  {
    term: "symptoms",
    synonyms: ["signs", "manifestations", "indicators", "complaints"],
    domain: "medical",
    language: "en",
    relatedTerms: ["diagnosis", "disease", "condition"],
    definition: "Physical or mental features indicating a condition"
  },
  {
    term: "medication",
    synonyms: ["medicine", "drug", "pharmaceutical", "prescription", "remedy"],
    domain: "medical",
    language: "en",
    relatedTerms: ["treatment", "dosage", "side effects"],
    definition: "Substance used for medical treatment"
  },
  {
    term: "prognosis",
    synonyms: ["outlook", "forecast", "prediction", "expectation"],
    domain: "medical",
    language: "en",
    relatedTerms: ["diagnosis", "treatment", "recovery"],
    definition: "Predicted course and outcome of a disease"
  },
  {
    term: "chronic",
    synonyms: ["long-term", "persistent", "ongoing", "continuous"],
    domain: "medical",
    language: "en",
    relatedTerms: ["acute", "condition", "disease"],
    definition: "Condition persisting over a long period"
  },
  {
    term: "acute",
    synonyms: ["severe", "intense", "sudden", "short-term"],
    domain: "medical",
    language: "en",
    relatedTerms: ["chronic", "symptoms", "emergency"],
    definition: "Condition with rapid onset and short duration"
  },
  {
    term: "patient",
    synonyms: ["individual", "subject", "case", "client"],
    domain: "medical",
    language: "en",
    relatedTerms: ["doctor", "treatment", "care"],
    definition: "Person receiving medical treatment"
  },
  {
    term: "prescription",
    synonyms: ["Rx", "medical order", "drug order"],
    domain: "medical",
    language: "en",
    relatedTerms: ["medication", "doctor", "pharmacy"],
    definition: "Written instruction for medication"
  },
  {
    term: "surgery",
    synonyms: ["operation", "surgical procedure", "surgical intervention"],
    domain: "medical",
    language: "en",
    relatedTerms: ["treatment", "hospital", "recovery"],
    definition: "Medical procedure involving incision"
  },

  // ============================================
  // MEDICAL TERMINOLOGY - PORTUGUESE
  // ============================================
  {
    term: "diagnóstico",
    synonyms: ["avaliação médica", "determinação", "identificação"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["sintomas", "tratamento", "prognóstico"],
    definition: "Identificação de uma doença ou condição"
  },
  {
    term: "tratamento",
    synonyms: ["terapia", "cuidado médico", "intervenção", "manejo"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["diagnóstico", "medicação", "procedimento"],
    definition: "Cuidado médico dado a um paciente"
  },
  {
    term: "sintomas",
    synonyms: ["sinais", "manifestações", "indicadores", "queixas"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["diagnóstico", "doença", "condição"],
    definition: "Características físicas ou mentais indicando uma condição"
  },
  {
    term: "medicação",
    synonyms: ["remédio", "medicamento", "fármaco", "droga"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["tratamento", "dosagem", "efeitos colaterais"],
    definition: "Substância usada para tratamento médico"
  },
  {
    term: "prognóstico",
    synonyms: ["perspectiva", "previsão", "expectativa"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["diagnóstico", "tratamento", "recuperação"],
    definition: "Curso e resultado previstos de uma doença"
  },
  {
    term: "crônico",
    synonyms: ["de longo prazo", "persistente", "contínuo"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["agudo", "condição", "doença"],
    definition: "Condição que persiste por um longo período"
  },
  {
    term: "paciente",
    synonyms: ["indivíduo", "sujeito", "caso", "enfermo"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["médico", "tratamento", "cuidado"],
    definition: "Pessoa recebendo tratamento médico"
  },
  {
    term: "cirurgia",
    synonyms: ["operação", "procedimento cirúrgico", "intervenção cirúrgica"],
    domain: "medical",
    language: "pt",
    relatedTerms: ["tratamento", "hospital", "recuperação"],
    definition: "Procedimento médico envolvendo incisão"
  },

  // ============================================
  // MEDICAL TERMINOLOGY - SPANISH
  // ============================================
  {
    term: "diagnóstico",
    synonyms: ["evaluación médica", "determinación", "identificación"],
    domain: "medical",
    language: "es",
    relatedTerms: ["síntomas", "tratamiento", "pronóstico"],
    definition: "Identificación de una enfermedad o condición"
  },
  {
    term: "tratamiento",
    synonyms: ["terapia", "cuidado médico", "intervención", "manejo"],
    domain: "medical",
    language: "es",
    relatedTerms: ["diagnóstico", "medicación", "procedimiento"],
    definition: "Cuidado médico dado a un paciente"
  },
  {
    term: "síntomas",
    synonyms: ["signos", "manifestaciones", "indicadores", "quejas"],
    domain: "medical",
    language: "es",
    relatedTerms: ["diagnóstico", "enfermedad", "condición"],
    definition: "Características físicas o mentales indicando una condición"
  },
  {
    term: "medicación",
    synonyms: ["medicina", "medicamento", "fármaco", "droga"],
    domain: "medical",
    language: "es",
    relatedTerms: ["tratamiento", "dosis", "efectos secundarios"],
    definition: "Sustancia usada para tratamiento médico"
  },
  {
    term: "paciente",
    synonyms: ["individuo", "sujeto", "caso", "enfermo"],
    domain: "medical",
    language: "es",
    relatedTerms: ["médico", "tratamiento", "cuidado"],
    definition: "Persona recibiendo tratamiento médico"
  },
  {
    term: "cirugía",
    synonyms: ["operación", "procedimiento quirúrgico", "intervención quirúrgica"],
    domain: "medical",
    language: "es",
    relatedTerms: ["tratamiento", "hospital", "recuperación"],
    definition: "Procedimiento médico que implica incisión"
  },

  // ============================================
  // ACCOUNTING TERMINOLOGY - ENGLISH
  // ============================================
  {
    term: "accounts receivable",
    synonyms: ["AR", "receivables", "trade receivables", "debtors", "amounts due"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["accounts payable", "revenue", "balance sheet"],
    definition: "Money owed to a company by its customers"
  },
  {
    term: "accounts payable",
    synonyms: ["AP", "payables", "trade payables", "creditors", "amounts owed"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["accounts receivable", "expenses", "balance sheet"],
    definition: "Money a company owes to its suppliers"
  },
  {
    term: "general ledger",
    synonyms: ["GL", "ledger", "accounting ledger", "main ledger"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["journal", "accounts", "trial balance"],
    definition: "Master record of all financial transactions"
  },
  {
    term: "journal entry",
    synonyms: ["accounting entry", "ledger entry", "book entry", "posting"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["general ledger", "debit", "credit"],
    definition: "Record of a financial transaction"
  },
  {
    term: "debit",
    synonyms: ["Dr", "charge", "debit entry"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["credit", "journal entry", "account"],
    definition: "Entry recording increase in assets or decrease in liabilities"
  },
  {
    term: "credit",
    synonyms: ["Cr", "credit entry"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["debit", "journal entry", "account"],
    definition: "Entry recording decrease in assets or increase in liabilities"
  },
  {
    term: "trial balance",
    synonyms: ["TB", "balance verification", "account balance summary"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["general ledger", "debit", "credit"],
    definition: "List of all account balances to verify accuracy"
  },
  {
    term: "accrual",
    synonyms: ["accrued expense", "accrued revenue", "accrued income"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["cash basis", "revenue recognition", "expenses"],
    definition: "Recording transactions when they occur, not when cash moves"
  },
  {
    term: "reconciliation",
    synonyms: ["account reconciliation", "bank reconciliation", "balance matching"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["bank statement", "general ledger", "discrepancy"],
    definition: "Process of matching account balances"
  },
  {
    term: "audit",
    synonyms: ["financial audit", "examination", "review", "inspection"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["financial statements", "compliance", "auditor"],
    definition: "Official examination of financial records"
  },
  {
    term: "fiscal year",
    synonyms: ["financial year", "FY", "accounting year", "tax year"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["quarter", "annual report", "budget"],
    definition: "12-month period for financial reporting"
  },
  {
    term: "cost of goods sold",
    synonyms: ["COGS", "cost of sales", "direct costs"],
    domain: "accounting",
    language: "en",
    relatedTerms: ["revenue", "gross profit", "inventory"],
    definition: "Direct costs of producing goods sold"
  },

  // ============================================
  // ACCOUNTING TERMINOLOGY - PORTUGUESE
  // ============================================
  {
    term: "contas a receber",
    synonyms: ["recebíveis", "clientes", "valores a receber", "devedores"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["contas a pagar", "receita", "balanço"],
    definition: "Dinheiro devido à empresa por seus clientes"
  },
  {
    term: "contas a pagar",
    synonyms: ["fornecedores", "valores a pagar", "credores"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["contas a receber", "despesas", "balanço"],
    definition: "Dinheiro que a empresa deve a seus fornecedores"
  },
  {
    term: "razão geral",
    synonyms: ["livro razão", "razão contábil", "livro contábil"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["diário", "contas", "balancete"],
    definition: "Registro mestre de todas as transações financeiras"
  },
  {
    term: "lançamento contábil",
    synonyms: ["registro contábil", "partida", "entrada contábil"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["razão geral", "débito", "crédito"],
    definition: "Registro de uma transação financeira"
  },
  {
    term: "débito",
    synonyms: ["D", "lançamento a débito"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["crédito", "lançamento", "conta"],
    definition: "Entrada registrando aumento em ativos ou diminuição em passivos"
  },
  {
    term: "crédito",
    synonyms: ["C", "lançamento a crédito"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["débito", "lançamento", "conta"],
    definition: "Entrada registrando diminuição em ativos ou aumento em passivos"
  },
  {
    term: "balancete",
    synonyms: ["balancete de verificação", "resumo de saldos"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["razão geral", "débito", "crédito"],
    definition: "Lista de todos os saldos de contas para verificação"
  },
  {
    term: "regime de competência",
    synonyms: ["accrual", "competência contábil"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["regime de caixa", "receita", "despesas"],
    definition: "Registrar transações quando ocorrem, não quando o dinheiro move"
  },
  {
    term: "conciliação",
    synonyms: ["conciliação bancária", "reconciliação", "conferência"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["extrato bancário", "razão geral", "diferença"],
    definition: "Processo de correspondência de saldos de contas"
  },
  {
    term: "auditoria",
    synonyms: ["revisão contábil", "exame", "inspeção"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["demonstrações financeiras", "conformidade", "auditor"],
    definition: "Exame oficial de registros financeiros"
  },
  {
    term: "ano fiscal",
    synonyms: ["exercício fiscal", "ano contábil", "exercício financeiro"],
    domain: "accounting",
    language: "pt",
    relatedTerms: ["trimestre", "relatório anual", "orçamento"],
    definition: "Período de 12 meses para relatórios financeiros"
  },

  // ============================================
  // ACCOUNTING TERMINOLOGY - SPANISH
  // ============================================
  {
    term: "cuentas por cobrar",
    synonyms: ["cobros pendientes", "deudores", "clientes"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["cuentas por pagar", "ingresos", "balance"],
    definition: "Dinero adeudado a la empresa por sus clientes"
  },
  {
    term: "cuentas por pagar",
    synonyms: ["pagos pendientes", "acreedores", "proveedores"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["cuentas por cobrar", "gastos", "balance"],
    definition: "Dinero que la empresa debe a sus proveedores"
  },
  {
    term: "libro mayor",
    synonyms: ["mayor general", "libro contable", "razón general"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["diario", "cuentas", "balance de comprobación"],
    definition: "Registro maestro de todas las transacciones financieras"
  },
  {
    term: "asiento contable",
    synonyms: ["registro contable", "entrada contable", "partida"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["libro mayor", "débito", "crédito"],
    definition: "Registro de una transacción financiera"
  },
  {
    term: "débito",
    synonyms: ["cargo", "debe"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["crédito", "asiento", "cuenta"],
    definition: "Entrada registrando aumento en activos o disminución en pasivos"
  },
  {
    term: "crédito",
    synonyms: ["abono", "haber"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["débito", "asiento", "cuenta"],
    definition: "Entrada registrando disminución en activos o aumento en pasivos"
  },
  {
    term: "balance de comprobación",
    synonyms: ["balanza de comprobación", "balance de sumas y saldos"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["libro mayor", "débito", "crédito"],
    definition: "Lista de todos los saldos de cuentas para verificación"
  },
  {
    term: "devengo",
    synonyms: ["base devengada", "acumulación"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["base de efectivo", "ingresos", "gastos"],
    definition: "Registrar transacciones cuando ocurren, no cuando se mueve efectivo"
  },
  {
    term: "conciliación",
    synonyms: ["conciliación bancaria", "reconciliación", "cuadre"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["estado de cuenta", "libro mayor", "diferencia"],
    definition: "Proceso de correspondencia de saldos de cuentas"
  },
  {
    term: "auditoría",
    synonyms: ["revisión contable", "examen", "inspección"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["estados financieros", "cumplimiento", "auditor"],
    definition: "Examen oficial de registros financieros"
  },
  {
    term: "año fiscal",
    synonyms: ["ejercicio fiscal", "año contable", "período fiscal"],
    domain: "accounting",
    language: "es",
    relatedTerms: ["trimestre", "informe anual", "presupuesto"],
    definition: "Período de 12 meses para informes financieros"
  },

  // ============================================
  // GENERAL/CROSS-DOMAIN TERMINOLOGY
  // ============================================
  {
    term: "compliance",
    synonyms: ["conformity", "adherence", "regulatory compliance", "observance"],
    domain: "general",
    language: "en",
    relatedTerms: ["regulation", "policy", "audit"],
    definition: "Adherence to laws, regulations, and policies"
  },
  {
    term: "stakeholder",
    synonyms: ["interested party", "participant", "shareholder", "investor"],
    domain: "general",
    language: "en",
    relatedTerms: ["company", "management", "board"],
    definition: "Person or group with interest in an organization"
  },
  {
    term: "benchmark",
    synonyms: ["standard", "reference point", "baseline", "yardstick"],
    domain: "general",
    language: "en",
    relatedTerms: ["performance", "comparison", "metric"],
    definition: "Standard or reference for comparison"
  },
  {
    term: "KPI",
    synonyms: ["key performance indicator", "metric", "performance measure", "success indicator"],
    domain: "general",
    language: "en",
    relatedTerms: ["performance", "goal", "target"],
    definition: "Measurable value demonstrating effectiveness"
  },
  {
    term: "due date",
    synonyms: ["deadline", "maturity date", "payment date", "expiration"],
    domain: "general",
    language: "en",
    relatedTerms: ["payment", "invoice", "contract"],
    definition: "Date by which something must be completed"
  },
];

// Domain-specific collections for easier access
export const financialTermsEN = terminologySeedData.filter(t => t.domain === 'financial' && t.language === 'en');
export const financialTermsPT = terminologySeedData.filter(t => t.domain === 'financial' && t.language === 'pt');
export const financialTermsES = terminologySeedData.filter(t => t.domain === 'financial' && t.language === 'es');

export const legalTermsEN = terminologySeedData.filter(t => t.domain === 'legal' && t.language === 'en');
export const legalTermsPT = terminologySeedData.filter(t => t.domain === 'legal' && t.language === 'pt');
export const legalTermsES = terminologySeedData.filter(t => t.domain === 'legal' && t.language === 'es');

export const medicalTermsEN = terminologySeedData.filter(t => t.domain === 'medical' && t.language === 'en');
export const medicalTermsPT = terminologySeedData.filter(t => t.domain === 'medical' && t.language === 'pt');
export const medicalTermsES = terminologySeedData.filter(t => t.domain === 'medical' && t.language === 'es');

export const accountingTermsEN = terminologySeedData.filter(t => t.domain === 'accounting' && t.language === 'en');
export const accountingTermsPT = terminologySeedData.filter(t => t.domain === 'accounting' && t.language === 'pt');
export const accountingTermsES = terminologySeedData.filter(t => t.domain === 'accounting' && t.language === 'es');

export const generalTerms = terminologySeedData.filter(t => t.domain === 'general');

// Statistics
export const terminologyStats = {
  total: terminologySeedData.length,
  byDomain: {
    financial: terminologySeedData.filter(t => t.domain === 'financial').length,
    legal: terminologySeedData.filter(t => t.domain === 'legal').length,
    medical: terminologySeedData.filter(t => t.domain === 'medical').length,
    accounting: terminologySeedData.filter(t => t.domain === 'accounting').length,
    general: terminologySeedData.filter(t => t.domain === 'general').length,
  },
  byLanguage: {
    en: terminologySeedData.filter(t => t.language === 'en').length,
    pt: terminologySeedData.filter(t => t.language === 'pt').length,
    es: terminologySeedData.filter(t => t.language === 'es').length,
  }
};

export default terminologySeedData;
