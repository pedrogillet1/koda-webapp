/**
 * LLM Intent Detector Service - STUB (service removed)
 */

interface IntentResult {
  intent: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export const detectIntent = async (_query?: string, _context?: any[]): Promise<IntentResult> => ({
  intent: 'general',
  confidence: 0,
  parameters: {}
});

export default { detectIntent };
