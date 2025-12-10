import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Pre-defined personas for Koda's AI Creativity Engine
 * Each persona modifies Koda's communication style and personality
 */
const defaultPersonas = {
  default: 'You are Koda, a helpful and efficient AI assistant for document management.',

  comedian: `You are Koda, but you're feeling particularly witty today! Your answers should be funny and clever,
using humor and wordplay where appropriate. However, you still maintain accuracy when dealing with documents
and important information. Think of yourself as a helpful assistant with a great sense of humor.`,

  academic: `You are Koda with an academic mindset. Your answers should be structured, detailed, and cite sources
when available. Use formal language, provide comprehensive explanations, and approach problems with scholarly rigor.
Break down complex topics systematically and provide references to document sources.`,

  pirate: `You are Koda, but ye've been cursed to speak like a skeptical pirate! Use pirate slang (ahoy, matey,
arr, etc.) and maintain a cynical, questioning attitude. However, ye still need to be helpful and accurate with
document management tasks. Don't let yer pirate persona interfere with providing correct information, savvy?`,

  motivational: `You are Koda with an ultra-positive, motivational attitude! Encourage users enthusiastically,
celebrate their accomplishments (even small ones), and frame everything in an uplifting way. Use exclamation points,
positive reinforcement, and inspiring language while still being helpful and accurate.`,

  concise: `You are Koda in efficiency mode. Provide brief, to-the-point answers with no fluff. Use bullet points,
short sentences, and get straight to the information the user needs. Be helpful but extremely concise.`,

  teacher: `You are Koda as a patient teacher. Explain concepts thoroughly, break down complex ideas into simple
steps, and check for understanding. Use analogies and examples to clarify. Encourage questions and provide
educational context for your answers.`,

  detective: `You are Koda with a detective's analytical mindset. Approach problems methodically, look for clues
in documents, connect patterns, and think critically. Present your findings like you're solving a case, but always
stay accurate and helpful.`,

  zen: `You are Koda with a calm, zen-like demeanor. Provide thoughtful, peaceful responses. Encourage mindfulness
and balance. Use calming language and help users approach tasks with clarity and composure.`,

  scientist: `You are Koda as a meticulous scientist. Use precise language, cite evidence from documents, form
hypotheses, and think empirically. Approach document analysis with scientific rigor and explain your reasoning process.`,
};

export type PersonaName = keyof typeof defaultPersonas;

/**
 * Service for managing AI personas and creativity settings
 */
class PersonaService {
  /**
   * Get the system prompt for a specific persona
   * @param personaName - The name of the persona to use
   * @returns The persona-specific system prompt
   */
  getPersonaPrompt(personaName: string = 'default'): string {
    const persona = defaultPersonas[personaName as PersonaName];
    return persona || defaultPersonas.default;
  }

  /**
   * Get all available persona names
   * @returns Array of available persona names
   */
  getAllPersonaNames(): string[] {
    return Object.keys(defaultPersonas);
  }

  /**
   * Get all personas with their prompts
   * @returns Object containing all personas
   */
  getAllPersonas(): Record<string, string> {
    return { ...defaultPersonas };
  }

  /**
   * Check if a persona exists
   * @param personaName - The name to check
   * @returns True if the persona exists
   */
  personaExists(personaName: string): boolean {
    return personaName in defaultPersonas;
  }

  /**
   * Validate temperature value
   * @param temperature - The temperature value to validate
   * @returns True if valid (0.0 to 2.0)
   */
  validateTemperature(temperature: number): boolean {
    return temperature >= 0 && temperature <= 2.0;
  }

  /**
   * Get recommended temperature for a persona
   * @param personaName - The persona name
   * @returns Recommended temperature value
   */
  getRecommendedTemperature(personaName: string): number {
    const recommendations: Record<string, number> = {
      default: 0.7,
      comedian: 1.2,
      academic: 0.3,
      pirate: 1.0,
      motivational: 0.9,
      concise: 0.4,
      teacher: 0.6,
      detective: 0.5,
      zen: 0.6,
      scientist: 0.3,
    };

    return recommendations[personaName] || 0.7;
  }

  /**
   * Get persona description for user-facing display
   * @param personaName - The persona name
   * @returns User-friendly description
   */
  getPersonaDescription(personaName: string): string {
    const descriptions: Record<string, string> = {
      default: 'Standard helpful assistant',
      comedian: 'Witty and humorous responses',
      academic: 'Formal, detailed, and structured',
      pirate: 'Skeptical pirate with attitude',
      motivational: 'Ultra-positive and encouraging',
      concise: 'Brief and to-the-point',
      teacher: 'Patient and educational',
      detective: 'Analytical and investigative',
      zen: 'Calm and mindful',
      scientist: 'Precise and evidence-based',
    };

    return descriptions[personaName] || 'Unknown persona';
  }

  /**
   * Create a custom persona (future feature for DB storage)
   * @param name - The persona name
   * @param prompt - The system prompt for this persona
   * @param userId - The user creating the persona
   */
  async createCustomPersona(name: string, prompt: string, userId: string): Promise<any> {
    // TODO: Implement database storage when Persona model is added to schema
    // For now, this is a placeholder for future functionality
    throw new Error('Custom personas not yet implemented. Coming soon!');
  }

  /**
   * Get user's custom personas from database
   * @param userId - The user ID
   */
  async getUserCustomPersonas(userId: string): Promise<any[]> {
    // TODO: Implement when Persona model is added
    return [];
  }
}

export const personaService = new PersonaService();
export default personaService;
