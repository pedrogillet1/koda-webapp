/**
 * ============================================================================
 * SKILL AND INTENT ROUTER
 * ============================================================================
 *
 * Central router that maps queries to skills using:
 * 1. Rule-based classification (fast, 0ms network)
 * 2. LLM fallback classification (only when needed, ~100-200ms)
 *
 * Returns SkillMapping with all metadata needed for RAG pipeline.
 *
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SkillConfig,
  SkillDomain,
  SkillMode,
  SkillComplexity,
  SpeedProfile,
  EXTENDED_SKILL_REGISTRY,
  getSkillConfig,
} from './kodaSkillTaxonomyExtended';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SkillMapping {
  skillId: string;
  skillName: string;
  domain: SkillDomain;
  mode: SkillMode;
  complexity: SkillComplexity;
  speedProfile: SpeedProfile;
  skillConfig: SkillConfig;
  confidence: number; // 0-1
  detectionMethod: 'rule-based' | 'llm-fallback';
}

export interface RouterContext {
  query: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  userDocumentCount: number;
  currentDocumentContext?: {
    documentId?: string;
    documentName?: string;
    documentType?: string;
  };
}

// ============================================================================
// RULE-BASED CLASSIFIER
// ============================================================================

/**
 * Fast rule-based classification using regex patterns
 * Returns SkillMapping if confident, null otherwise
 */
function ruleBasedClassification(context: RouterContext): SkillMapping | null {
  const { query, userDocumentCount } = context;
  const queryLower = query.toLowerCase().trim();

  // Try to match against all skill patterns
  for (const [skillId, skillConfig] of Object.entries(EXTENDED_SKILL_REGISTRY)) {
    for (const pattern of skillConfig.patterns) {
      if (pattern.test(query)) {
        // Found a match!
        return {
          skillId,
          skillName: skillConfig.skillName,
          domain: skillConfig.domain,
          mode: skillConfig.mode,
          complexity: skillConfig.depthDefault,
          speedProfile: skillConfig.speedProfile,
          skillConfig,
          confidence: 0.9,
          detectionMethod: 'rule-based',
        };
      }
    }
  }

  // Special cases for meta queries
  if (userDocumentCount === 0) {
    // User has no documents - route to META mode
    if (
      /\b(upload|fazer\s+upload|subir|adicionar)\s+(documento|arquivo)/i.test(query) ||
      /\bo\s+que\s+(você|vc)\s+(faz|pode\s+fazer)/i.test(query) ||
      /\b(help|ajuda|como\s+funciona)/i.test(query)
    ) {
      const metaSkill = EXTENDED_SKILL_REGISTRY['GENERAL.LIST_DOCUMENTS'];
      return {
        skillId: 'META.HELP',
        skillName: 'Help (No Documents)',
        domain: SkillDomain.GENERAL,
        mode: SkillMode.META,
        complexity: SkillComplexity.LIGHT,
        speedProfile: SpeedProfile.ULTRA_FAST,
        skillConfig: metaSkill,
        confidence: 0.95,
        detectionMethod: 'rule-based',
      };
    }
  }

  // Greetings
  if (/^(oi|olá|ola|hi|hello|hey|bom\s+dia|boa\s+tarde|boa\s+noite)[\s!?.]*$/i.test(queryLower)) {
    const metaSkill = EXTENDED_SKILL_REGISTRY['GENERAL.LIST_DOCUMENTS'];
    return {
      skillId: 'META.GREETING',
      skillName: 'Greeting',
      domain: SkillDomain.GENERAL,
      mode: SkillMode.META,
      complexity: SkillComplexity.LIGHT,
      speedProfile: SpeedProfile.ULTRA_FAST,
      skillConfig: metaSkill,
      confidence: 1.0,
      detectionMethod: 'rule-based',
    };
  }

  // No confident match
  return null;
}

// ============================================================================
// LLM FALLBACK CLASSIFIER
// ============================================================================

/**
 * LLM-based classification for ambiguous queries
 * Uses a short, fast Gemini Flash call
 */
async function llmFallbackClassification(
  context: RouterContext,
  genAI: GoogleGenerativeAI
): Promise<SkillMapping> {
  const { query, conversationHistory, userDocumentCount } = context;

  // Build a concise prompt
  const prompt = `You are a query classifier for Koda, a document assistant.

User query: "${query}"

User has ${userDocumentCount} documents.

${conversationHistory && conversationHistory.length > 0 ? `Recent conversation:\n${conversationHistory.slice(-3).map((msg) => `${msg.role}: ${msg.content}`).join('\n')}\n` : ''}

Classify this query into ONE of these skills:

**GENERAL:**
- LIST_DOCUMENTS: listing/counting documents
- EXPLAIN_SECTION: explaining a section/clause
- SUMMARIZE_DOCUMENT: summarizing a document
- FIND_WHERE_IT_SAYS_X: finding where something is mentioned
- COMPARE_TWO_SECTIONS: comparing sections/documents
- CHECK_MISSING_PIECES: checking completeness

**LEGAL:**
- EXPLAIN_CLAUSE: explaining legal clauses
- SCAN_FOR_RISKS: identifying legal risks
- CHECK_COMPLETENESS_LEGAL: checking if contract is complete
- CHECK_LGPD_COMPLIANCE: checking LGPD compliance

**FINANCIAL:**
- CHECK_CALCULATIONS: verifying calculations
- SCENARIO_ANALYSIS: analyzing scenarios (best/worst case)
- EXPLAIN_MODEL: explaining financial models
- CHECK_SANITY_NUMBERS: checking if numbers make sense

**Respond with JSON:**
{
  "skillId": "DOMAIN.SKILL_NAME",
  "domain": "GENERAL|LEGAL|FINANCIAL",
  "mode": "META|DOC_FACT|DOC_EXPLAIN|DOC_ANALYSIS",
  "complexity": "LIGHT|NORMAL|DEEP"
}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const classification = JSON.parse(jsonMatch[0]);

    // Get skill config
    const skillConfig = getSkillConfig(classification.skillId);
    if (!skillConfig) {
      throw new Error(`Unknown skill ID: ${classification.skillId}`);
    }

    // Determine speed profile based on complexity
    let speedProfile = skillConfig.speedProfile;
    if (classification.complexity === 'LIGHT') {
      speedProfile = SpeedProfile.FAST;
    } else if (classification.complexity === 'DEEP') {
      speedProfile = SpeedProfile.DEEP;
    }

    return {
      skillId: classification.skillId,
      skillName: skillConfig.skillName,
      domain: classification.domain as SkillDomain,
      mode: classification.mode as SkillMode,
      complexity: classification.complexity as SkillComplexity,
      speedProfile,
      skillConfig,
      confidence: 0.7,
      detectionMethod: 'llm-fallback',
    };
  } catch (error) {
    console.error('[SkillRouter] LLM fallback classification failed:', error);

    // Fallback to a safe default
    const defaultSkill = EXTENDED_SKILL_REGISTRY['GENERAL.EXPLAIN_SECTION'];
    return {
      skillId: 'GENERAL.EXPLAIN_SECTION',
      skillName: defaultSkill.skillName,
      domain: SkillDomain.GENERAL,
      mode: SkillMode.DOC_EXPLAIN,
      complexity: SkillComplexity.NORMAL,
      speedProfile: SpeedProfile.NORMAL,
      skillConfig: defaultSkill,
      confidence: 0.5,
      detectionMethod: 'llm-fallback',
    };
  }
}

// ============================================================================
// MAIN ROUTER FUNCTION
// ============================================================================

/**
 * Route a query to the appropriate skill
 *
 * @param context - Router context with query and metadata
 * @param genAI - Google Generative AI instance (for LLM fallback)
 * @returns SkillMapping with all metadata for RAG pipeline
 */
export async function routeQueryToSkill(
  context: RouterContext,
  genAI: GoogleGenerativeAI
): Promise<SkillMapping> {
  // Step 1: Try rule-based classification (fast)
  const ruleBasedResult = ruleBasedClassification(context);
  if (ruleBasedResult && ruleBasedResult.confidence >= 0.8) {
    console.log(
      `[SkillRouter] Rule-based match: ${ruleBasedResult.skillId} (confidence: ${ruleBasedResult.confidence})`
    );
    return ruleBasedResult;
  }

  // Step 2: Fallback to LLM classification
  console.log('[SkillRouter] No confident rule-based match, using LLM fallback...');
  const llmResult = await llmFallbackClassification(context, genAI);
  console.log(
    `[SkillRouter] LLM fallback match: ${llmResult.skillId} (confidence: ${llmResult.confidence})`
  );
  return llmResult;
}

// ============================================================================
// COMPLEXITY ADJUSTMENT
// ============================================================================

/**
 * Adjust complexity based on query characteristics
 *
 * @param skillMapping - Initial skill mapping
 * @param query - User query
 * @returns Adjusted skill mapping
 */
export function adjustComplexity(skillMapping: SkillMapping, query: string): SkillMapping {
  // Increase complexity if query has complexity signals
  if (
    /\b(detalhad(o|a)|profund(o|a)|completo|deep|detailed|comprehensive)\b/i.test(query) ||
    /\b(todos?|all|every|cada)\b/i.test(query) ||
    query.length > 200
  ) {
    return {
      ...skillMapping,
      complexity: SkillComplexity.DEEP,
      speedProfile: SpeedProfile.DEEP,
    };
  }

  // Decrease complexity if query has simplicity signals
  if (
    /\b(rápid(o|a)|quick|brief|resumid(o|a)|curto)\b/i.test(query) ||
    /\b(só|apenas|just|only)\b/i.test(query) ||
    query.length < 50
  ) {
    return {
      ...skillMapping,
      complexity: SkillComplexity.LIGHT,
      speedProfile: SpeedProfile.FAST,
    };
  }

  // Keep original complexity
  return skillMapping;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const skillAndIntentRouter = {
  routeQueryToSkill,
  adjustComplexity,
  ruleBasedClassification,
};

export default skillAndIntentRouter;
