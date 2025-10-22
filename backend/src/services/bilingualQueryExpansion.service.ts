/**
 * Bilingual Query Expansion Service
 * Translates queries to dominant document languages
 * Improves cross-lingual retrieval (PT query finds EN documents)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { detectLanguage } from './languageDetection.service';
import prisma from '../config/database';

interface ExpandedQuery {
  original: string;
  originalLang: string;
  translations: Array<{
    lang: string;
    text: string;
  }>;
  allQueries: string[];
}

class BilingualQueryExpansionService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Expand query to multiple languages
   *
   * Example:
   *   Input: "qual é o ICP da Koda?" (PT)
   *   Output: {
   *     original: "qual é o ICP da Koda?",
   *     originalLang: "pt",
   *     translations: [
   *       { lang: "en", text: "what is Koda's ICP?" },
   *       { lang: "es", text: "¿cuál es el ICP de Koda?" }
   *     ],
   *     allQueries: ["qual é o ICP da Koda?", "what is Koda's ICP?", ...]
   *   }
   */
  async expandQuery(
    query: string,
    userId: string,
    targetLanguages?: string[]
  ): Promise<ExpandedQuery> {
    // Detect original language
    const originalLang = detectLanguage(query);

    // Determine target languages based on user's documents
    const targets = targetLanguages || await this.getDominantLanguages(userId);

    console.log(`🌍 Expanding query from ${originalLang} to [${targets.join(', ')}]`);

    // Translate to target languages (skip if already in that language)
    const translations = [];
    for (const targetLang of targets) {
      if (targetLang !== originalLang) {
        try {
          const translated = await this.translate(query, originalLang, targetLang);
          translations.push({ lang: targetLang, text: translated });
          console.log(`   ${originalLang} → ${targetLang}: "${translated}"`);
        } catch (error) {
          console.warn(`⚠️ Failed to translate to ${targetLang}:`, error);
        }
      }
    }

    // Combine all queries
    const allQueries = [
      query,
      ...translations.map(t => t.text)
    ];

    return {
      original: query,
      originalLang,
      translations,
      allQueries
    };
  }

  /**
   * Translate text using Gemini
   */
  private async translate(
    text: string,
    fromLang: string,
    toLang: string
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200
      }
    });

    const languageNames: Record<string, string> = {
      en: 'English',
      pt: 'Portuguese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian'
    };

    const prompt = `You are a professional translator. Translate from ${languageNames[fromLang] || fromLang} to ${languageNames[toLang] || toLang}.

CRITICAL RULES:
- Preserve technical terms and acronyms (ICP, TAM, SAM, etc.)
- Output ONLY the translation, no explanations
- Maintain the same tone and formality

Text to translate: ${text}

Translation:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Get dominant document languages from user's workspace
   * Analyzes document metadata to determine which languages are most common
   */
  async getDominantLanguages(userId: string): Promise<string[]> {
    try {
      // Query document metadata to find dominant languages
      const documents = await prisma.document.findMany({
        where: { userId },
        select: {
          metadata: true
        }
      });

      // Count languages (detected from filenames or content)
      const languageCounts = new Map<string, number>();

      for (const doc of documents) {
        // Try to detect language from metadata or filename
        const language = this.detectDocumentLanguage(doc.metadata);
        if (language) {
          languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
        }
      }

      // Sort by count and return top 3
      const sorted = Array.from(languageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang]) => lang);

      // Default to English, Portuguese, Spanish if no documents
      if (sorted.length === 0) {
        return ['en', 'pt', 'es'];
      }

      // Always include English if not already present
      if (!sorted.includes('en')) {
        sorted.push('en');
      }

      console.log(`📊 Dominant languages for user: [${sorted.join(', ')}]`);

      return sorted.slice(0, 3); // Max 3 languages
    } catch (error) {
      console.error('❌ Error detecting dominant languages:', error);
      return ['en', 'pt', 'es']; // Fallback
    }
  }

  /**
   * Detect document language from metadata
   */
  private detectDocumentLanguage(metadata: any): string | null {
    if (!metadata) return null;

    // Check if language is stored in metadata
    if (metadata.language) {
      return metadata.language;
    }

    // Try to detect from extracted text
    if (metadata.extractedText) {
      const text = metadata.extractedText.substring(0, 500);
      return detectLanguage(text);
    }

    return null;
  }

  /**
   * Alternative: Use Google Translate API (faster, cheaper)
   * Uncomment to use instead of Gemini
   */
  /*
  private async translateWithGoogle(
    text: string,
    fromLang: string,
    toLang: string
  ): Promise<string> {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: fromLang,
          target: toLang,
          format: 'text'
        })
      }
    );

    const data = await response.json();
    return data.data.translations[0].translatedText;
  }
  */

  /**
   * Test translation quality
   */
  async testTranslation(): Promise<void> {
    console.log('🧪 Testing translation quality...\n');

    const testCases = [
      { text: 'What is the ideal customer profile?', from: 'en', to: 'pt' },
      { text: 'Qual é o perfil do cliente ideal?', from: 'pt', to: 'en' },
      { text: 'What is the TAM for this market?', from: 'en', to: 'es' }
    ];

    for (const testCase of testCases) {
      const translation = await this.translate(testCase.text, testCase.from, testCase.to);
      console.log(`${testCase.from} → ${testCase.to}:`);
      console.log(`  Original: "${testCase.text}"`);
      console.log(`  Translation: "${translation}"\n`);
    }
  }
}

export default new BilingualQueryExpansionService();
export { BilingualQueryExpansionService, ExpandedQuery };
