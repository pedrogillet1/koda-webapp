/**
 * SKILL SYSTEM INTEGRATION SERVICE
 *
 * Bridges the new skill-based routing system with the existing RAG modes.
 * This adapter maps skill speed profiles to RAG mode configurations.
 *
 * Usage:
 *   import { integrateSkillRouting } from './skillSystemIntegration.service';
 *   const skillResult = await integrateSkillRouting(query, userId, userDocumentCount);
 *   // Use skillResult.ragMode for existing mode-based logic
 *   // Use skillResult.skillMapping for skill-aware answer generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { skillAndIntentRouter, type SkillMapping, type RouterContext } from './skillAndIntentRouter.service';
import { speedProfileManager, type RAGPipelineConfig } from './speedProfileManager.service';
// DEPRECATED: answerPostProcessor moved to _deprecated - using stub
import { answerPostProcessor, type PostProcessResult } from './deletedServiceStubs';
import { SpeedProfile } from './kodaSkillTaxonomyExtended';
import type { RAGMode } from './ragModes.service';

// Initialize Gemini client for LLM fallback classification
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// TYPES
// ============================================================================

export interface SkillIntegrationResult {
  skillMapping: SkillMapping;
  ragMode: RAGMode;
  ragPipelineConfig: RAGPipelineConfig;
  shouldBypassRAG: boolean;
  routingReason: string;
}

export interface PostProcessedAnswer {
  answer: string;
  changes: string[];
  warnings: string[];
  skillId: string;
  speedProfile: string;
}

// ============================================================================
// SPEED PROFILE TO RAG MODE MAPPING
// ============================================================================

const SPEED_PROFILE_TO_RAG_MODE: Record<SpeedProfile, RAGMode> = {
  [SpeedProfile.ULTRA_FAST]: 'ULTRA_FAST_META',
  [SpeedProfile.FAST]: 'FAST_FACT_RAG',
  [SpeedProfile.NORMAL]: 'NORMAL_RAG',
  [SpeedProfile.DEEP]: 'DEEP_ANALYSIS',
};

// ============================================================================
// MAIN INTEGRATION FUNCTION
// ============================================================================

/**
 * Route a query through the skill system and return RAG mode configuration.
 * This is the main entry point for skill-based routing.
 *
 * @param query - User's query
 * @param userId - User ID for context
 * @param userDocumentCount - Number of documents the user has (for LIST_DOCUMENTS skill)
 * @param conversationHistory - Optional conversation history for pronoun resolution
 * @returns Skill mapping and RAG mode configuration
 */
export async function integrateSkillRouting(
  query: string,
  userId: string,
  userDocumentCount: number = 0,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<SkillIntegrationResult> {
  const startTime = Date.now();

  // 1. Build router context
  const routerContext: RouterContext = {
    query,
    userDocumentCount,
    conversationHistory,
  };

  // 2. Route query to skill (rule-based first, then LLM fallback if needed)
  const skillMapping = await skillAndIntentRouter.routeQueryToSkill(routerContext, genAI);

  // 3. Map speed profile to RAG mode
  const ragMode = SPEED_PROFILE_TO_RAG_MODE[skillMapping.speedProfile as SpeedProfile] || 'NORMAL_RAG';

  // 4. Get RAG pipeline configuration based on speed profile
  let ragPipelineConfig = speedProfileManager.getRAGPipelineConfig(skillMapping.speedProfile as SpeedProfile);

  // 5. Apply skill-specific overrides
  ragPipelineConfig = speedProfileManager.applySkillSpecificOverrides(ragPipelineConfig, skillMapping.skillId);

  // 6. Determine if we should bypass RAG entirely
  const shouldBypassRAG = skillMapping.speedProfile === SpeedProfile.ULTRA_FAST ||
                          skillMapping.skillId === 'META.GREETING' ||
                          skillMapping.skillId === 'META.HELP' ||
                          skillMapping.skillId === 'GENERAL.LIST_DOCUMENTS';

  const routingTime = Date.now() - startTime;

  console.log(`[SkillIntegration] Skill: ${skillMapping.skillId} | Mode: ${ragMode} | Bypass: ${shouldBypassRAG} | ${routingTime}ms`);

  return {
    skillMapping,
    ragMode,
    ragPipelineConfig,
    shouldBypassRAG,
    routingReason: `Routed via ${skillMapping.detectionMethod}: ${skillMapping.skillName} (${skillMapping.confidence.toFixed(2)} confidence)`,
  };
}

// ============================================================================
// POST-PROCESSING INTEGRATION
// ============================================================================

/**
 * Post-process an answer using the skill-aware post-processor.
 * Applies identity normalization, deduplication, and quality checks.
 *
 * @param answer - Raw answer from LLM
 * @param skillMapping - Skill mapping from routing
 * @returns Post-processed answer with changes and warnings
 */
export async function postProcessSkillAnswer(
  answer: string,
  skillMapping: SkillMapping
): Promise<PostProcessedAnswer> {
  const result = await answerPostProcessor.postProcessAnswer(answer, skillMapping.skillId);

  return {
    answer: result.answer,
    changes: result.changes,
    warnings: result.warnings,
    skillId: skillMapping.skillId,
    speedProfile: skillMapping.speedProfile,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a skill requires financial analysis mode.
 * Used to trigger DEEP_FINANCIAL_ANALYSIS in existing system.
 */
export function requiresFinancialAnalysis(skillId: string): boolean {
  return skillId.startsWith('FINANCIAL.');
}

/**
 * Check if a skill is a META skill (greetings, help, etc.)
 * Used for ultra-fast response handling.
 */
export function isMetaSkill(skillId: string): boolean {
  return skillId.startsWith('META.');
}

/**
 * Check if a skill requires document context.
 * Used to determine if RAG retrieval is needed.
 */
export function requiresDocumentContext(skillId: string): boolean {
  const noDocumentSkills = ['META.GREETING', 'META.HELP', 'META.UNKNOWN'];
  return !noDocumentSkills.includes(skillId);
}

/**
 * Get a human-readable description of the skill routing decision.
 * Useful for logging and debugging.
 */
export function describeSkillRouting(result: SkillIntegrationResult): string {
  const { skillMapping, ragMode, shouldBypassRAG } = result;

  return [
    `Skill: ${skillMapping.skillName} (${skillMapping.skillId})`,
    `Domain: ${skillMapping.domain}`,
    `Mode: ${skillMapping.mode}`,
    `Complexity: ${skillMapping.complexity}`,
    `Speed Profile: ${skillMapping.speedProfile} → RAG Mode: ${ragMode}`,
    `Detection: ${skillMapping.detectionMethod} (${(skillMapping.confidence * 100).toFixed(0)}% confidence)`,
    `Bypass RAG: ${shouldBypassRAG ? 'Yes' : 'No'}`,
  ].join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export const skillSystemIntegration = {
  integrateSkillRouting,
  postProcessSkillAnswer,
  requiresFinancialAnalysis,
  isMetaSkill,
  requiresDocumentContext,
  describeSkillRouting,
};

export default skillSystemIntegration;
