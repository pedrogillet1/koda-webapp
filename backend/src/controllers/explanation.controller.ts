import { Request, Response } from 'express';
import { explanationService } from '../services/explanation.service';
import * as languageService from '../services/languageDetection.service';

class ExplanationController {
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required and must be a string.' });
        return;
      }

      const detectedLanguage = languageService.detectLanguage(query);
      const systemPrompt = await languageService.buildCulturalSystemPrompt(detectedLanguage);

      const response = await explanationService.generateExplanation(query, systemPrompt);

      res.json({ response, language: detectedLanguage });
      return;
    } catch (error) {
      console.error('[ExplanationController] Error:', error);
      res.status(500).json({ error: 'An error occurred while generating the explanation.' });
      return;
    }
  }

  /**
   * Full pipeline endpoint - returns detailed explanation result
   */
  async generateFull(req: Request, res: Response): Promise<void> {
    try {
      const { query, context } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required and must be a string.' });
        return;
      }

      const detectedLanguage = languageService.detectLanguage(query);
      const systemPrompt = await languageService.buildCulturalSystemPrompt(detectedLanguage);

      const result = await explanationService.processExplanation(
        query,
        context || '',
        systemPrompt
      );

      res.json({
        response: result.finalResponse,
        chainOfThought: result.chainOfThought,
        factClaims: result.factClaims,
        sources: result.sources,
        language: detectedLanguage,
      });
      return;
    } catch (error) {
      console.error('[ExplanationController] Error:', error);
      res.status(500).json({ error: 'An error occurred while generating the explanation.' });
      return;
    }
  }
}

export const explanationController = new ExplanationController();
