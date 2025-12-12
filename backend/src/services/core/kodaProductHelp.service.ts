/**
 * Koda Product Help Service
 * Provides access to Koda UI/product help content for PRODUCT_HELP intent
 */

import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../../config/dataPaths';

/**
 * Product help screen structure
 */
export interface ProductHelpScreen {
  key: string;
  title: string;
  description?: string;
  topics: ProductHelpTopic[];
}

/**
 * Individual help topic
 */
export interface ProductHelpTopic {
  key: string;
  title: string;
  content: string;
  tags?: string[];
  language?: string;
}

/**
 * Parameters for building an answer
 */
export interface BuildAnswerParams {
  screenKey: string;
  topicKey: string;
  language?: string;
}

/**
 * Search result for topics
 */
export interface SearchTopicResult {
  screenKey: string;
  topicKey: string;
  title: string;
  snippet: string;
  language: string;
}

/**
 * Service to load and provide access to Koda product help content.
 * Loads data/koda_product_help.json at startup and exposes methods to query it.
 */
export class KodaProductHelpService {
  private static instance: KodaProductHelpService | null = null;
  private productHelpData: Map<string, ProductHelpScreen> = new Map();
  private loaded = false;

  private constructor() {}

  /**
   * Singleton accessor to get the service instance.
   */
  public static async getInstance(): Promise<KodaProductHelpService> {
    if (!KodaProductHelpService.instance) {
      const service = new KodaProductHelpService();
      await service.loadData();
      KodaProductHelpService.instance = service;
    }
    return KodaProductHelpService.instance;
  }

  /**
   * Get instance synchronously (returns null if not loaded)
   */
  public static getInstanceSync(): KodaProductHelpService | null {
    return KodaProductHelpService.instance;
  }

  /**
   * Loads and parses the koda_product_help.json file.
   */
  private async loadData(): Promise<void> {
    if (this.loaded) return;

    try {
      const filePath = path.join(DATA_DIR, 'koda_product_help.json');

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.warn('[KodaProductHelp] Product help file not found, using empty data');
        this.loaded = true;
        return;
      }

      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.warn('[KodaProductHelp] Invalid JSON structure, expected array');
        this.loaded = true;
        return;
      }

      for (const screen of parsed) {
        if (!screen.key || !screen.title || !Array.isArray(screen.topics)) {
          continue;
        }

        const validTopics: ProductHelpTopic[] = [];
        for (const topic of screen.topics) {
          if (!topic.key || !topic.title || !topic.content) {
            continue;
          }
          validTopics.push({
            key: topic.key,
            title: topic.title,
            content: topic.content,
            tags: Array.isArray(topic.tags) ? topic.tags : [],
            language: typeof topic.language === 'string' ? topic.language : 'en',
          });
        }

        this.productHelpData.set(screen.key, {
          key: screen.key,
          title: screen.title,
          description: typeof screen.description === 'string' ? screen.description : undefined,
          topics: validTopics,
        });
      }

      this.loaded = true;
      console.log(`[KodaProductHelp] Loaded ${this.productHelpData.size} screens`);
    } catch (err) {
      console.error('[KodaProductHelp] Failed to load data:', err);
      this.loaded = true;
    }
  }

  /**
   * Returns the ProductHelpScreen for the given screenKey
   */
  public getScreen(screenKey: string): ProductHelpScreen | undefined {
    if (!screenKey) return undefined;
    return this.productHelpData.get(screenKey);
  }

  /**
   * Returns the ProductHelpTopic for the given screenKey and topicKey
   */
  public getTopic(screenKey: string, topicKey: string): ProductHelpTopic | undefined {
    if (!screenKey || !topicKey) return undefined;
    const screen = this.productHelpData.get(screenKey);
    if (!screen) return undefined;
    return screen.topics.find((topic) => topic.key === topicKey);
  }

  /**
   * Searches all topics across all screens for the query string.
   */
  public searchTopics(query: string, language?: string): SearchTopicResult[] {
    if (!query || query.trim().length === 0) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const results: SearchTopicResult[] = [];

    for (const [screenKey, screen] of this.productHelpData.entries()) {
      for (const topic of screen.topics) {
        if (language && topic.language && topic.language.toLowerCase() !== language.toLowerCase()) {
          continue;
        }

        const haystack = `${topic.title} ${topic.content}`.toLowerCase();
        const idx = haystack.indexOf(normalizedQuery);
        if (idx === -1) continue;

        // Build snippet around match
        const snippetRadius = 50;
        const contentLower = topic.content.toLowerCase();
        const contentIdx = contentLower.indexOf(normalizedQuery);

        let snippet = '';
        if (contentIdx !== -1) {
          const snippetStart = Math.max(0, contentIdx - snippetRadius);
          const snippetEnd = Math.min(topic.content.length, contentIdx + normalizedQuery.length + snippetRadius);
          snippet = topic.content.substring(snippetStart, snippetEnd).trim();
        } else {
          snippet = topic.content.substring(0, 100).trim();
        }

        results.push({
          screenKey,
          topicKey: topic.key,
          title: topic.title,
          snippet: snippet.length > 100 ? snippet.substring(0, 97) + '...' : snippet,
          language: topic.language ?? 'en',
        });
      }
    }

    return results;
  }

  /**
   * Builds a formatted answer string for a given screenKey and topicKey.
   */
  public buildAnswer(params: BuildAnswerParams): string {
    const { screenKey, topicKey, language } = params;

    if (!screenKey || !topicKey) {
      return language === 'pt'
        ? 'Desculpe, não consegui encontrar a informação solicitada.'
        : 'Sorry, I could not find the requested information.';
    }

    const topic = this.getTopic(screenKey, topicKey);
    if (!topic) {
      return language === 'pt'
        ? `Desculpe, o tópico "${topicKey}" não foi encontrado na seção "${screenKey}".`
        : `Sorry, the topic "${topicKey}" was not found in section "${screenKey}".`;
    }

    return topic.content;
  }

  /**
   * Get all available screens
   */
  public getAllScreens(): ProductHelpScreen[] {
    return Array.from(this.productHelpData.values());
  }
}

// Export singleton accessor
export const kodaProductHelpService = KodaProductHelpService;
