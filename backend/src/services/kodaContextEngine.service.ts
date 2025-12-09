/**
 * ============================================================================
 * KODA CONTEXT ENGINE - UNIFIED CONTEXT BUILDING & OPTIMIZATION
 * ============================================================================
 *
 * This service consolidates ALL context engineering logic.
 *
 * CONSOLIDATES:
 * - contextEngineering.service.ts
 * - contextCompression.service.ts
 * - metadataEnrichment.service.ts
 * - conversationContinuity.service.ts
 *
 * RESPONSIBILITIES:
 * 1. Build optimized context windows
 * 2. Inject persona and tone
 * 3. Include conversation memory
 * 4. Include retrieved chunks
 * 5. Ensure logical flow
 * 6. Optimize for token budget
 * 7. Inject domain skill packs
 *
 * @version 2.1.0 - Added domain skill pack integration
 * @date 2025-12-09
 */

// Domain Skill Pack Integration
import { detectDomainFromQuery, detectDomainCombined, Domain, getDomainDisclaimer } from './domainDetector.service';
import { getSkillPack } from './skillPackLoader.service';
import { buildCompleteReasoningSection, getDomainValidationRules } from './domainReasoningTemplates.service';

export interface ContextBuildOptions {
  query: string;
  retrievedChunks: any[];
  conversationHistory: any[];
  entities: Record<string, string>;
  skill: string;
  language: string;
  maxTokens?: number;
  documentMetadata?: {
    fileType?: string;
    content?: string;
  };
}

export interface BuiltContext {
  prompt: string;
  tokenCount: number;
  includedChunks: number;
  includedHistory: number;
  detectedDomain?: Domain;
}

/**
 * Build the final context to send to the LLM
 */
export async function buildContext(options: ContextBuildOptions): Promise<BuiltContext> {
  const {
    query,
    retrievedChunks,
    conversationHistory,
    entities,
    skill,
    language,
    maxTokens = 30000,
    documentMetadata,
  } = options;

  let prompt = '';
  let tokenCount = 0;

  // 0. Detect domain from query and document content
  const domain = detectDomain(query, retrievedChunks, documentMetadata);
  console.log(`[CONTEXT ENGINE] Detected domain: ${domain}`);

  // 1. System prompt (persona + tone + domain specialization)
  const systemPrompt = getSystemPrompt(skill, language, domain);
  prompt += systemPrompt + '\n\n';
  tokenCount += estimateTokens(systemPrompt);

  // 2. Domain skill pack (if domain is specialized)
  if (domain !== 'general') {
    const domainSection = buildDomainSkillSection(domain, language);
    if (domainSection) {
      prompt += domainSection + '\n\n';
      tokenCount += estimateTokens(domainSection);
      console.log(`[CONTEXT ENGINE] Injected ${domain} skill pack (${estimateTokens(domainSection)} tokens)`);
    }
  }

  // 3. Conversation memory (last 5 messages)
  const recentHistory = conversationHistory.slice(-5);
  if (recentHistory.length > 0) {
    const historyHeader = language.startsWith('pt') ? '## Histórico da Conversa' :
                          language.startsWith('es') ? '## Historial de Conversación' :
                          '## Conversation History';
    prompt += historyHeader + '\n\n';
    for (const msg of recentHistory) {
      const line = `${msg.role}: ${msg.content}\n`;
      prompt += line;
      tokenCount += estimateTokens(line);
    }
    prompt += '\n';
  }

  // 4. Entity bindings (pronoun resolution)
  if (Object.keys(entities).length > 0) {
    const entitiesHeader = language.startsWith('pt') ? '## Contexto de Referências' :
                           language.startsWith('es') ? '## Contexto de Referencias' :
                           '## Reference Context';
    prompt += entitiesHeader + '\n\n';
    for (const [key, value] of Object.entries(entities)) {
      const line = `- "${key}" → ${value}\n`;
      prompt += line;
      tokenCount += estimateTokens(line);
    }
    prompt += '\n';
  }

  // 5. Retrieved chunks (with token budget)
  let includedChunks = 0;
  if (retrievedChunks.length > 0) {
    const chunksHeader = language.startsWith('pt') ? '## Contexto dos Documentos' :
                         language.startsWith('es') ? '## Contexto de Documentos' :
                         '## Document Context';
    prompt += chunksHeader + '\n\n';
    for (const chunk of retrievedChunks) {
      const docName = chunk.documentName || chunk.fileName || chunk.filename || 'Document';
      const content = chunk.content || chunk.text || '';
      const chunkText = `### ${docName}\n${content}\n\n`;
      const chunkTokens = estimateTokens(chunkText);

      if (tokenCount + chunkTokens > maxTokens - 1000) break; // Reserve 1000 tokens for query + response

      prompt += chunkText;
      tokenCount += chunkTokens;
      includedChunks++;
    }
  }

  // 6. Domain-specific instructions (reasoning template)
  if (domain !== 'general') {
    const reasoningSection = buildDomainReasoningInstructions(domain, language);
    if (reasoningSection) {
      prompt += reasoningSection + '\n\n';
      tokenCount += estimateTokens(reasoningSection);
    }
  }

  // 7. User query
  const queryHeader = language.startsWith('pt') ? '## Pergunta do Usuário' :
                      language.startsWith('es') ? '## Pregunta del Usuario' :
                      '## User Question';
  prompt += `${queryHeader}\n\n${query}\n`;
  tokenCount += estimateTokens(query);

  // 8. Domain disclaimer reminder (for sensitive domains)
  if (['medical', 'legal', 'financial'].includes(domain)) {
    const disclaimer = getDomainDisclaimer(domain);
    if (disclaimer) {
      const reminderHeader = language.startsWith('pt') ? '\n\n**IMPORTANTE:**' :
                             language.startsWith('es') ? '\n\n**IMPORTANTE:**' :
                             '\n\n**IMPORTANT:**';
      prompt += `${reminderHeader} ${disclaimer}`;
      tokenCount += estimateTokens(disclaimer);
    }
  }

  return {
    prompt,
    tokenCount,
    includedChunks,
    includedHistory: recentHistory.length,
    detectedDomain: domain,
  };
}

/**
 * Detect domain from query and document content
 */
function detectDomain(
  query: string,
  retrievedChunks: any[],
  documentMetadata?: { fileType?: string; content?: string }
): Domain {
  // Extract document names from chunks for combined detection
  const documentNames = retrievedChunks
    .map(c => c.documentName || c.fileName || c.filename || '')
    .filter((name): name is string => !!name);

  // Extract document types if available
  const documentTypes = retrievedChunks
    .map(c => c.mimeType || c.fileType || '')
    .filter((type): type is string => !!type);

  if (documentNames.length > 0) {
    const combinedResult = detectDomainCombined(query, documentNames, documentTypes);
    if (combinedResult.domain !== 'general' && combinedResult.confidence > 0.5) {
      return combinedResult.domain;
    }
  }

  // Fallback to query-only detection
  const queryResult = detectDomainFromQuery(query);
  return queryResult.domain;
}

/**
 * Build domain skill pack section for prompt
 */
function buildDomainSkillSection(domain: Domain, language: string): string | null {
  if (domain === 'general') return null;

  const skillPack = getSkillPack(domain);
  if (!skillPack.loaded || !skillPack.content) return null;

  const langKey = language.startsWith('pt') ? 'pt' : language.startsWith('es') ? 'es' : 'en';

  const headers: Record<string, string> = {
    'pt': `## Conhecimento Especializado: ${domain.toUpperCase()}`,
    'es': `## Conocimiento Especializado: ${domain.toUpperCase()}`,
    'en': `## Specialized Knowledge: ${domain.toUpperCase()}`,
  };

  return `${headers[langKey]}\n\n${skillPack.content}`;
}

/**
 * Build domain-specific reasoning instructions
 */
function buildDomainReasoningInstructions(domain: Domain, language: string): string | null {
  if (domain === 'general') return null;

  const rules = getDomainValidationRules(domain);
  if (rules.length === 0) return null;

  const langKey = language.startsWith('pt') ? 'pt' : language.startsWith('es') ? 'es' : 'en';

  const headers: Record<string, string> = {
    'pt': '## Instruções de Resposta',
    'es': '## Instrucciones de Respuesta',
    'en': '## Response Instructions',
  };

  let section = `${headers[langKey]}\n\n`;

  for (const rule of rules) {
    section += `- ${rule}\n`;
  }

  return section;
}

function getSystemPrompt(skill: string, language: string, domain: Domain = 'general'): string {
  const langKey = language.startsWith('pt') ? 'pt' : language.startsWith('es') ? 'es' : 'en';

  // Language-specific persona prompts with STRICT rules
  const personaPrompts: Record<string, string> = {
    'pt': `Você é Koda, um assistente inteligente de documentos.

REGRAS ABSOLUTAS:
1. SEMPRE responda em português brasileiro
2. NUNCA use inglês, mesmo que o contexto esteja em inglês
3. SEMPRE extraia informações reais dos documentos fornecidos
4. NUNCA invente ou adivinhe informações - se não encontrar, diga claramente
5. SEMPRE cite o documento de onde veio a informação
6. Use formatação rica: **negrito** para termos importantes, listas numeradas, tabelas quando apropriado
7. Seja direto e objetivo - não faça introduções longas

Seu objetivo é ajudar o usuário a entender e analisar seus documentos de forma clara e objetiva.`,

    'en': `You are Koda, an intelligent document assistant.

ABSOLUTE RULES:
1. ALWAYS respond in English
2. NEVER use other languages, even if the context is in another language
3. ALWAYS extract real information from the provided documents
4. NEVER invent or guess information - if not found, say clearly
5. ALWAYS cite the document where the information came from
6. Use rich formatting: **bold** for important terms, numbered lists, tables when appropriate
7. Be direct and objective - don't make long introductions

Your goal is to help the user understand and analyze their documents clearly and objectively.`,

    'es': `Eres Koda, un asistente inteligente de documentos.

REGLAS ABSOLUTAS:
1. SIEMPRE responde en español
2. NUNCA uses otro idioma, incluso si el contexto está en otro idioma
3. SIEMPRE extrae información real de los documentos proporcionados
4. NUNCA inventes o adivines información - si no la encuentras, dilo claramente
5. SIEMPRE cita el documento de donde proviene la información
6. Usa formato enriquecido: **negrita** para términos importantes, listas numeradas, tablas cuando sea apropiado
7. Sé directo y objetivo - no hagas introducciones largas

Tu objetivo es ayudar al usuario a comprender y analizar sus documentos de manera clara y objetiva.`,
  };

  // Domain-specific additions
  const domainAdditions: Record<Domain, Record<string, string>> = {
    finance: {
      'pt': '\n\nEspecialização: Análise financeira. Mostre cálculos passo a passo, cite fórmulas, compare cenários. Forneça números precisos e métricas.',
      'en': '\n\nSpecialization: Financial analysis. Show step-by-step calculations, cite formulas, compare scenarios. Provide precise numbers and metrics.',
      'es': '\n\nEspecialización: Análisis financiero. Muestra cálculos paso a paso, cita fórmulas, compara escenarios. Proporciona números precisos y métricas.',
    },
    accounting: {
      'pt': '\n\nEspecialização: Contabilidade. Mostre fórmulas de índices, identifique valores do balanço, calcule indicadores. Seja preciso com números.',
      'en': '\n\nSpecialization: Accounting. Show ratio formulas, identify balance sheet values, calculate indicators. Be precise with numbers.',
      'es': '\n\nEspecialización: Contabilidad. Muestra fórmulas de índices, identifica valores del balance, calcula indicadores. Sé preciso con números.',
    },
    legal: {
      'pt': '\n\nEspecialização: Análise legal. Cite cláusulas exatas, use aspas para texto literal, inclua disclaimer obrigatório. NUNCA forneça aconselhamento jurídico.',
      'en': '\n\nSpecialization: Legal analysis. Quote exact clauses, use quotes for literal text, include mandatory disclaimer. NEVER provide legal advice.',
      'es': '\n\nEspecialización: Análisis legal. Cita cláusulas exactas, usa comillas para texto literal, incluye descargo obligatorio. NUNCA proporciones asesoramiento jurídico.',
    },
    medical: {
      'pt': '\n\nEspecialização: Análise médica. Compare valores com referências, separe normal de alterado, explique em linguagem simples. NUNCA diagnostique ou recomende tratamentos.',
      'en': '\n\nSpecialization: Medical analysis. Compare values with references, separate normal from abnormal, explain in simple language. NEVER diagnose or recommend treatments.',
      'es': '\n\nEspecialización: Análisis médico. Compara valores con referencias, separa normal de alterado, explica en lenguaje simple. NUNCA diagnostiques ni recomiendes tratamientos.',
    },
    education: {
      'pt': '\n\nEspecialização: Educação. Forneça feedback construtivo, identifique pontos fortes antes de sugerir melhorias, guie sem fazer o trabalho.',
      'en': '\n\nSpecialization: Education. Provide constructive feedback, identify strengths before suggesting improvements, guide without doing the work.',
      'es': '\n\nEspecialización: Educación. Proporciona retroalimentación constructiva, identifica fortalezas antes de sugerir mejoras, guía sin hacer el trabajo.',
    },
    research: {
      'pt': '\n\nEspecialização: Pesquisa acadêmica. Resuma metodologia e resultados, diferencie correlação de causalidade, mencione limitações do estudo.',
      'en': '\n\nSpecialization: Academic research. Summarize methodology and results, differentiate correlation from causation, mention study limitations.',
      'es': '\n\nEspecialización: Investigación académica. Resume metodología y resultados, diferencia correlación de causalidad, menciona limitaciones del estudio.',
    },
    general: {
      'pt': '',
      'en': '',
      'es': '',
    },
  };

  // Skill-specific additions (legacy compatibility)
  const skillAdditions: Record<string, Record<string, string>> = {
    FINANCIAL_ANALYSIS: domainAdditions.finance,
    financial_analysis: domainAdditions.finance,
    LEGAL_ANALYSIS: domainAdditions.legal,
    legal_analysis: domainAdditions.legal,
    MEDICAL_ANALYSIS: domainAdditions.medical,
    medical_analysis: domainAdditions.medical,
  };

  let prompt = personaPrompts[langKey] || personaPrompts['pt'];

  // Add domain specialization
  if (domainAdditions[domain]?.[langKey]) {
    prompt += domainAdditions[domain][langKey];
  }
  // Fallback to skill-based addition
  else if (skillAdditions[skill]?.[langKey]) {
    prompt += skillAdditions[skill][langKey];
  }

  // Add language enforcement at the end
  const languageEnforcement: Record<string, string> = {
    'pt': '\n\n**IMPORTANTE: Responda SOMENTE em português brasileiro. Não use inglês ou outro idioma.**',
    'en': '\n\n**IMPORTANT: Respond ONLY in English. Do not use Portuguese or any other language.**',
    'es': '\n\n**IMPORTANTE: Responde SOLO en español. No uses portugués ni ningún otro idioma.**',
  };

  prompt += languageEnforcement[langKey] || languageEnforcement['pt'];

  return prompt;
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

export default {
  buildContext,
};
