/**
 * PromptConfigService
 *
 * Single service that loads all LLM-related JSON once at startup.
 * Provides typed getters for AnswerEngine, Formatting, Validation, and Retrieval.
 *
 * GUARANTEES:
 * - All JSON loaded once at startup (never per-request)
 * - Schema validation (fail fast on boot)
 * - No default fallbacks unless config missing
 * - Hard-wired into AnswerEngine/Retrieval/Validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveDataDir, assertDataFilesExist, REQUIRED_PROMPT_CONFIG_FILES } from './resolveDataDir';

// ============================================================================
// TYPES
// ============================================================================

export type LanguageCode = 'en' | 'pt' | 'es';

export interface SystemPromptEntry {
  mode: string;
  description: string;
  languages: {
    [lang in LanguageCode]?: {
      systemPrompt: string;
      constraints?: string[];
      examples?: any[];
      citationRules?: string;
    };
  };
}

export interface SystemPromptsConfig {
  version: string;
  lastUpdated: string;
  prompts: SystemPromptEntry[];
}

export interface AnswerStylesConfig {
  [intentKey: string]: {
    [questionType: string]: {
      [lang in LanguageCode]?: {
        structure?: string;
        tone?: string;
        verbosity?: string;
        formatting?: string[];
      };
    };
  };
}

export interface AnswerExamplesConfig {
  [intentKey: string]: {
    [lang in LanguageCode]?: any;
  };
}

export interface MarkdownComponentsConfig {
  version: string;
  components: {
    [componentKey: string]: {
      [lang in LanguageCode]?: string;
    };
  };
}

export interface TablePresetsConfig {
  version: string;
  presets: {
    [presetKey: string]: {
      columns: string[];
      formatting: {
        alignment?: string[];
        width?: string[];
      };
      style?: string;
    };
  };
}

export interface ValidationPolicyEntry {
  category: string;
  name: string;
  description: string;
  rules: {
    [ruleKey: string]: any;
  };
}

export interface ValidationPoliciesConfig {
  version: string;
  policies: ValidationPolicyEntry[];
}

export interface RetrievalPolicyEntry {
  intentType: string;
  questionType?: string;
  retrieval: {
    vectorTopK: number;
    bm25TopK: number;
    mergeWeights: {
      vector: number;
      bm25: number;
    };
    minScore: number;
    diversity?: boolean;
  };
  chunking?: {
    maxChunks: number;
    minChunks?: number;
  };
  filtering?: {
    requireExactMatch?: boolean;
    boostRecentDocs?: boolean;
  };
}

export interface RetrievalPoliciesConfig {
  version: string;
  policies: RetrievalPolicyEntry[];
}

export interface ErrorLocalizationConfig {
  [errorKey: string]: {
    [lang in LanguageCode]?: string;
  };
}

export interface LanguageProfilesConfig {
  [lang: string]: {
    name: string;
    nativeName: string;
    variants?: string[];
  };
}

export interface DebugLabelsConfig {
  [labelKey: string]: string;
}

/**
 * Complete bundle of all prompt configurations
 */
export interface PromptConfigBundle {
  systemPrompts: SystemPromptsConfig;
  answerStyles: AnswerStylesConfig;
  answerExamples: AnswerExamplesConfig;
  markdownComponents: MarkdownComponentsConfig;
  tablePresets: TablePresetsConfig;
  validationPolicies: ValidationPoliciesConfig;
  retrievalPolicies: RetrievalPoliciesConfig;
  errorLocalization: ErrorLocalizationConfig;
  languageProfiles?: LanguageProfilesConfig;
  debugLabels?: DebugLabelsConfig;
}

/**
 * Resolved answer style
 */
export interface AnswerStyleResolved {
  structure?: string;
  tone?: string;
  verbosity?: string;
  formatting?: string[];
}

/**
 * Few-shot example
 */
export interface FewShotExample {
  query: string;
  answer: string;
  context?: string;
}

/**
 * Validation policy
 */
export interface ValidationPolicy {
  category: string;
  name: string;
  description: string;
  rules: Record<string, any>;
}

/**
 * Retrieval policy
 */
export interface RetrievalPolicy {
  intentType: string;
  questionType?: string;
  retrieval: {
    vectorTopK: number;
    bm25TopK: number;
    mergeWeights: {
      vector: number;
      bm25: number;
    };
    minScore: number;
    diversity?: boolean;
  };
  chunking?: {
    maxChunks: number;
    minChunks?: number;
  };
  filtering?: {
    requireExactMatch?: boolean;
    boostRecentDocs?: boolean;
  };
}

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

export interface LoggerLike {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug?(message: string, ...args: any[]): void;
}

// ============================================================================
// PROMPT CONFIG SERVICE
// ============================================================================

export class PromptConfigService {
  private bundle: PromptConfigBundle | null = null;
  private dataDir: string;
  private env: 'dev' | 'prod' | 'test';
  private logger: LoggerLike;
  private loadedAt: number = 0;
  private fileMetadata: Array<{ name: string; bytes: number; sha256?: string }> = [];

  constructor(opts: {
    dataDir?: string;
    env: 'dev' | 'prod' | 'test';
    logger?: LoggerLike;
    enableHotReload?: boolean;
  }) {
    this.dataDir = opts.dataDir || resolveDataDir();
    this.env = opts.env;
    this.logger = opts.logger || console;

    if (opts.enableHotReload) {
      this.logger.warn('[PromptConfig] Hot reload requested but not implemented in MVP');
    }
  }

  /**
   * Initialize: Load and validate all JSON files
   * MUST be called once at startup before any requests
   */
  public init(): void {
    const startTime = Date.now();
    this.logger.info(`[PromptConfig] Initializing from ${this.dataDir}`);

    try {
      // Step 1: Assert required files exist
      assertDataFilesExist(this.dataDir, REQUIRED_PROMPT_CONFIG_FILES);

      // Step 2: Load all JSON files
      const systemPrompts = this.loadJSON<SystemPromptsConfig>('system_prompts.json');
      const answerStyles = this.loadJSON<AnswerStylesConfig>('answer_styles.json');
      const answerExamples = this.loadJSON<AnswerExamplesConfig>('answer_examples.json');
      const markdownComponents = this.loadJSON<MarkdownComponentsConfig>('markdown_components.json');
      const tablePresets = this.loadJSON<TablePresetsConfig>('table_presets.json');
      const validationPolicies = this.loadJSON<ValidationPoliciesConfig>('validation_policies.json');
      const retrievalPolicies = this.loadJSON<RetrievalPoliciesConfig>('retrieval_policies.json');
      const errorLocalization = this.loadJSON<ErrorLocalizationConfig>('error_localization.json');

      // Optional files
      const languageProfiles = this.loadJSONOptional<LanguageProfilesConfig>('language_profiles.json');
      const debugLabels = this.loadJSONOptional<DebugLabelsConfig>('debug_labels.json');

      // Step 3: Validate schemas
      this.validateSystemPrompts(systemPrompts);
      this.validateAnswerStyles(answerStyles);
      this.validateValidationPolicies(validationPolicies);
      this.validateRetrievalPolicies(retrievalPolicies);

      // Step 4: Build bundle
      this.bundle = {
        systemPrompts,
        answerStyles,
        answerExamples,
        markdownComponents,
        tablePresets,
        validationPolicies,
        retrievalPolicies,
        errorLocalization,
        languageProfiles,
        debugLabels,
      };

      this.loadedAt = Date.now();
      const duration = this.loadedAt - startTime;

      this.logger.info(
        `[PromptConfig] Loaded ${this.fileMetadata.length} files in ${duration}ms`
      );
    } catch (error: any) {
      this.logger.error(`[PromptConfig] Initialization failed: ${error.message}`);
      throw new Error(`PromptConfig initialization failed: ${error.message}`);
    }
  }

  /**
   * Get the complete configuration bundle
   */
  public getBundle(): PromptConfigBundle {
    this.assertInitialized();
    return this.bundle!;
  }

  /**
   * Get system prompt for intent and language
   */
  public getSystemPrompt(args: {
    intentKey: string;
    language: LanguageCode;
    variant?: string;
  }): string {
    this.assertInitialized();

    const { intentKey, language } = args;

    // Find prompt by mode (intentKey)
    const promptEntry = this.bundle!.systemPrompts.prompts.find(
      (p) => p.mode === intentKey || p.mode.toUpperCase() === intentKey.toUpperCase()
    );

    if (!promptEntry) {
      const error = `System prompt not found for intent: ${intentKey}`;
      if (this.env === 'prod') {
        throw new Error(error);
      } else {
        this.logger.warn(`[PromptConfig] ${error} (using fallback)`);
        return this.getFallbackSystemPrompt(intentKey, language);
      }
    }

    const langData = promptEntry.languages[language];
    if (!langData) {
      const error = `System prompt not found for language: ${language} (intent: ${intentKey})`;
      if (this.env === 'prod') {
        throw new Error(error);
      } else {
        this.logger.warn(`[PromptConfig] ${error} (trying 'en')`);
        return promptEntry.languages['en']?.systemPrompt || this.getFallbackSystemPrompt(intentKey, language);
      }
    }

    return langData.systemPrompt;
  }

  /**
   * Get answer style for intent and language
   */
  public getAnswerStyle(args: {
    styleId: string;
    language: LanguageCode;
    questionType?: string;
  }): AnswerStyleResolved {
    this.assertInitialized();

    const { styleId, language, questionType = 'DEFAULT' } = args;

    const intentStyles = this.bundle!.answerStyles[styleId];
    if (!intentStyles) {
      const error = `Answer style not found for styleId: ${styleId}`;
      if (this.env === 'prod') {
        throw new Error(error);
      } else {
        this.logger.warn(`[PromptConfig] ${error} (using default)`);
        return this.getDefaultAnswerStyle();
      }
    }

    const questionTypeStyles = intentStyles[questionType] || intentStyles['DEFAULT'] || intentStyles[Object.keys(intentStyles)[0]];
    if (!questionTypeStyles) {
      return this.getDefaultAnswerStyle();
    }

    const langStyle = questionTypeStyles[language] || questionTypeStyles['en'];
    return langStyle || this.getDefaultAnswerStyle();
  }

  /**
   * Get few-shot examples
   */
  public getFewShotExamples(args: {
    intentKey: string;
    language: LanguageCode;
    questionType?: string;
    maxExamples: number;
  }): FewShotExample[] {
    this.assertInitialized();

    const { intentKey, language, maxExamples } = args;

    const intentExamples = this.bundle!.answerExamples[intentKey];
    if (!intentExamples) {
      return [];
    }

    const langExamples = intentExamples[language] || intentExamples['en'];
    if (!langExamples || !Array.isArray(langExamples)) {
      return [];
    }

    return langExamples.slice(0, maxExamples);
  }

  /**
   * Get markdown component
   */
  public getMarkdownComponent(args: {
    componentKey: string;
    language: LanguageCode;
  }): string {
    this.assertInitialized();

    const { componentKey, language } = args;

    const component = this.bundle!.markdownComponents.components[componentKey];
    if (!component) {
      this.logger.warn(`[PromptConfig] Markdown component not found: ${componentKey}`);
      return '';
    }

    return component[language] || component['en'] || '';
  }

  /**
   * Get table preset
   */
  public getTablePreset(args: { presetKey: string }): any {
    this.assertInitialized();

    const { presetKey } = args;

    const preset = this.bundle!.tablePresets.presets[presetKey];
    if (!preset) {
      this.logger.warn(`[PromptConfig] Table preset not found: ${presetKey}`);
      return null;
    }

    return preset;
  }

  /**
   * Get validation policy
   */
  public getValidationPolicy(args: { intentKey: string }): ValidationPolicy | null {
    this.assertInitialized();

    const { intentKey } = args;

    const policy = this.bundle!.validationPolicies.policies.find(
      (p) => p.category === intentKey || p.name === intentKey
    );

    if (!policy) {
      this.logger.warn(`[PromptConfig] Validation policy not found: ${intentKey}`);
      return null;
    }

    return policy;
  }

  /**
   * Get retrieval policy
   */
  public getRetrievalPolicy(args: {
    intentKey: string;
    scope?: string;
  }): RetrievalPolicy | null {
    this.assertInitialized();

    const { intentKey } = args;

    const policy = this.bundle!.retrievalPolicies.policies.find(
      (p) => p.intentType === intentKey || p.intentType.toUpperCase() === intentKey.toUpperCase()
    );

    if (!policy) {
      this.logger.warn(`[PromptConfig] Retrieval policy not found: ${intentKey}`);
      return null;
    }

    return policy;
  }

  /**
   * Get localized error message
   */
  public getErrorMessage(args: {
    errorKey: string;
    language: LanguageCode;
  }): string {
    this.assertInitialized();

    const { errorKey, language } = args;

    const errorMessages = this.bundle!.errorLocalization[errorKey];
    if (!errorMessages) {
      return `Error: ${errorKey}`;
    }

    return errorMessages[language] || errorMessages['en'] || `Error: ${errorKey}`;
  }

  /**
   * Get configuration metadata
   */
  public getConfigMeta(): {
    loadedAt: number;
    dataDir: string;
    files: Array<{ name: string; bytes: number; sha256?: string }>;
    version?: string;
  } {
    return {
      loadedAt: this.loadedAt,
      dataDir: this.dataDir,
      files: this.fileMetadata,
      version: this.bundle?.systemPrompts.version,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private assertInitialized(): void {
    if (!this.bundle) {
      throw new Error('PromptConfigService not initialized. Call init() first.');
    }
  }

  private loadJSON<T>(filename: string): T {
    const filePath = path.join(this.dataDir, filename);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      this.fileMetadata.push({
        name: filename,
        bytes: Buffer.byteLength(content, 'utf-8'),
      });

      return data as T;
    } catch (error: any) {
      throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
  }

  private loadJSONOptional<T>(filename: string): T | undefined {
    const filePath = path.join(this.dataDir, filename);

    if (!fs.existsSync(filePath)) {
      this.logger.info(`[PromptConfig] Optional file not found: ${filename}`);
      return undefined;
    }

    try {
      return this.loadJSON<T>(filename);
    } catch (error: any) {
      this.logger.warn(`[PromptConfig] Failed to load optional file ${filename}: ${error.message}`);
      return undefined;
    }
  }

  private validateSystemPrompts(config: SystemPromptsConfig): void {
    if (!config.prompts || !Array.isArray(config.prompts)) {
      throw new Error('system_prompts.json: missing or invalid "prompts" array');
    }

    for (const prompt of config.prompts) {
      if (!prompt.mode) {
        throw new Error('system_prompts.json: prompt missing "mode" field');
      }
      if (!prompt.languages || typeof prompt.languages !== 'object') {
        throw new Error(`system_prompts.json: prompt "${prompt.mode}" missing "languages" object`);
      }
    }

    this.logger.info(`[PromptConfig] Validated ${config.prompts.length} system prompts`);
  }

  private validateAnswerStyles(config: AnswerStylesConfig): void {
    const intentKeys = Object.keys(config).filter(k => k !== '_comment');

    if (intentKeys.length === 0) {
      throw new Error('answer_styles.json: no intent keys found');
    }

    this.logger.info(`[PromptConfig] Validated ${intentKeys.length} answer style intents`);
  }

  private validateValidationPolicies(config: ValidationPoliciesConfig): void {
    if (!config.policies || !Array.isArray(config.policies)) {
      throw new Error('validation_policies.json: missing or invalid "policies" array');
    }

    this.logger.info(`[PromptConfig] Validated ${config.policies.length} validation policies`);
  }

  private validateRetrievalPolicies(config: RetrievalPoliciesConfig): void {
    if (!config.policies || !Array.isArray(config.policies)) {
      throw new Error('retrieval_policies.json: missing or invalid "policies" array');
    }

    for (const policy of config.policies) {
      if (!policy.intentType) {
        throw new Error('retrieval_policies.json: policy missing "intentType" field');
      }
      if (!policy.retrieval) {
        throw new Error(`retrieval_policies.json: policy "${policy.intentType}" missing "retrieval" field`);
      }
    }

    this.logger.info(`[PromptConfig] Validated ${config.policies.length} retrieval policies`);
  }

  private getFallbackSystemPrompt(intentKey: string, language: LanguageCode): string {
    return `You are Koda, an AI assistant. Answer the user's question helpfully and accurately.`;
  }

  private getDefaultAnswerStyle(): AnswerStyleResolved {
    return {
      structure: 'paragraph',
      tone: 'professional',
      verbosity: 'balanced',
      formatting: ['markdown'],
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let promptConfigInstance: PromptConfigService | null = null;

/**
 * Get singleton instance of PromptConfigService
 * Must call initPromptConfig() first
 */
export function getPromptConfig(): PromptConfigService {
  if (!promptConfigInstance) {
    throw new Error('PromptConfig not initialized. Call initPromptConfig() at startup.');
  }
  return promptConfigInstance;
}

/**
 * Initialize PromptConfig singleton
 * Call this once at application startup
 */
export function initPromptConfig(opts: {
  dataDir?: string;
  env: 'dev' | 'prod' | 'test';
  logger?: LoggerLike;
}): void {
  if (promptConfigInstance) {
    console.warn('[PromptConfig] Already initialized, skipping');
    return;
  }

  promptConfigInstance = new PromptConfigService(opts);
  promptConfigInstance.init();
}

/**
 * Reset PromptConfig singleton (for testing)
 */
export function resetPromptConfig(): void {
  promptConfigInstance = null;
}
