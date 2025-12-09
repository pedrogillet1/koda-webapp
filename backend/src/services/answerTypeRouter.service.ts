/**
 * Answer Type Router Service
 * Single source of truth for routing all query types
 *
 * Detects which answer flow to use based on query characteristics
 */

export type AnswerType =
  | 'ULTRA_FAST_GREETING'
  | 'ULTRA_FAST_DOC_COUNT'
  | 'FILE_NAVIGATION'
  | 'FOLDER_NAVIGATION'
  | 'CALCULATION'
  | 'SIMPLE_EXTRACTION'
  | 'STANDARD_QUERY'
  | 'COMPLEX_ANALYSIS';

interface DetectionParams {
  query: string;
  language: string;
  conversationContext?: any;
  userId?: string;
}

// ============================================================================
// ULTRA-FAST DETECTION (< 50ms)
// ============================================================================

function detectUltraFastGreeting(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase().trim();

  // Pure greetings only (no follow-up text)
  const pureGreetings = [
    // English
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    // Portuguese
    'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
    // Spanish
    'hola', 'buenos días', 'buenas tardes', 'buenas noches',
  ];

  return pureGreetings.includes(lower);
}

function detectUltraFastDocCount(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Pattern: "How many documents..." / "Quantos documentos..." / "Cuántos documentos..."
  const patterns = [
    // English
    /^(how many|quantos?|cuántos?) (documents?|arquivos?|ficheiros?|files?)/i,
    /^(total|número de) (documents?|arquivos?)/i,
    // Portuguese
    /^quantos? (documentos?|arquivos?) (eu )?tenho/i,
    /^(qual|me diga) (o )?total de documentos?/i,
    // Spanish
    /^cuántos? documentos? tengo/i,
  ];

  return patterns.some(pattern => pattern.test(lower));
}

// ============================================================================
// FILE & FOLDER NAVIGATION DETECTION (200-500ms)
// ============================================================================

function detectFileNavigation(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Pattern 1: "Where is [filename]"
  const hasLocationKeyword = /\b(where|find|locate|location|onde|encontre|localiz)/i.test(lower);
  const hasFilenamePattern = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|gif)\b/i.test(query);

  if (hasLocationKeyword && hasFilenamePattern) return true;

  // Pattern 2: "Where is the file that talks about X?"
  const contentBasedPatterns = [
    /\b(where|find|locate|onde|encontre)\b.*\b(file|document|arquivo|documento)\b.*\b(about|talks?\s*about|mentions?|contains?|sobre|fala\s*sobre|menciona|contém)\b/i,
    /\b(which|what|qual)\b.*\b(file|document|arquivo|documento)\b.*\b(has|contains?|mentions?|tem|contém|menciona)\b/i,
  ];

  return contentBasedPatterns.some(pattern => pattern.test(lower));
}

function detectFolderNavigation(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Pattern: "What files are in [folder]" / "Show me the Finance folder"
  const folderPatterns = [
    // English
    /\b(what|show|list|display)\b.*\b(files?|documents?)\b.*\b(in|inside|within)\b.*\b(folder|directory)/i,
    /\b(show|open|display)\b.*\b(folder|directory)\b/i,
    // Portuguese
    /\b(quais?|mostre|liste)\b.*\b(arquivos?|documentos?)\b.*\b(na|no|dentro)\b.*\b(pasta|diretório)/i,
    /\b(mostre|abra|exiba)\b.*\b(pasta|diretório)\b/i,
    // Spanish
    /\b(qué|muestra|lista)\b.*\b(archivos?|documentos?)\b.*\b(en|dentro)\b.*\b(carpeta|directorio)/i,
  ];

  return folderPatterns.some(pattern => pattern.test(lower));
}

// ============================================================================
// CALCULATION DETECTION (500ms-2s)
// ============================================================================

function detectCalculation(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Arithmetic patterns
  const arithmeticPatterns = [
    /\d+\s*[\+\-\*\/×÷]\s*\d+/,  // "10 + 5", "100 * 2"
    /\b(calculate|compute|what is|quanto é|cuánto es)\b.*\d+/i,
  ];

  // Financial calculation patterns
  const financialPatterns = [
    /\b(roi|return on investment|retorno sobre investimento)\b/i,
    /\b(payback|período de retorno)\b/i,
    /\b(npv|net present value|valor presente líquido|vpl)\b/i,
    /\b(irr|internal rate of return|taxa interna de retorno|tir)\b/i,
  ];

  // Excel formula patterns
  const excelPatterns = [
    /^=\w+\(/,  // "=SUM(", "=AVERAGE("
  ];

  return [...arithmeticPatterns, ...financialPatterns, ...excelPatterns].some(pattern => pattern.test(query));
}

// ============================================================================
// RAG COMPLEXITY DETECTION (300ms-5s)
// ============================================================================

function detectSimpleExtraction(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Simple extraction patterns (single value, date, name, etc.)
  const simplePatterns = [
    // Value extraction
    /^(what is|qual é|cuál es)\s+(the\s+)?(total|value|amount|valor|quantidade)/i,
    /^(how much|quanto|cuánto)/i,

    // Date extraction
    /^(when|quando|cuándo)\s+(was|is|será)/i,

    // Name extraction
    /^(who|quem|quién)\s+(is|was|será)/i,

    // Address extraction
    /^(what is|qual é|cuál es)\s+(the\s+)?(address|endereço|dirección)/i,

    // Deadline extraction
    /^(what is|qual é|cuál es)\s+(the\s+)?(deadline|prazo|fecha límite)/i,

    // Price extraction
    /^(how much does it cost|quanto custa|cuánto cuesta)/i,
  ];

  return simplePatterns.some(pattern => pattern.test(lower));
}

function detectComplexAnalysis(params: DetectionParams): boolean {
  const { query } = params;
  const lower = query.toLowerCase();

  // Complex analysis patterns
  const complexPatterns = [
    // Comparison
    /\b(compare|comparison|comparar|comparação|versus|vs)\b/i,

    // Analysis
    /\b(analyze|analyse|analysis|analisar|análise|analizar|análisis)\b/i,

    // Financial viability
    /\b(viability|viabilidade|viabilidad)\b/i,

    // Risk analysis
    /\b(risk|risco|riesgo)\b.*\b(analysis|análise|análisis|mitigation|mitigação|mitigación)\b/i,

    // Multi-document
    /\b(all|todos?|todas?)\b.*\b(documents?|arquivos?|documentos?)\b/i,

    // Trend analysis
    /\b(trend|tendência|tendencia|over time|ao longo do tempo|a lo largo del tiempo)\b/i,
  ];

  return complexPatterns.some(pattern => pattern.test(lower));
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

export function detectAnswerType(params: DetectionParams): AnswerType {
  // Ultra-fast paths (< 50ms - no DB, no LLM)
  if (detectUltraFastGreeting(params)) return 'ULTRA_FAST_GREETING';
  if (detectUltraFastDocCount(params)) return 'ULTRA_FAST_DOC_COUNT';

  // Fast paths (200-500ms - DB only, no LLM)
  if (detectFileNavigation(params)) return 'FILE_NAVIGATION';
  if (detectFolderNavigation(params)) return 'FOLDER_NAVIGATION';

  // Calculation path (500ms-2s - calculation engine + LLM)
  if (detectCalculation(params)) return 'CALCULATION';

  // RAG paths (300ms-5s - full retrieval + LLM)
  if (detectSimpleExtraction(params)) return 'SIMPLE_EXTRACTION';
  if (detectComplexAnalysis(params)) return 'COMPLEX_ANALYSIS';

  // Default to standard query
  return 'STANDARD_QUERY';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getEstimatedTime(answerType: AnswerType): string {
  const timeMap: Record<AnswerType, string> = {
    'ULTRA_FAST_GREETING': '< 50ms',
    'ULTRA_FAST_DOC_COUNT': '< 500ms',
    'FILE_NAVIGATION': '200-500ms',
    'FOLDER_NAVIGATION': '200-500ms',
    'CALCULATION': '500ms-2s',
    'SIMPLE_EXTRACTION': '300-500ms',
    'STANDARD_QUERY': '500ms-2s',
    'COMPLEX_ANALYSIS': '2s-5s',
  };

  return timeMap[answerType];
}

export function requiresRetrieval(answerType: AnswerType): boolean {
  return [
    'SIMPLE_EXTRACTION',
    'STANDARD_QUERY',
    'COMPLEX_ANALYSIS',
  ].includes(answerType);
}

export function requiresLLM(answerType: AnswerType): boolean {
  // All types now use LLM for adaptive responses
  return true;
}

export function getModelForAnswerType(answerType: AnswerType): 'flash' | 'pro' {
  return answerType === 'COMPLEX_ANALYSIS' ? 'pro' : 'flash';
}

// ============================================================================
// LOGGING
// ============================================================================

export function logAnswerTypeDetection(params: DetectionParams, answerType: AnswerType): void {
  console.log('');
  console.log('='.repeat(60));
  console.log('ANSWER TYPE ROUTER');
  console.log('='.repeat(60));
  console.log(`   Query: "${params.query}"`);
  console.log(`   Language: ${params.language}`);
  console.log(`   Detected Type: ${answerType}`);
  console.log(`   Estimated Time: ${getEstimatedTime(answerType)}`);
  console.log(`   Requires Retrieval: ${requiresRetrieval(answerType)}`);
  console.log(`   Model: ${getModelForAnswerType(answerType)}`);
  console.log('='.repeat(60));
  console.log('');
}

export default {
  detectAnswerType,
  getEstimatedTime,
  requiresRetrieval,
  requiresLLM,
  getModelForAnswerType,
  logAnswerTypeDetection,
};
