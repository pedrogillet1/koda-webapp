import { detect } from 'langdetect';

/**
 * Language names mapping for user-friendly display
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  cs: 'Czech',
  ro: 'Romanian',
  hu: 'Hungarian',
  el: 'Greek',
  he: 'Hebrew',
  uk: 'Ukrainian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  lt: 'Lithuanian',
  sl: 'Slovenian',
  et: 'Estonian',
  lv: 'Latvian',
};

/**
 * Detect the language of a text string
 * @param text - The text to analyze
 * @returns Language code (e.g., 'en', 'es', 'pt') or 'en' if detection fails
 */
export function detectLanguage(text: string): string {
  try {
    // Need at least a few words for reliable detection
    if (!text || text.trim().length < 10) {
      console.log(`🌍 Language detection: Text too short, defaulting to English`);
      return 'en'; // Default to English for very short text
    }

    // Use langdetect library to detect the language of the USER'S QUERY
    // This ensures responses match the query language, not the document language
    const results = detect(text);

    if (results && results.length > 0) {
      // Get the most likely language
      let detectedLang = results[0].lang;
      const confidence = results[0].prob;

      // IMPORTANT: Only switch from English if confidence is very high (>= 95%)
      // This prevents false positives where English queries are detected as other languages
      if (detectedLang !== 'en' && confidence < 0.95) {
        console.log(`🌍 Language detection: ${detectedLang} detected but confidence too low (${(confidence * 100).toFixed(1)}%), defaulting to English`);
        return 'en';
      }

      const confidencePercent = (confidence * 100).toFixed(1);

      // Portuguese/Spanish disambiguation
      // If detected as Spanish, check for Portuguese-specific indicators
      if (detectedLang === 'es') {
        const lowerText = text.toLowerCase();

        // Portuguese-specific words and patterns
        const portugueseIndicators = [
          'ção', 'ões', 'ã', 'õe', 'nh', // Portuguese-specific endings and characters
          'está', 'estão', 'são',        // Common verbs
          'qual', 'quais',               // Question words
          'não',                         // Negation
          'também',                      // Also
          'você',                        // You (PT-BR)
          'com',                         // With (different pronunciation)
        ];

        // Spanish-specific indicators
        const spanishIndicators = [
          'ción', 'ciones',              // Spanish endings
          'está', 'están',               // Common verbs (different from PT)
          'qué', 'cuál',                 // Question words with accents
          'también',                     // Also (Spanish version)
          'usted',                       // You (formal Spanish)
          'hola',                        // Hello (Spanish)
        ];

        const ptScore = portugueseIndicators.reduce((score, indicator) =>
          score + (lowerText.includes(indicator) ? 1 : 0), 0);
        const esScore = spanishIndicators.reduce((score, indicator) =>
          score + (lowerText.includes(indicator) ? 1 : 0), 0);

        // If more Portuguese indicators, change detection
        if (ptScore > esScore && ptScore > 0) {
          detectedLang = 'pt';
          console.log(`🌍 Language disambiguation: Overriding 'es' → 'pt' (PT indicators: ${ptScore}, ES indicators: ${esScore})`);
        }
      }

      console.log(`🌍 Detected query language: ${detectedLang} (${LANGUAGE_NAMES[detectedLang] || 'Unknown'}) with ${confidencePercent}% confidence - AI will respond in this language`);
      return detectedLang;
    }

    // Fallback to English
    console.log(`🌍 Language detection: No results, defaulting to English`);
    return 'en';
  } catch (error) {
    console.warn('⚠️ Language detection failed, defaulting to English:', error);
    return 'en';
  }
}

/**
 * Get the full language name from a language code
 * @param langCode - ISO 639-1 language code (e.g., 'en', 'es')
 * @returns Full language name (e.g., 'English', 'Spanish')
 */
export function getLanguageName(langCode: string): string {
  return LANGUAGE_NAMES[langCode] || 'English';
}

/**
 * Create a language instruction for the AI based on detected language
 * @param langCode - ISO 639-1 language code
 * @returns Instruction string to add to the AI prompt
 */
export function createLanguageInstruction(langCode: string): string {
  if (langCode === 'en') {
    return ''; // No special instruction needed for English
  }

  const languageName = getLanguageName(langCode);

  return `\n\n🌍 **LANGUAGE INSTRUCTION**: The user is communicating in **${languageName}**. You MUST respond in **${languageName}** to match the user's language. Do NOT respond in English unless the user switches to English.`;
}
