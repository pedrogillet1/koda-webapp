/**
 * Stub file - answerFormatValidator service was consolidated
 * This stub prevents runtime errors for any remaining imports
 */

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

const answerFormatValidator = {
  validate: async (answer: string, expectedFormat?: string): Promise<ValidationResult> => {
    console.warn('[ANSWER-FORMAT-VALIDATOR-STUB] Service consolidated, returning valid');
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }
};

export default answerFormatValidator;
