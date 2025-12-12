/**
 * @file kodaMultiIntentEngine.service.ts
 * @description Multi-intent detection engine for compound queries.
 *              Detects multiple intents in a single query, determines execution strategy
 *              (sequential vs parallel), and returns primary and secondary intents.
 *              Example: 'List my documents and summarize the latest one'.
 * 
 * This service is designed to be robust, extensible, and production-ready.
 */

import { Logger } from 'tslog';

/**
 * Interface representing a detected intent.
 */
export interface Intent {
  /** Unique identifier of the intent */
  id: string;
  /** Human-readable name of the intent */
  name: string;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Extracted parameters or entities related to the intent */
  parameters: Record<string, any>;
  /** Original text segment corresponding to this intent */
  text: string;
}

/**
 * Interface representing the result of multi-intent detection.
 */
export interface MultiIntentDetectionResult {
  /** The primary intent (highest confidence) */
  primaryIntent: Intent;
  /** Secondary intents detected */
  secondaryIntents: Intent[];
  /** Execution strategy: 'sequential' or 'parallel' */
  executionStrategy: 'sequential' | 'parallel';
}

/**
 * Interface for intent detection providers.
 * This allows plugging in different intent detection implementations.
 */
export interface IntentDetector {
  /**
   * Detect intents from a given query string.
   * @param query The input query string
   * @returns Array of detected intents sorted by confidence descending
   */
  detectIntents(query: string): Promise<Intent[]>;
}

/**
 * MultiIntentEngine service class.
 * Detects multiple intents from compound queries and determines execution strategy.
 */
export class KodaMultiIntentEngineService {
  private readonly logger: Logger;

  /**
   * Constructor for KodaMultiIntentEngineService.
   * @param intentDetector An implementation of IntentDetector interface.
   */
  constructor(private readonly intentDetector: IntentDetector) {
    this.logger = new Logger({ name: 'KodaMultiIntentEngineService' });
  }

  /**
   * Detect multiple intents from a compound query.
   * Determines primary and secondary intents and execution strategy.
   * 
   * @param query The user query string potentially containing multiple intents.
   * @returns Promise resolving to MultiIntentDetectionResult.
   * @throws Error if intent detection fails or no intents found.
   */
  public async detectMultiIntents(query: string): Promise<MultiIntentDetectionResult> {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('Invalid query string provided.');
    }

    this.logger.debug(`Detecting intents for query: "${query}"`);

    let intents: Intent[];
    try {
      intents = await this.intentDetector.detectIntents(query);
    } catch (error) {
      this.logger.error('Intent detection failed:', error);
      throw new Error('Failed to detect intents from query.');
    }

    if (!intents || intents.length === 0) {
      this.logger.warn('No intents detected from query.');
      throw new Error('No intents detected from query.');
    }

    // Sort intents by confidence descending
    intents.sort((a, b) => b.confidence - a.confidence);

    // Primary intent is the highest confidence intent
    const primaryIntent = intents[0];

    // Secondary intents are the rest with confidence above threshold
    const confidenceThreshold = 0.3; // configurable threshold for secondary intents
    const secondaryIntents = intents
      .slice(1)
      .filter(intent => intent.confidence >= confidenceThreshold);

    // Determine execution strategy based on intents and their relationships
    const executionStrategy = this.determineExecutionStrategy(primaryIntent, secondaryIntents);

    this.logger.info(`Detected primary intent: ${primaryIntent.name} (${primaryIntent.confidence.toFixed(2)})`);
    this.logger.info(`Detected ${secondaryIntents.length} secondary intent(s). Execution strategy: ${executionStrategy}`);

    return {
      primaryIntent,
      secondaryIntents,
      executionStrategy,
    };
  }

  /**
   * Determines whether intents should be executed sequentially or in parallel.
   * 
   * Rationale:
   * - If secondary intents depend on the output of the primary intent (e.g. "summarize the latest document" after "list documents"),
   *   execution should be sequential.
   * - If intents are independent (e.g. "list my documents and check my calendar"),
   *   execution can be parallel.
   * 
   * This method uses heuristic rules based on intent names and parameters.
   * 
   * @param primaryIntent The primary detected intent.
   * @param secondaryIntents Array of secondary detected intents.
   * @returns 'sequential' or 'parallel'
   */
  private determineExecutionStrategy(primaryIntent: Intent, secondaryIntents: Intent[]): 'sequential' | 'parallel' {
    if (secondaryIntents.length === 0) {
      // Only one intent, no need for parallelism
      return 'sequential';
    }

    // Heuristic: if any secondary intent references entities or parameters from primary intent, run sequentially
    for (const secondary of secondaryIntents) {
      if (this.isDependentIntent(primaryIntent, secondary)) {
        return 'sequential';
      }
    }

    // Otherwise, assume intents are independent and can be run in parallel
    return 'parallel';
  }

  /**
   * Checks if a secondary intent depends on the primary intent.
   * 
   * Dependency is inferred if:
   * - Secondary intent parameters reference entities extracted by primary intent.
   * - Secondary intent text contains references like "the latest one", "that document", etc.
   * 
   * @param primaryIntent The primary intent.
   * @param secondaryIntent The secondary intent.
   * @returns true if secondary intent depends on primary intent, false otherwise.
   */
  private isDependentIntent(primaryIntent: Intent, secondaryIntent: Intent): boolean {
    // Check if secondary intent parameters reference primary intent parameters
    const primaryEntities = new Set(Object.values(primaryIntent.parameters).flat(Infinity).map(String));

    for (const paramValue of Object.values(secondaryIntent.parameters)) {
      if (Array.isArray(paramValue)) {
        for (const val of paramValue) {
          if (primaryEntities.has(String(val))) {
            this.logger.debug(`Secondary intent "${secondaryIntent.name}" depends on primary intent via parameter value: ${val}`);
            return true;
          }
        }
      } else if (primaryEntities.has(String(paramValue))) {
        this.logger.debug(`Secondary intent "${secondaryIntent.name}" depends on primary intent via parameter value: ${paramValue}`);
        return true;
      }
    }

    // Check for textual references indicating dependency
    const dependencyIndicators = [
      'the latest', 'that one', 'that document', 'it', 'them', 'those', 'this one', 'this document'
    ];

    const secondaryTextLower = secondaryIntent.text.toLowerCase();
    for (const indicator of dependencyIndicators) {
      if (secondaryTextLower.includes(indicator)) {
        this.logger.debug(`Secondary intent "${secondaryIntent.name}" depends on primary intent via text indicator: "${indicator}"`);
        return true;
      }
    }

    return false;
  }
}

/**
 * Example implementation of IntentDetector using simple keyword matching.
 * In production, replace with an NLP model or external service.
 */
export class SimpleKeywordIntentDetector implements IntentDetector {
  private readonly logger: Logger;

  private readonly intentDefinitions: Array<{
    id: string;
    name: string;
    keywords: string[];
  }> = [
    { id: 'list_documents', name: 'ListDocuments', keywords: ['list documents', 'show documents', 'my documents'] },
    { id: 'summarize_document', name: 'SummarizeDocument', keywords: ['summarize', 'summary', 'brief'] },
    { id: 'check_calendar', name: 'CheckCalendar', keywords: ['check calendar', 'my schedule', 'appointments'] },
    { id: 'send_email', name: 'SendEmail', keywords: ['send email', 'email to', 'compose email'] },
    // Add more intents and keywords as needed
  ];

  constructor() {
    this.logger = new Logger({ name: 'SimpleKeywordIntentDetector' });
  }

  /**
   * Detect intents by matching keywords in the query.
   * Assigns confidence based on keyword match length and count.
   * 
   * @param query The input query string.
   * @returns Promise resolving to array of detected intents sorted by confidence descending.
   */
  public async detectIntents(query: string): Promise<Intent[]> {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('Invalid query string provided to intent detector.');
    }

    const lowerQuery = query.toLowerCase();

    const detectedIntents: Intent[] = [];

    for (const intentDef of this.intentDefinitions) {
      let maxConfidence = 0;
      let matchedText = '';

      for (const keyword of intentDef.keywords) {
        if (lowerQuery.includes(keyword)) {
          // Confidence heuristic: longer keywords and exact matches get higher confidence
          const confidence = Math.min(1, keyword.length / query.length + 0.1);
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            matchedText = keyword;
          }
        }
      }

      if (maxConfidence > 0) {
        detectedIntents.push({
          id: intentDef.id,
          name: intentDef.name,
          confidence: maxConfidence,
          parameters: this.extractParameters(intentDef.id, query),
          text: matchedText,
        });
      }
    }

    // If no intents matched, return empty array
    return detectedIntents;
  }

  /**
   * Extract parameters/entities from the query based on intent id.
   * This is a stub implementation; in production use NLP entity extraction.
   * 
   * @param intentId The intent identifier.
   * @param query The original query string.
   * @returns Parameters object.
   */
  private extractParameters(intentId: string, query: string): Record<string, any> {
    const params: Record<string, any> = {};

    switch (intentId) {
      case 'list_documents':
        // Example: no parameters needed for listing documents
        break;

      case 'summarize_document':
        // Try to detect document references like "latest document", "document 5", etc.
        const latestRegex = /\b(latest|most recent)\b/i;
        if (latestRegex.test(query)) {
          params.documentReference = 'latest';
        } else {
          // Attempt to find document number
          const docNumMatch = query.match(/\bdocument\s+(\d+)\b/i);
          if (docNumMatch) {
            params.documentReference = parseInt(docNumMatch[1], 10);
          }
        }
        break;

      case 'check_calendar':
        // Extract date or time references (simplified)
        const dateMatch = query.match(/\b(today|tomorrow|next week|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
        if (dateMatch) {
          params.date = dateMatch[1].toLowerCase();
        }
        break;

      case 'send_email':
        // Extract recipient email or name (simplified)
        const emailMatch = query.match(/\bto\s+([\w.-]+@[\w.-]+\.\w+)\b/i);
        if (emailMatch) {
          params.recipientEmail = emailMatch[1];
        } else {
          // Attempt to extract recipient name
          const nameMatch = query.match(/\bto\s+([A-Za-z\s]+)\b/i);
          if (nameMatch) {
            params.recipientName = nameMatch[1].trim();
          }
        }
        break;

      default:
        // No parameters extraction for unknown intents
        break;
    }

    return params;
  }
}
