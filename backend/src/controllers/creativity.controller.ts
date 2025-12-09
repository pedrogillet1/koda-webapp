import { Request, Response } from 'express';
import { personaService } from '../services/persona.service';
import { sendMessageToGeminiStreaming } from '../services/gemini.service';

/**
 * AI Creativity Engine Controller
 *
 * Provides endpoints for controlling the creativity of Koda's responses:
 * - Temperature control (0.0 to 2.0)
 * - Persona selection (different AI personalities)
 */
class CreativityController {
  /**
   * Get all available personas
   * GET /api/creativity/personas
   */
  async getPersonas(req: Request, res: Response): Promise<void> {
    try {
      const personas = personaService.getAllPersonas();
      const personaList = Object.entries(personas).map(([name, prompt]) => ({
        name,
        description: personaService.getPersonaDescription(name),
        recommendedTemperature: personaService.getRecommendedTemperature(name),
        systemPrompt: prompt,
      }));

      res.json({
        success: true,
        personas: personaList,
      });
      return;
    } catch (error) {
      console.error('Error fetching personas:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch personas',
      });
      return;
    }
  }

  /**
   * Get a specific persona
   * GET /api/creativity/personas/:name
   */
  async getPersona(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!personaService.personaExists(name)) {
        res.status(404).json({
          success: false,
          message: `Persona '${name}' not found`,
        });
        return;
      }

      const persona = {
        name,
        description: personaService.getPersonaDescription(name),
        recommendedTemperature: personaService.getRecommendedTemperature(name),
        systemPrompt: personaService.getPersonaPrompt(name),
      };

      res.json({
        success: true,
        persona,
      });
      return;
    } catch (error) {
      console.error('Error fetching persona:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch persona',
      });
      return;
    }
  }

  /**
   * Send a message with creativity controls
   * POST /api/creativity/message
   *
   * Body:
   * {
   *   message: string,
   *   conversationId: string,
   *   temperature?: number (0.0-2.0),
   *   persona?: string
   * }
   */
  async sendCreativeMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const {
        message,
        conversationId,
        temperature,
        persona
      } = req.body;

      // Validate message
      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Message is required',
        });
        return;
      }

      // Validate temperature if provided
      let finalTemperature = 0.7; // Default
      if (temperature !== undefined) {
        if (typeof temperature !== 'number' || !personaService.validateTemperature(temperature)) {
          res.status(400).json({
            success: false,
            message: 'Temperature must be a number between 0.0 and 2.0',
          });
          return;
        }
        finalTemperature = temperature;
      }

      // Validate persona if provided
      let finalPersona = 'default';
      if (persona !== undefined) {
        if (typeof persona !== 'string' || !personaService.personaExists(persona)) {
          res.status(400).json({
            success: false,
            message: `Persona '${persona}' not found`,
          });
          return;
        }
        finalPersona = persona;

        // If temperature not explicitly set, use persona's recommended temperature
        if (temperature === undefined) {
          finalTemperature = personaService.getRecommendedTemperature(finalPersona);
        }
      }

      // Get the persona system prompt
      const personaPrompt = personaService.getPersonaPrompt(finalPersona);

      // Set response headers for streaming (with UTF-8 charset for Portuguese)
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Stream the response using the gemini service with creativity controls
      await sendMessageToGeminiStreaming(
        message,
        [], // conversation history
        undefined, // userName
        undefined, // documentContext
        (chunk: string) => {
          // Stream chunks to client
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
        undefined, // detectedLanguage
        undefined, // useResearch
        finalTemperature, // Use custom temperature
        personaPrompt // Use custom persona prompt
      );

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;

    } catch (error) {
      console.error('Error sending creative message:', error);

      // If headers not sent, send error response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to send message',
        });
        return;
      } else {
        // If streaming, send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'An error occurred while processing your message'
        })}\n\n`);
        res.end();
        return;
      }
    }
  }

  /**
   * Validate temperature value
   * POST /api/creativity/validate-temperature
   *
   * Body:
   * {
   *   temperature: number
   * }
   */
  async validateTemperature(req: Request, res: Response): Promise<void> {
    try {
      const { temperature } = req.body;

      if (temperature === undefined) {
        res.status(400).json({
          success: false,
          message: 'Temperature is required',
        });
        return;
      }

      const isValid = personaService.validateTemperature(temperature);

      res.json({
        success: true,
        isValid,
        message: isValid
          ? 'Temperature is valid'
          : 'Temperature must be between 0.0 and 2.0',
      });
      return;
    } catch (error) {
      console.error('Error validating temperature:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate temperature',
      });
      return;
    }
  }

  /**
   * Get recommended temperature for a persona
   * GET /api/creativity/personas/:name/temperature
   */
  async getRecommendedTemperature(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!personaService.personaExists(name)) {
        res.status(404).json({
          success: false,
          message: `Persona '${name}' not found`,
        });
        return;
      }

      const recommendedTemperature = personaService.getRecommendedTemperature(name);

      res.json({
        success: true,
        persona: name,
        recommendedTemperature,
      });
      return;
    } catch (error) {
      console.error('Error getting recommended temperature:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recommended temperature',
      });
      return;
    }
  }
}

export const creativityController = new CreativityController();
export default creativityController;
