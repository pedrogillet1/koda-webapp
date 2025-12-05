/**
 * Dynamic Response Generator Service
 *
 * Generates contextual, dynamic responses for file actions and system events.
 * Replaces hardcoded preset responses with LLM-generated ones.
 *
 * Supports:
 * - File operations (create, delete, move, rename)
 * - Folder operations
 * - Search results
 * - Error messages
 * - Success confirmations
 */

import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ResponseGeneratorOptions {
  action: string;
  success: boolean;
  language: string;
  details?: {
    filename?: string;
    folderName?: string;
    sourceFolder?: string;
    destinationFolder?: string;
    itemCount?: number;
    errorMessage?: string;
    searchTerm?: string;
    results?: Array<{ name: string; type?: string }>;
    [key: string]: any;
  };
  userQuery?: string;
}

export interface GeneratedResponse {
  message: string;
  shouldShowUI?: boolean;
  uiType?: string;
  uiData?: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// Action Templates
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_TEMPLATES: Record<string, Record<string, { success: string; failure: string }>> = {
  file_create: {
    en: {
      success: 'I\'ve created the file "{filename}".',
      failure: 'I couldn\'t create the file. {errorMessage}'
    },
    pt: {
      success: 'Criei o arquivo "{filename}".',
      failure: 'Não consegui criar o arquivo. {errorMessage}'
    },
    es: {
      success: 'He creado el archivo "{filename}".',
      failure: 'No pude crear el archivo. {errorMessage}'
    }
  },

  file_delete: {
    en: {
      success: 'I\'ve deleted "{filename}".',
      failure: 'I couldn\'t delete the file. {errorMessage}'
    },
    pt: {
      success: 'Excluí "{filename}".',
      failure: 'Não consegui excluir o arquivo. {errorMessage}'
    },
    es: {
      success: 'He eliminado "{filename}".',
      failure: 'No pude eliminar el archivo. {errorMessage}'
    }
  },

  file_move: {
    en: {
      success: 'I\'ve moved "{filename}" to {destinationFolder}.',
      failure: 'I couldn\'t move the file. {errorMessage}'
    },
    pt: {
      success: 'Movi "{filename}" para {destinationFolder}.',
      failure: 'Não consegui mover o arquivo. {errorMessage}'
    },
    es: {
      success: 'He movido "{filename}" a {destinationFolder}.',
      failure: 'No pude mover el archivo. {errorMessage}'
    }
  },

  file_rename: {
    en: {
      success: 'I\'ve renamed the file to "{filename}".',
      failure: 'I couldn\'t rename the file. {errorMessage}'
    },
    pt: {
      success: 'Renomeei o arquivo para "{filename}".',
      failure: 'Não consegui renomear o arquivo. {errorMessage}'
    },
    es: {
      success: 'He renombrado el archivo a "{filename}".',
      failure: 'No pude renombrar el archivo. {errorMessage}'
    }
  },

  folder_create: {
    en: {
      success: 'I\'ve created the folder "{folderName}".',
      failure: 'I couldn\'t create the folder. {errorMessage}'
    },
    pt: {
      success: 'Criei a pasta "{folderName}".',
      failure: 'Não consegui criar a pasta. {errorMessage}'
    },
    es: {
      success: 'He creado la carpeta "{folderName}".',
      failure: 'No pude crear la carpeta. {errorMessage}'
    }
  },

  folder_delete: {
    en: {
      success: 'I\'ve deleted the folder "{folderName}".',
      failure: 'I couldn\'t delete the folder. {errorMessage}'
    },
    pt: {
      success: 'Excluí a pasta "{folderName}".',
      failure: 'Não consegui excluir a pasta. {errorMessage}'
    },
    es: {
      success: 'He eliminado la carpeta "{folderName}".',
      failure: 'No pude eliminar la carpeta. {errorMessage}'
    }
  },

  search: {
    en: {
      success: 'I found {itemCount} result(s) for "{searchTerm}".',
      failure: 'I couldn\'t find anything matching "{searchTerm}".'
    },
    pt: {
      success: 'Encontrei {itemCount} resultado(s) para "{searchTerm}".',
      failure: 'Não encontrei nada correspondente a "{searchTerm}".'
    },
    es: {
      success: 'Encontré {itemCount} resultado(s) para "{searchTerm}".',
      failure: 'No encontré nada que coincida con "{searchTerm}".'
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Response Generator Service
// ═══════════════════════════════════════════════════════════════════════════

class DynamicResponseGeneratorService {
  /**
   * Generate a dynamic response for an action
   */
  async generateResponse(options: ResponseGeneratorOptions): Promise<GeneratedResponse> {
    const { action, success, language, details, userQuery } = options;
    console.log(`🔄 [DYNAMIC RESPONSE] Generating for action: ${action}, success: ${success}`);

    try {
      // First try template-based response (fast)
      const templateResponse = this.getTemplateResponse(action, success, language, details);

      if (templateResponse) {
        return { message: templateResponse };
      }

      // Fall back to LLM generation for complex cases
      return await this.generateLLMResponse(options);

    } catch (error: any) {
      console.error('❌ [DYNAMIC RESPONSE] Generation failed:', error.message);
      return {
        message: this.getFallbackMessage(action, success, language)
      };
    }
  }

  /**
   * Get template-based response (fast, no LLM call)
   */
  private getTemplateResponse(
    action: string,
    success: boolean,
    language: string,
    details?: ResponseGeneratorOptions['details']
  ): string | null {
    const template = ACTION_TEMPLATES[action]?.[language] || ACTION_TEMPLATES[action]?.['en'];

    if (!template) {
      return null;
    }

    let message = success ? template.success : template.failure;

    // Replace placeholders with actual values
    if (details) {
      for (const [key, value] of Object.entries(details)) {
        if (typeof value === 'string' || typeof value === 'number') {
          message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
      }
    }

    // Clean up any unreplaced placeholders
    message = message.replace(/\{[^}]+\}/g, '');

    return message.trim();
  }

  /**
   * Generate LLM-based response for complex actions
   */
  private async generateLLMResponse(options: ResponseGeneratorOptions): Promise<GeneratedResponse> {
    const { action, success, language, details, userQuery } = options;

    const prompt = `Generate a brief, helpful response in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}.

Action: ${action}
Status: ${success ? 'Success' : 'Failed'}
${userQuery ? `User's request: "${userQuery}"` : ''}
${details ? `Details: ${JSON.stringify(details)}` : ''}

Rules:
- Be concise (1-2 sentences max)
- Sound natural and helpful
- Don't be overly apologetic
- If success, confirm what was done
- If failure, explain briefly and suggest alternatives

Response:`;

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
      }
    });

    const result = await model.generateContent(prompt);
    const message = result.response.text() || this.getFallbackMessage(action, success, language);

    return { message };
  }

  /**
   * Get fallback message when everything else fails
   */
  private getFallbackMessage(action: string, success: boolean, language: string): string {
    const fallbacks: Record<string, Record<string, string>> = {
      en: {
        success: 'Done!',
        failure: 'Something went wrong. Please try again.'
      },
      pt: {
        success: 'Pronto!',
        failure: 'Algo deu errado. Por favor, tente novamente.'
      },
      es: {
        success: '¡Listo!',
        failure: 'Algo salió mal. Por favor, inténtalo de nuevo.'
      }
    };

    const langFallbacks = fallbacks[language] || fallbacks['en'];
    return success ? langFallbacks.success : langFallbacks.failure;
  }

  /**
   * Generate a contextual greeting response
   */
  async generateGreeting(
    language: string,
    userName?: string,
    documentCount?: number,
    timeOfDay?: 'morning' | 'afternoon' | 'evening'
  ): Promise<string> {
    const greetings: Record<string, Record<string, string>> = {
      morning: {
        en: userName ? `Good morning, ${userName}!` : 'Good morning!',
        pt: userName ? `Bom dia, ${userName}!` : 'Bom dia!',
        es: userName ? `¡Buenos días, ${userName}!` : '¡Buenos días!'
      },
      afternoon: {
        en: userName ? `Good afternoon, ${userName}!` : 'Good afternoon!',
        pt: userName ? `Boa tarde, ${userName}!` : 'Boa tarde!',
        es: userName ? `¡Buenas tardes, ${userName}!` : '¡Buenas tardes!'
      },
      evening: {
        en: userName ? `Good evening, ${userName}!` : 'Good evening!',
        pt: userName ? `Boa noite, ${userName}!` : 'Boa noite!',
        es: userName ? `¡Buenas noches, ${userName}!` : '¡Buenas noches!'
      }
    };

    const tod = timeOfDay || this.getTimeOfDay();
    let greeting = greetings[tod]?.[language] || greetings[tod]?.['en'] || 'Hello!';

    if (documentCount !== undefined) {
      const docMsg: Record<string, string> = {
        en: documentCount > 0
          ? ` You have ${documentCount} document${documentCount !== 1 ? 's' : ''}. How can I help you?`
          : ' Upload some documents to get started!',
        pt: documentCount > 0
          ? ` Você tem ${documentCount} documento${documentCount !== 1 ? 's' : ''}. Como posso ajudar?`
          : ' Faça upload de documentos para começar!',
        es: documentCount > 0
          ? ` Tienes ${documentCount} documento${documentCount !== 1 ? 's' : ''}. ¿Cómo puedo ayudarte?`
          : ' ¡Sube documentos para comenzar!'
      };
      greeting += docMsg[language] || docMsg['en'];
    }

    return greeting;
  }

  /**
   * Get current time of day
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  /**
   * Generate a search summary response
   */
  async generateSearchSummary(
    results: Array<{ name: string; type?: string; relevance?: number }>,
    searchTerm: string,
    language: string
  ): Promise<string> {
    if (results.length === 0) {
      const noResults: Record<string, string> = {
        en: `I couldn't find anything matching "${searchTerm}". Try different keywords or check the spelling.`,
        pt: `Não encontrei nada correspondente a "${searchTerm}". Tente palavras diferentes ou verifique a ortografia.`,
        es: `No encontré nada que coincida con "${searchTerm}". Intenta con otras palabras o revisa la ortografía.`
      };
      return noResults[language] || noResults['en'];
    }

    const intro: Record<string, string> = {
      en: `I found ${results.length} result${results.length !== 1 ? 's' : ''} for "${searchTerm}":\n\n`,
      pt: `Encontrei ${results.length} resultado${results.length !== 1 ? 's' : ''} para "${searchTerm}":\n\n`,
      es: `Encontré ${results.length} resultado${results.length !== 1 ? 's' : ''} para "${searchTerm}":\n\n`
    };

    let response = intro[language] || intro['en'];

    for (const result of results.slice(0, 5)) {
      response += `• ${result.name}\n`;
    }

    if (results.length > 5) {
      const more: Record<string, string> = {
        en: `\n_...and ${results.length - 5} more_`,
        pt: `\n_...e mais ${results.length - 5}_`,
        es: `\n_...y ${results.length - 5} más_`
      };
      response += more[language] || more['en'];
    }

    return response;
  }
}

export const dynamicResponseGeneratorService = new DynamicResponseGeneratorService();

// Export the main generate function for compatibility with stubs
export async function generateDynamicResponse(
  options: string | ResponseGeneratorOptions,
  params?: any
): Promise<string> {
  if (typeof options === 'string') {
    return options;
  }

  const response = await dynamicResponseGeneratorService.generateResponse(options);
  return response.message;
}

export const generateResponse = generateDynamicResponse;

export default dynamicResponseGeneratorService;
