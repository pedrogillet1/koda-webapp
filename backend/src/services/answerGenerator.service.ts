/**
 * Answer Generator - Unified Answer Generation
 * 
 * Merges:
 * - adaptiveAnswerGeneration.service.ts
 * - skillAwareAnswerGeneration.service.ts
 * - rag/generation/answer-generator.service.ts
 * - rag/generation/prompt-builder.service.ts
 * 
 * Single source of truth for LLM answer generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GenerateAnswerOptions {
  query: string;
  context: string;
  languageCode: string;
  answerType: string;
  skill?: string;
  systemPrompt?: string;
  streamingCallback?: (chunk: string) => void;
}

export interface GeneratedAnswer {
  text: string;
  tokensUsed: number;
  model: string;
  generationTime: number;
  wasStreaming: boolean;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate adaptive answer using Gemini
 */
export async function generateAdaptiveAnswer(
  options: GenerateAnswerOptions
): Promise<GeneratedAnswer> {
  const startTime = Date.now();
  
  const {
    query,
    context,
    languageCode,
    answerType,
    skill,
    systemPrompt,
    streamingCallback,
  } = options;

  // Select model based on answer type
  const modelName = selectModel(answerType);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Build system prompt
  const fullSystemPrompt = buildSystemPrompt({
    languageCode,
    answerType,
    skill,
    customPrompt: systemPrompt,
  });

  // Build final prompt
  const finalPrompt = `${fullSystemPrompt}\n\n${context}\n\n## User Query\n\n${query}`;

  // Generate (with or without streaming)
  let text = '';
  let tokensUsed = 0;

  if (streamingCallback) {
    // Streaming generation
    const result = await model.generateContentStream(finalPrompt);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      text += chunkText;
      streamingCallback(chunkText);
    }

    const response = await result.response;
    tokensUsed = response.usageMetadata?.totalTokenCount || estimateTokens(text);
  } else {
    // Non-streaming generation
    const result = await model.generateContent(finalPrompt);
    const response = result.response;
    text = response.text();
    tokensUsed = response.usageMetadata?.totalTokenCount || estimateTokens(text);
  }

  const generationTime = Date.now() - startTime;

  return {
    text,
    tokensUsed,
    model: modelName,
    generationTime,
    wasStreaming: !!streamingCallback,
  };
}

/**
 * Select model based on answer type
 */
function selectModel(answerType: string): string {
  // Use Flash for most queries (fast, cheap)
  if (answerType === 'COMPLEX_ANALYSIS') {
    return 'gemini-2.0-flash-exp'; // Still use Flash, it's very capable
  }

  return 'gemini-2.0-flash-exp';
}

/**
 * Build system prompt
 */
function buildSystemPrompt(params: {
  languageCode: string;
  answerType: string;
  skill?: string;
  customPrompt?: string;
}): string {
  const { languageCode, answerType, skill, customPrompt } = params;

  // If custom prompt provided, use it
  if (customPrompt) {
    return customPrompt;
  }

  // Base instructions
  const baseInstructions = getBaseInstructions(languageCode);
  
  // Answer type specific instructions
  const typeInstructions = getAnswerTypeInstructions(answerType, languageCode);
  
  // Skill-specific instructions
  const skillInstructions = skill ? getSkillInstructions(skill, languageCode) : '';

  // Format instructions
  const formatInstructions = getFormatInstructions(languageCode);

  return [
    baseInstructions,
    typeInstructions,
    skillInstructions,
    formatInstructions,
  ].filter(Boolean).join('\n\n');
}

/**
 * Get base instructions
 */
function getBaseInstructions(lang: string): string {
  const instructions: Record<string, string> = {
    en: `You are Koda, an AI assistant specialized in document analysis and knowledge retrieval.

CRITICAL RULES:
1. Answer ONLY in English
2. Base answers ONLY on provided documents
3. Use {{DOC:::filename.ext}} markers for ALL document references
4. NO emoji anywhere
5. End with ONE follow-up question`,
    
    pt: `Você é o Koda, um assistente de IA especializado em análise de documentos e recuperação de conhecimento.

REGRAS CRÍTICAS:
1. Responda APENAS em português
2. Base as respostas APENAS nos documentos fornecidos
3. Use marcadores {{DOC:::nomedoarquivo.ext}} para TODAS as referências a documentos
4. SEM emoji em lugar nenhum
5. Termine com UMA pergunta de acompanhamento`,

    es: `Eres Koda, un asistente de IA especializado en análisis de documentos y recuperación de conocimiento.

REGLAS CRÍTICAS:
1. Responde SOLO en español
2. Basa las respuestas SOLO en los documentos proporcionados
3. Usa marcadores {{DOC:::nombredearchivo.ext}} para TODAS las referencias a documentos
4. SIN emoji en ningún lugar
5. Termina con UNA pregunta de seguimiento`,
  };

  return instructions[lang] || instructions.en;
}

/**
 * Get answer type specific instructions
 */
function getAnswerTypeInstructions(answerType: string, lang: string): string {
  const instructions: Record<string, Record<string, string>> = {
    COMPLEX_ANALYSIS: {
      en: `## Complex Analysis Mode

Structure your answer:
1. **Executive Summary** (2-3 sentences)
2. **Detailed Analysis** (with H2 sections)
3. **Key Findings** (bullet points)
4. **Recommendations** (if applicable)

Use step-by-step reasoning for complex questions.`,
      
      pt: `## Modo de Análise Complexa

Estruture sua resposta:
1. **Resumo Executivo** (2-3 frases)
2. **Análise Detalhada** (com seções H2)
3. **Principais Descobertas** (bullet points)
4. **Recomendações** (se aplicável)

Use raciocínio passo a passo para questões complexas.`,

      es: `## Modo de Análisis Complejo

Estructura tu respuesta:
1. **Resumen Ejecutivo** (2-3 oraciones)
2. **Análisis Detallado** (con secciones H2)
3. **Hallazgos Clave** (puntos)
4. **Recomendaciones** (si aplica)

Usa razonamiento paso a paso para preguntas complejas.`,
    },

    SINGLE_DOC_RAG: {
      en: `## Single Document Mode

Focus on the specific document mentioned.
Be concise and direct.
Quote exact numbers and facts.`,

      pt: `## Modo de Documento Único

Foque no documento específico mencionado.
Seja conciso e direto.
Cite números e fatos exatos.`,

      es: `## Modo de Documento Único

Enfócate en el documento específico mencionado.
Sé conciso y directo.
Cita números y hechos exactos.`,
    },

    CROSS_DOC_RAG: {
      en: `## Cross-Document Mode

Compare and synthesize information across documents.
Use tables for comparisons when appropriate.
Highlight differences and similarities.`,

      pt: `## Modo de Múltiplos Documentos

Compare e sintetize informações entre documentos.
Use tabelas para comparações quando apropriado.
Destaque diferenças e semelhanças.`,

      es: `## Modo de Múltiples Documentos

Compara y sintetiza información entre documentos.
Usa tablas para comparaciones cuando sea apropiado.
Destaca diferencias y similitudes.`,
    },
  };

  return instructions[answerType]?.[lang] || '';
}

/**
 * Get skill-specific instructions
 */
function getSkillInstructions(skill: string, lang: string): string {
  const instructions: Record<string, Record<string, string>> = {
    financial_analysis: {
      en: `## Financial Analysis Guidelines

- Always show formulas: ROI = (Gain - Cost) / Cost × 100%
- Include units: $, %, years
- Cite exact numbers from documents
- Explain financial terms when first used`,

      pt: `## Diretrizes de Análise Financeira

- Sempre mostre fórmulas: ROI = (Ganho - Custo) / Custo × 100%
- Inclua unidades: R$, %, anos
- Cite números exatos dos documentos
- Explique termos financeiros na primeira vez que usar`,

      es: `## Directrices de Análisis Financiero

- Siempre muestra fórmulas: ROI = (Ganancia - Costo) / Costo × 100%
- Incluye unidades: $, %, años
- Cita números exactos de los documentos
- Explica términos financieros la primera vez que los uses`,
    },

    legal: {
      en: `## Legal Analysis Guidelines

- Reference specific clauses and sections
- Explain legal terms in plain language
- Note any ambiguities or risks
- Add disclaimer: "This is not legal advice"`,

      pt: `## Diretrizes de Análise Jurídica

- Referencie cláusulas e seções específicas
- Explique termos jurídicos em linguagem simples
- Note ambiguidades ou riscos
- Adicione aviso: "Isto não é aconselhamento jurídico"`,

      es: `## Directrices de Análisis Legal

- Referencia cláusulas y secciones específicas
- Explica términos legales en lenguaje simple
- Nota ambigüedades o riesgos
- Agrega aviso: "Esto no es asesoramiento legal"`,
    },

    medical: {
      en: `## Medical Analysis Guidelines

- Include reference ranges for lab results
- Explain medical terms in plain language
- Note normal vs abnormal values
- Add disclaimer: "This is not medical advice. Consult a healthcare professional."`,

      pt: `## Diretrizes de Análise Médica

- Inclua valores de referência para resultados de exames
- Explique termos médicos em linguagem simples
- Note valores normais vs anormais
- Adicione aviso: "Isto não é aconselhamento médico. Consulte um profissional de saúde."`,

      es: `## Directrices de Análisis Médico

- Incluye rangos de referencia para resultados de laboratorio
- Explica términos médicos en lenguaje simple
- Nota valores normales vs anormales
- Agrega aviso: "Esto no es consejo médico. Consulta a un profesional de la salud."`,
    },
  };

  return instructions[skill]?.[lang] || '';
}

/**
 * Get format instructions
 */
function getFormatInstructions(lang: string): string {
  const instructions: Record<string, string> = {
    en: `## Output Format

1. Use **bold** for emphasis (NOT italic)
2. Use H2 (##) for main sections
3. Use bullet points for lists
4. Use tables for comparisons
5. Reference documents: {{DOC:::filename.ext}}
6. NO ### Source sections
7. NO emoji
8. End with ONE follow-up question (neutral tone)

Example follow-up:
"Would you like to see a detailed breakdown or compare with other periods?"`,

    pt: `## Formato de Saída

1. Use **negrito** para ênfase (NÃO itálico)
2. Use H2 (##) para seções principais
3. Use bullet points para listas
4. Use tabelas para comparações
5. Referencie documentos: {{DOC:::nomedoarquivo.ext}}
6. SEM seções ### Fonte
7. SEM emoji
8. Termine com UMA pergunta de acompanhamento (tom neutro)

Exemplo de pergunta:
"Quer ver o detalhamento ou comparar com outros períodos?"`,

    es: `## Formato de Salida

1. Usa **negrita** para énfasis (NO cursiva)
2. Usa H2 (##) para secciones principales
3. Usa puntos para listas
4. Usa tablas para comparaciones
5. Referencia documentos: {{DOC:::nombredearchivo.ext}}
6. SIN secciones ### Fuente
7. SIN emoji
8. Termina con UNA pregunta de seguimiento (tono neutral)

Ejemplo de pregunta:
"¿Quieres ver el desglose detallado o comparar con otros períodos?"`,
  };

  return instructions[lang] || instructions.en;
}

/**
 * Estimate tokens (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
