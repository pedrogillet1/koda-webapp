/**
 * Koda V3 Composition Root (Dependency Injection Container)
 *
 * This file is the SINGLE SOURCE OF TRUTH for service instantiation.
 * All services are created here in the correct dependency order.
 *
 * WHY THIS EXISTS:
 * - Prevents circular dependencies
 * - Ensures all dependencies are wired correctly
 * - Fail-fast on missing dependencies (startup error vs runtime error)
 * - Makes testing easier (can inject mocks)
 *
 * RULES:
 * 1. Controllers MUST import orchestrator from this file ONLY
 * 2. Service files MUST export classes, NOT instances
 * 3. All singletons are created here
 * 4. JSON configs are loaded once at startup
 */

import { KodaOrchestratorV3 } from '../services/core/kodaOrchestratorV3.service';
import { KodaIntentEngineV3 } from '../services/core/kodaIntentEngineV3.service';
import KodaRetrievalEngineV3 from '../services/core/kodaRetrievalEngineV3.service';
import KodaAnswerEngineV3 from '../services/core/kodaAnswerEngineV3.service';
import { KodaFormattingPipelineV3Service } from '../services/core/kodaFormattingPipelineV3.service';
import { KodaProductHelpServiceV3 } from '../services/core/kodaProductHelpV3.service';
import { FallbackConfigService } from '../services/core/fallbackConfig.service';
import { UserPreferencesService } from '../services/user/userPreferences.service';
import { ConversationMemoryService } from '../services/memory/conversationMemory.service';
import { FeedbackLoggerService } from '../services/analytics/feedbackLogger.service';
import { AnalyticsEngineService } from '../services/analytics/analyticsEngine.service';

// ============================================================================
// BOOTSTRAP ERROR
// ============================================================================

class BootstrapWiringError extends Error {
  constructor(message: string) {
    super(`[BOOTSTRAP_WIRING_ERROR] ${message}`);
    this.name = 'BootstrapWiringError';
  }
}

// ============================================================================
// CONTAINER INTERFACE
// ============================================================================

export interface KodaV3Services {
  orchestrator: KodaOrchestratorV3;
  intentEngine: KodaIntentEngineV3;
  retrievalEngine: KodaRetrievalEngineV3;
  answerEngine: KodaAnswerEngineV3;
  formattingPipeline: KodaFormattingPipelineV3Service;
  productHelp: KodaProductHelpServiceV3;
  fallbackConfig: FallbackConfigService;
  userPreferences: UserPreferencesService;
  conversationMemory: ConversationMemoryService;
  feedbackLogger: FeedbackLoggerService;
  analyticsEngine: AnalyticsEngineService;
}

// ============================================================================
// CONTAINER CLASS
// ============================================================================

class KodaV3Container {
  private services: Partial<KodaV3Services> = {};
  private _isInitialized = false;

  /**
   * Initialize all services in correct dependency order.
   * This MUST be called once at server startup.
   */
  public initialize(): void {
    if (this._isInitialized) {
      console.log('⚠️  [Container] Already initialized, skipping');
      return;
    }

    console.log('🚀 [Container] Initializing Koda V3 services...');

    try {
      // ========== STEP 1: Create config services ==========
      console.log('📦 [Container] Creating config services...');
      this.services.fallbackConfig = new FallbackConfigService();

      // ========== STEP 2: Create leaf services (no dependencies) ==========
      console.log('📦 [Container] Creating leaf services...');
      this.services.retrievalEngine = new KodaRetrievalEngineV3();
      this.services.answerEngine = new KodaAnswerEngineV3();
      this.services.formattingPipeline = new KodaFormattingPipelineV3Service();
      this.services.productHelp = new KodaProductHelpServiceV3();
      this.services.userPreferences = new UserPreferencesService();
      this.services.conversationMemory = new ConversationMemoryService();
      this.services.feedbackLogger = new FeedbackLoggerService();
      this.services.analyticsEngine = new AnalyticsEngineService();

      // ========== STEP 3: Create intent engine ==========
      console.log('📦 [Container] Creating intent engine...');
      this.services.intentEngine = new KodaIntentEngineV3();

      // ========== STEP 4: Create orchestrator (depends on everything) ==========
      console.log('📦 [Container] Creating orchestrator with dependencies...');
      this.services.orchestrator = new KodaOrchestratorV3(
        {
          intentEngine: this.services.intentEngine,
          fallbackConfig: this.services.fallbackConfig,
          productHelp: this.services.productHelp,
          formattingPipeline: this.services.formattingPipeline,
          retrievalEngine: this.services.retrievalEngine,
          answerEngine: this.services.answerEngine,
          userPreferences: this.services.userPreferences,
          conversationMemory: this.services.conversationMemory,
          feedbackLogger: this.services.feedbackLogger,
          analyticsEngine: this.services.analyticsEngine,
        },
        console // logger
      );

      // ========== STEP 5: Fail-fast assertions ==========
      this.assertWiring();

      this._isInitialized = true;

      console.log('✅ [Container] Koda V3 initialization complete!');
    } catch (error) {
      console.error('❌ [Container] Initialization failed:', error);
      throw new BootstrapWiringError(
        `Failed to initialize Koda V3 services: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fail-fast assertions to ensure all critical dependencies are wired.
   */
  private assertWiring(): void {
    console.log('🔍 [Container] Running fail-fast wiring assertions...');

    const criticalServices: (keyof KodaV3Services)[] = [
      'orchestrator',
      'intentEngine',
      'retrievalEngine',
      'answerEngine',
      'formattingPipeline',
      'fallbackConfig',
    ];

    for (const serviceName of criticalServices) {
      if (!this.services[serviceName]) {
        throw new BootstrapWiringError(`${serviceName} is undefined`);
      }
    }

    // Verify orchestrator has dependencies
    const orch = this.services.orchestrator as any;
    if (!orch.retrievalEngine) {
      throw new BootstrapWiringError('Orchestrator.retrievalEngine is undefined (DI failed)');
    }
    if (!orch.answerEngine) {
      throw new BootstrapWiringError('Orchestrator.answerEngine is undefined (DI failed)');
    }
    if (!orch.intentEngine) {
      throw new BootstrapWiringError('Orchestrator.intentEngine is undefined (DI failed)');
    }

    console.log('✅ [Container] All wiring assertions passed');
  }

  /**
   * Check if container is initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get the orchestrator instance.
   */
  public getOrchestrator(): KodaOrchestratorV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError(
        'Container not initialized. Call container.initialize() at server startup.'
      );
    }
    return this.services.orchestrator!;
  }

  /**
   * Get the intent engine instance.
   */
  public getIntentEngine(): KodaIntentEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.intentEngine!;
  }

  /**
   * Get the retrieval engine instance.
   */
  public getRetrievalEngine(): KodaRetrievalEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.retrievalEngine!;
  }

  /**
   * Get the answer engine instance.
   */
  public getAnswerEngine(): KodaAnswerEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.answerEngine!;
  }

  /**
   * Get the analytics engine instance.
   */
  public getAnalyticsEngine(): AnalyticsEngineService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.analyticsEngine!;
  }

  /**
   * Get all services (for testing)
   */
  public getAllServices(): KodaV3Services {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services as KodaV3Services;
  }
}

// ============================================================================
// SINGLETON CONTAINER INSTANCE
// ============================================================================

const container = new KodaV3Container();

/**
 * Initialize the container (call once at startup)
 */
export function initializeContainer(): void {
  container.initialize();
}

/**
 * Get the container instance
 */
export function getContainer(): KodaV3Container {
  return container;
}

/**
 * Convenience export for orchestrator
 */
export function getOrchestrator(): KodaOrchestratorV3 {
  return container.getOrchestrator();
}

export { container };
export default container;
