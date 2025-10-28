/**
 * Document Type Classifier Service
 * Automatically classifies documents into semantic categories
 * Enables queries like "Do I have any identification documents?"
 */

export type DocumentCategory =
  | 'IDENTIFICATION'
  | 'FINANCIAL'
  | 'LEGAL'
  | 'MEDICAL'
  | 'ACADEMIC'
  | 'EMPLOYMENT'
  | 'PERSONAL'
  | 'OTHER';

interface ClassificationResult {
  category: DocumentCategory;
  confidence: number;
  reasoning: string;
}

export class DocumentTypeClassifier {

  /**
   * Classify a document based on filename and OCR text
   */
  classifyDocument(filename: string, ocrText: string = ''): ClassificationResult {
    const lowerFilename = filename.toLowerCase();
    const lowerText = ocrText.toLowerCase();

    // Try each classification method in order of specificity
    const identificationResult = this.checkIdentification(lowerFilename, lowerText);
    if (identificationResult.confidence > 0.8) return identificationResult;

    const financialResult = this.checkFinancial(lowerFilename, lowerText);
    if (financialResult.confidence > 0.8) return financialResult;

    const legalResult = this.checkLegal(lowerFilename, lowerText);
    if (legalResult.confidence > 0.8) return legalResult;

    const medicalResult = this.checkMedical(lowerFilename, lowerText);
    if (medicalResult.confidence > 0.8) return medicalResult;

    const academicResult = this.checkAcademic(lowerFilename, lowerText);
    if (academicResult.confidence > 0.8) return academicResult;

    const employmentResult = this.checkEmployment(lowerFilename, lowerText);
    if (employmentResult.confidence > 0.8) return employmentResult;

    // Return the highest confidence result if no high-confidence match
    const results = [
      identificationResult,
      financialResult,
      legalResult,
      medicalResult,
      academicResult,
      employmentResult
    ];

    const bestResult = results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    if (bestResult.confidence > 0.5) {
      return bestResult;
    }

    // Default to OTHER if no good match
    return {
      category: 'OTHER',
      confidence: 1.0,
      reasoning: 'Could not determine specific document type'
    };
  }

  /**
   * Check if document is an identification document
   */
  private checkIdentification(filename: string, text: string): ClassificationResult {
    const identificationKeywords = [
      // Document types
      'passport', 'passaporte', 'driver', 'driving', 'license', 'licence',
      'cnh', 'carteira nacional', 'id card', 'identity', 'identidade',
      'rg', 'registro geral', 'cpf', 'social security', 'ssn',
      'birth certificate', 'certidão de nascimento', 'visa', 'visto',

      // Content indicators
      'date of birth', 'data de nascimento', 'nationality', 'nacionalidade',
      'document number', 'número do documento', 'place of birth',
      'expiry date', 'data de validade'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of identificationKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        // Filename matches are weighted higher
        score += filename.includes(keyword) ? 0.3 : 0.1;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'IDENTIFICATION',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains identification keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No identification indicators found'
    };
  }

  /**
   * Check if document is a financial document
   */
  private checkFinancial(filename: string, text: string): ClassificationResult {
    const financialKeywords = [
      // Document types
      'invoice', 'nota fiscal', 'receipt', 'recibo', 'bank statement',
      'extrato bancário', 'tax', 'imposto', 'balance sheet', 'balanço',
      'payslip', 'holerite', 'salary', 'salário', 'budget', 'orçamento',
      'revenue', 'receita', 'expense', 'despesa', 'profit', 'lucro',

      // Financial terms
      'payment', 'pagamento', 'credit', 'crédito', 'debit', 'débito',
      'transaction', 'transação', 'account', 'conta', 'balance', 'saldo',
      'interest', 'juros', 'loan', 'empréstimo'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of financialKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        score += filename.includes(keyword) ? 0.25 : 0.08;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'FINANCIAL',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains financial keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No financial indicators found'
    };
  }

  /**
   * Check if document is a legal document
   */
  private checkLegal(filename: string, text: string): ClassificationResult {
    const legalKeywords = [
      // Document types
      'contract', 'contrato', 'agreement', 'acordo', 'terms', 'termos',
      'legal', 'jurídico', 'lawsuit', 'processo', 'court', 'tribunal',
      'judgment', 'sentença', 'deed', 'escritura', 'will', 'testamento',
      'power of attorney', 'procuração',

      // Legal terms
      'whereas', 'considerando', 'hereby', 'por meio', 'party', 'parte',
      'witness', 'testemunha', 'clause', 'cláusula', 'article', 'artigo',
      'section', 'seção', 'litigant', 'litigante'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of legalKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        score += filename.includes(keyword) ? 0.3 : 0.1;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'LEGAL',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains legal keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No legal indicators found'
    };
  }

  /**
   * Check if document is a medical document
   */
  private checkMedical(filename: string, text: string): ClassificationResult {
    const medicalKeywords = [
      // Document types
      'prescription', 'receita médica', 'medical record', 'prontuário',
      'diagnosis', 'diagnóstico', 'test result', 'resultado de exame',
      'lab report', 'laudo', 'vaccine', 'vacina', 'x-ray', 'raio-x',
      'health', 'saúde', 'hospital', 'clinic', 'clínica',

      // Medical terms
      'patient', 'paciente', 'doctor', 'médico', 'treatment', 'tratamento',
      'medication', 'medicamento', 'dosage', 'dosagem', 'symptoms', 'sintomas',
      'blood pressure', 'pressão arterial', 'heart rate', 'frequência cardíaca'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of medicalKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        score += filename.includes(keyword) ? 0.3 : 0.1;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'MEDICAL',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains medical keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No medical indicators found'
    };
  }

  /**
   * Check if document is an academic document
   */
  private checkAcademic(filename: string, text: string): ClassificationResult {
    const academicKeywords = [
      // Document types
      'transcript', 'histórico escolar', 'diploma', 'certificate', 'certificado',
      'degree', 'grau', 'thesis', 'tese', 'dissertation', 'dissertação',
      'report card', 'boletim', 'grade', 'nota', 'syllabus', 'programa',

      // Academic terms
      'university', 'universidade', 'college', 'faculdade', 'school', 'escola',
      'student', 'estudante', 'professor', 'course', 'curso', 'semester', 'semestre',
      'academic', 'acadêmico', 'gpa', 'cr', 'credit', 'crédito'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of academicKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        score += filename.includes(keyword) ? 0.3 : 0.1;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'ACADEMIC',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains academic keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No academic indicators found'
    };
  }

  /**
   * Check if document is an employment document
   */
  private checkEmployment(filename: string, text: string): ClassificationResult {
    const employmentKeywords = [
      // Document types
      'resume', 'cv', 'currículo', 'cover letter', 'carta de apresentação',
      'job offer', 'proposta de emprego', 'employment contract', 'contrato de trabalho',
      'termination', 'demissão', 'resignation', 'renúncia', 'reference', 'referência',

      // Employment terms
      'employer', 'empregador', 'employee', 'empregado', 'position', 'cargo',
      'hire', 'contratação', 'salary', 'salário', 'benefits', 'benefícios',
      'work experience', 'experiência profissional', 'skills', 'habilidades'
    ];

    let score = 0;
    let matchedKeywords: string[] = [];

    for (const keyword of employmentKeywords) {
      if (filename.includes(keyword) || text.includes(keyword)) {
        score += filename.includes(keyword) ? 0.3 : 0.1;
        matchedKeywords.push(keyword);
      }
    }

    const confidence = Math.min(score, 1.0);

    return {
      category: 'EMPLOYMENT',
      confidence,
      reasoning: matchedKeywords.length > 0
        ? `Contains employment keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        : 'No employment indicators found'
    };
  }

  /**
   * Get human-readable category name
   */
  getCategoryName(category: DocumentCategory): string {
    const names: Record<DocumentCategory, string> = {
      IDENTIFICATION: 'Identification Documents',
      FINANCIAL: 'Financial Documents',
      LEGAL: 'Legal Documents',
      MEDICAL: 'Medical Documents',
      ACADEMIC: 'Academic Documents',
      EMPLOYMENT: 'Employment Documents',
      PERSONAL: 'Personal Documents',
      OTHER: 'Other Documents'
    };

    return names[category];
  }

  /**
   * Check if a query is asking for documents by category
   */
  extractCategoryFromQuery(query: string): DocumentCategory | null {
    const lowerQuery = query.toLowerCase();

    const categoryPatterns: Record<DocumentCategory, string[]> = {
      IDENTIFICATION: [
        'identification', 'id documents', 'passports', 'licenses', 'ids',
        'documentos de identificação', 'identidade', 'passaportes', 'carteiras'
      ],
      FINANCIAL: [
        'financial', 'bank', 'invoice', 'receipt', 'tax', 'payment',
        'financeiros', 'bancários', 'notas fiscais', 'recibos', 'impostos'
      ],
      LEGAL: [
        'legal', 'contract', 'agreement', 'court',
        'jurídicos', 'contratos', 'acordos', 'judicial'
      ],
      MEDICAL: [
        'medical', 'health', 'prescription', 'exam',
        'médicos', 'saúde', 'receitas', 'exames'
      ],
      ACADEMIC: [
        'academic', 'school', 'university', 'transcript', 'diploma',
        'acadêmicos', 'escolares', 'universitários', 'histórico', 'diplomas'
      ],
      EMPLOYMENT: [
        'employment', 'job', 'work', 'resume', 'cv',
        'emprego', 'trabalho', 'currículo'
      ],
      PERSONAL: [
        'personal',
        'pessoais'
      ],
      OTHER: []
    };

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (lowerQuery.includes(pattern)) {
          return category as DocumentCategory;
        }
      }
    }

    return null;
  }
}

export default new DocumentTypeClassifier();
