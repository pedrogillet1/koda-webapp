/**
 * ============================================================================
 * SPEED PROFILE MANAGER
 * ============================================================================
 *
 * Controls which services run based on speed profile.
 *
 * Speed profiles are switches that tell Koda what to SKIP:
 * - ULTRA_FAST: Skip RAG entirely
 * - FAST: Shallow RAG (no reranking, low topK)
 * - NORMAL: Normal RAG
 * - DEEP: Full RAG with all analysis tools
 *
 * ============================================================================
 */

import { SpeedProfile } from './kodaSkillTaxonomyExtended';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RAGPipelineConfig {
  // Retrieval
  useBM25: boolean;
  usePinecone: boolean;
  useHybridSearch: boolean;
  topK: number;
  candidateDocLimit: number;

  // Reranking
  useMicroSummaryReranking: boolean;
  useChunkTypeReranking: boolean;

  // Analysis
  useNumericExtraction: boolean;
  useEntityExtraction: boolean;
  useScenarioLogic: boolean;

  // Quality Assurance
  useGroundingVerification: boolean;
  useCitationVerification: boolean;
  useCompletenessCheck: boolean;
  useAnswerQualityChecker: boolean;

  // Generation
  maxTokens: number;
  temperature: number;

  // Timeouts
  retrievalTimeout: number; // ms
  generationTimeout: number; // ms
}

// ============================================================================
// SPEED PROFILE CONFIGS
// ============================================================================

const ULTRA_FAST_CONFIG: RAGPipelineConfig = {
  // No RAG at all
  useBM25: false,
  usePinecone: false,
  useHybridSearch: false,
  topK: 0,
  candidateDocLimit: 0,

  // No reranking
  useMicroSummaryReranking: false,
  useChunkTypeReranking: false,

  // No analysis
  useNumericExtraction: false,
  useEntityExtraction: false,
  useScenarioLogic: false,

  // No QA
  useGroundingVerification: false,
  useCitationVerification: false,
  useCompletenessCheck: false,
  useAnswerQualityChecker: false,

  // Minimal generation
  maxTokens: 250,
  temperature: 0.7,

  // Short timeouts
  retrievalTimeout: 500,
  generationTimeout: 2000,
};

const FAST_CONFIG: RAGPipelineConfig = {
  // Shallow retrieval
  useBM25: true,
  usePinecone: false,
  useHybridSearch: false,
  topK: 5,
  candidateDocLimit: 1, // Single document

  // No reranking
  useMicroSummaryReranking: false,
  useChunkTypeReranking: false,

  // No analysis
  useNumericExtraction: false,
  useEntityExtraction: false,
  useScenarioLogic: false,

  // Minimal QA
  useGroundingVerification: true, // Just check if answer is grounded
  useCitationVerification: false,
  useCompletenessCheck: false,
  useAnswerQualityChecker: false,

  // Short generation
  maxTokens: 400,
  temperature: 0.7,

  // Moderate timeouts
  retrievalTimeout: 1000,
  generationTimeout: 3000,
};

const NORMAL_CONFIG: RAGPipelineConfig = {
  // Normal retrieval
  useBM25: true,
  usePinecone: true,
  useHybridSearch: true,
  topK: 15,
  candidateDocLimit: 5,

  // Light reranking (only if precomputed)
  useMicroSummaryReranking: true,
  useChunkTypeReranking: true,

  // No heavy analysis
  useNumericExtraction: false,
  useEntityExtraction: false,
  useScenarioLogic: false,

  // Light QA
  useGroundingVerification: true,
  useCitationVerification: true,
  useCompletenessCheck: false, // Skip for normal
  useAnswerQualityChecker: false,

  // Normal generation
  maxTokens: 900,
  temperature: 0.7,

  // Normal timeouts
  retrievalTimeout: 2000,
  generationTimeout: 5000,
};

const DEEP_CONFIG: RAGPipelineConfig = {
  // Full retrieval
  useBM25: true,
  usePinecone: true,
  useHybridSearch: true,
  topK: 30,
  candidateDocLimit: 10,

  // Full reranking
  useMicroSummaryReranking: true,
  useChunkTypeReranking: true,

  // All analysis tools
  useNumericExtraction: true,
  useEntityExtraction: true,
  useScenarioLogic: true,

  // Full QA
  useGroundingVerification: true,
  useCitationVerification: true,
  useCompletenessCheck: true,
  useAnswerQualityChecker: true,

  // Long generation
  maxTokens: 1500,
  temperature: 0.7,

  // Long timeouts
  retrievalTimeout: 3000,
  generationTimeout: 8000,
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get RAG pipeline configuration for a speed profile
 *
 * @param speedProfile - Speed profile (ULTRA_FAST, FAST, NORMAL, DEEP)
 * @returns RAG pipeline configuration
 */
export function getRAGPipelineConfig(speedProfile: SpeedProfile): RAGPipelineConfig {
  switch (speedProfile) {
    case SpeedProfile.ULTRA_FAST:
      return { ...ULTRA_FAST_CONFIG };
    case SpeedProfile.FAST:
      return { ...FAST_CONFIG };
    case SpeedProfile.NORMAL:
      return { ...NORMAL_CONFIG };
    case SpeedProfile.DEEP:
      return { ...DEEP_CONFIG };
    default:
      return { ...NORMAL_CONFIG };
  }
}

/**
 * Override specific config values
 *
 * @param baseConfig - Base configuration
 * @param overrides - Partial overrides
 * @returns Merged configuration
 */
export function overrideConfig(
  baseConfig: RAGPipelineConfig,
  overrides: Partial<RAGPipelineConfig>
): RAGPipelineConfig {
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Get speed profile summary for logging
 *
 * @param speedProfile - Speed profile
 * @returns Human-readable summary
 */
export function getSpeedProfileSummary(speedProfile: SpeedProfile): string {
  const config = getRAGPipelineConfig(speedProfile);

  const enabledServices: string[] = [];
  if (config.useBM25) enabledServices.push('BM25');
  if (config.usePinecone) enabledServices.push('Pinecone');
  if (config.useHybridSearch) enabledServices.push('Hybrid');
  if (config.useMicroSummaryReranking) enabledServices.push('MicroSummary');
  if (config.useChunkTypeReranking) enabledServices.push('ChunkType');
  if (config.useNumericExtraction) enabledServices.push('NumericExtraction');
  if (config.useEntityExtraction) enabledServices.push('EntityExtraction');
  if (config.useScenarioLogic) enabledServices.push('ScenarioLogic');
  if (config.useGroundingVerification) enabledServices.push('Grounding');
  if (config.useCitationVerification) enabledServices.push('Citations');
  if (config.useCompletenessCheck) enabledServices.push('Completeness');
  if (config.useAnswerQualityChecker) enabledServices.push('QualityChecker');

  return `${speedProfile} (topK=${config.topK}, maxTokens=${config.maxTokens}, services=[${enabledServices.join(', ')}])`;
}

// ============================================================================
// SKILL-SPECIFIC OVERRIDES
// ============================================================================

/**
 * Apply skill-specific config overrides
 *
 * Some skills need specific configurations regardless of speed profile
 *
 * @param baseConfig - Base configuration from speed profile
 * @param skillId - Skill ID
 * @returns Adjusted configuration
 */
export function applySkillSpecificOverrides(
  baseConfig: RAGPipelineConfig,
  skillId: string
): RAGPipelineConfig {
  // Financial skills always need numeric extraction
  if (skillId.startsWith('FINANCIAL.')) {
    return overrideConfig(baseConfig, {
      useNumericExtraction: true,
    });
  }

  // Legal completeness checks always need completeness checker
  if (skillId === 'LEGAL.CHECK_COMPLETENESS_LEGAL' || skillId === 'LEGAL.CHECK_LGPD_COMPLIANCE') {
    return overrideConfig(baseConfig, {
      useCompletenessCheck: true,
    });
  }

  // Scenario analysis always needs scenario logic
  if (skillId === 'FINANCIAL.SCENARIO_ANALYSIS') {
    return overrideConfig(baseConfig, {
      useScenarioLogic: true,
      useNumericExtraction: true,
    });
  }

  // List documents never needs RAG
  if (skillId === 'GENERAL.LIST_DOCUMENTS' || skillId === 'META.GREETING' || skillId === 'META.HELP') {
    return overrideConfig(baseConfig, {
      useBM25: false,
      usePinecone: false,
      useHybridSearch: false,
      topK: 0,
    });
  }

  // No overrides needed
  return baseConfig;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const speedProfileManager = {
  getRAGPipelineConfig,
  overrideConfig,
  getSpeedProfileSummary,
  applySkillSpecificOverrides,
};

export default speedProfileManager;
