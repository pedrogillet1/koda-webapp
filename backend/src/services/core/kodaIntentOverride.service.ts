/**
 * @file kodaIntentOverride.service.ts
 * @description
 * Service to manage workspace-aware intent overrides.
 * Overrides intents based on workspace state such as:
 * - No documents present in workspace
 * - Workspace is currently processing
 * - User is a first-time user
 *
 * This service ensures that the system responds with appropriate fallback or onboarding intents
 * to improve user experience and guide users effectively.
 */

import { Logger } from 'tslog';

/**
 * Represents the possible intents that can be overridden.
 */
export enum Intent {
  NO_DOCS_TO_PRODUCT_HELP = 'NO_DOCS_TO_PRODUCT_HELP',
  PROCESSING_TO_FALLBACK = 'PROCESSING_TO_FALLBACK',
  FIRST_TIME_TO_ONBOARDING = 'FIRST_TIME_TO_ONBOARDING',
  FALLBACK = 'FALLBACK',
  PRODUCT_HELP = 'PRODUCT_HELP',
  ONBOARDING = 'ONBOARDING',
  // Add other intents as needed
}

/**
 * Represents the state of the workspace relevant for intent overrides.
 */
export interface WorkspaceStats {
  documentCount: number;
  isProcessing: boolean;
  isFirstTimeUser: boolean;
}

/**
 * Service to determine if an intent should be overridden based on workspace state.
 */
export class KodaIntentOverrideService {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger({ name: 'KodaIntentOverrideService' });
  }

  /**
   * Determines the overridden intent based on the current workspace state and the original intent.
   * Applies the following override rules:
   * 1. If there are no documents in the workspace, override to PRODUCT_HELP intent.
   * 2. If the workspace is processing, override to FALLBACK intent.
   * 3. If the user is a first-time user, override to ONBOARDING intent.
   *
   * The priority of overrides is:
   * NO_DOCS_TO_PRODUCT_HELP > PROCESSING_TO_FALLBACK > FIRST_TIME_TO_ONBOARDING
   *
   * @param originalIntent - The original intent detected.
   * @param workspaceStats - The current state of the workspace.
   * @returns The overridden intent if any override applies, otherwise the original intent.
   */
  public overrideIntent(
    originalIntent: Intent,
    workspaceStats: WorkspaceStats
  ): Intent {
    try {
      // Validate inputs
      if (!originalIntent) {
        throw new Error('Original intent must be provided.');
      }
      if (!workspaceStats) {
        throw new Error('Workspace stats must be provided.');
      }

      // Rule 1: No documents in workspace -> override to PRODUCT_HELP
      if (workspaceStats.documentCount === 0) {
        this.logger.debug(
          `Override applied: NO_DOCS_TO_PRODUCT_HELP (original: ${originalIntent})`
        );
        return Intent.PRODUCT_HELP;
      }

      // Rule 2: Workspace is processing -> override to FALLBACK
      if (workspaceStats.isProcessing) {
        this.logger.debug(
          `Override applied: PROCESSING_TO_FALLBACK (original: ${originalIntent})`
        );
        return Intent.FALLBACK;
      }

      // Rule 3: First-time user -> override to ONBOARDING
      if (workspaceStats.isFirstTimeUser) {
        this.logger.debug(
          `Override applied: FIRST_TIME_TO_ONBOARDING (original: ${originalIntent})`
        );
        return Intent.ONBOARDING;
      }

      // No overrides apply, return original intent
      this.logger.debug(`No override applied. Intent remains: ${originalIntent}`);
      return originalIntent;
    } catch (error) {
      this.logger.error('Error in overrideIntent:', error);
      // In case of error, fallback to original intent to avoid disruption
      return originalIntent;
    }
  }
}
