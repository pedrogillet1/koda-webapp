import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  reliability?: 'High' | 'Medium' | 'Low';
  domain?: string;
}

// Reliable domain sources (Tier 1 - Highest credibility)
const TIER_1_DOMAINS = [
  'reuters.com',
  'apnews.com', // Associated Press
  'bbc.com',
  'bbc.co.uk',
  'wsj.com', // Wall Street Journal
  'bloomberg.com',
  'ft.com', // Financial Times
  'economist.com',
  'npr.org',
  'pbs.org',
  'axios.com',
  'nature.com',
  'science.org',
  'nejm.org', // New England Journal of Medicine
  'thelancet.com',
  'gov', // Government domains (.gov)
  'edu', // Educational institutions (.edu)
];

// Tier 2 - High credibility
const TIER_2_DOMAINS = [
  'washingtonpost.com',
  'nytimes.com',
  'theguardian.com',
  'cnn.com',
  'time.com',
  'fortune.com',
  'businessinsider.com',
  'cnbc.com',
  'techcrunch.com',
  'wired.com',
  'arstechnica.com',
  'wikipedia.org',
  'investopedia.com',
  'forbes.com',
];

// Tier 3 - Medium credibility (specialized sources)
const TIER_3_DOMAINS = [
  'medium.com',
  'hackernoon.com',
  'stackoverflow.com',
  'github.com',
  'reddit.com',
];

/**
 * Web Search Service
 * Supports multiple search providers: Google Custom Search, Brave Search, SerpAPI, Bing
 */
class WebSearchService {
  private provider: 'google' | 'brave' | 'serpapi' | 'bing' = 'google';

  constructor() {
    // Automatically detect which provider is configured
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      this.provider = 'google';
    } else if (process.env.BRAVE_SEARCH_API_KEY) {
      this.provider = 'brave';
    } else if (process.env.SERPAPI_API_KEY) {
      this.provider = 'serpapi';
    } else if (process.env.BING_SEARCH_API_KEY) {
      this.provider = 'bing';
    }

    console.log(`🔍 Web search provider: ${this.provider}`);
  }

  /**
   * Search the web and return results
   * @param query - Search query
   * @param limit - Number of results (default: 5)
   * @param reliableOnly - Filter to only reliable sources (default: true)
   * @returns Array of search results sorted by reliability
   */
  async search(query: string, limit: number = 5, reliableOnly: boolean = true): Promise<WebSearchResult[]> {
    try {
      console.log(`🌐 Searching web for: "${query}" (provider: ${this.provider}, reliable only: ${reliableOnly})`);

      let results: WebSearchResult[] = [];

      // Request more results initially to compensate for filtering
      const requestLimit = reliableOnly ? limit * 3 : limit;

      switch (this.provider) {
        case 'google':
          results = await this.searchGoogle(query, requestLimit);
          break;
        case 'brave':
          results = await this.searchBrave(query, requestLimit);
          break;
        case 'serpapi':
          results = await this.searchSerpAPI(query, requestLimit);
          break;
        case 'bing':
          results = await this.searchBing(query, requestLimit);
          break;
        default:
          throw new Error('No web search provider configured');
      }

      // Filter and sort by reliability
      const filteredResults = this.filterByReliability(results, reliableOnly);

      // Take only requested number after filtering
      const limitedResults = filteredResults.slice(0, limit);

      // Fetch full content for each result
      const resultsWithContent = await Promise.all(
        limitedResults.map(async (result) => {
          try {
            const content = await this.fetchPageContent(result.url);
            return { ...result, content };
          } catch (error) {
            console.warn(`Failed to fetch content from ${result.url}:`, error);
            return result; // Return without content if fetch fails
          }
        })
      );

      console.log(`✅ Found ${resultsWithContent.length} reliable web results`);
      console.log(`📊 Reliability breakdown:`, {
        high: resultsWithContent.filter(r => r.reliability === 'High').length,
        medium: resultsWithContent.filter(r => r.reliability === 'Medium').length,
        low: resultsWithContent.filter(r => r.reliability === 'Low').length,
      });

      return resultsWithContent;
    } catch (error) {
      console.error('Error in web search:', error);
      throw error;
    }
  }

  /**
   * Search using Google Custom Search API
   * @param query - Search query
   * @param limit - Number of results
   * @returns Array of search results
   */
  private async searchGoogle(query: string, limit: number): Promise<WebSearchResult[]> {
    try {
      const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

      if (!apiKey || !engineId) {
        throw new Error('Google Custom Search API key or Engine ID not configured');
      }

      // Limit query length to 200 characters (Google Custom Search limit is ~2048, but let's be safe)
      const trimmedQuery = query.length > 200 ? query.substring(0, 200) : query;

      console.log(`🔍 Google search query (${trimmedQuery.length} chars): "${trimmedQuery}"`);

      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: engineId,
          q: trimmedQuery,
          num: Math.min(limit, 10) // Google CSE max is 10 results per query
        }
      });

      const items = response.data.items || [];

      return items.map((item: any) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet || ''
      }));
    } catch (error: any) {
      console.error('Google search error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Google search failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Search using Brave Search API
   * @param query - Search query
   * @param limit - Number of results
   * @returns Array of search results
   */
  private async searchBrave(query: string, limit: number): Promise<WebSearchResult[]> {
    try {
      const apiKey = process.env.BRAVE_SEARCH_API_KEY;

      if (!apiKey) {
        throw new Error('Brave Search API key not configured');
      }

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: {
          q: query,
          count: limit
        },
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        }
      });

      const results = response.data.web?.results || [];

      return results.map((result: any) => ({
        url: result.url,
        title: result.title,
        snippet: result.description || ''
      }));
    } catch (error: any) {
      console.error('Brave search error:', error.response?.data || error.message);
      throw new Error('Brave search failed');
    }
  }

  /**
   * Search using SerpAPI
   * @param query - Search query
   * @param limit - Number of results
   * @returns Array of search results
   */
  private async searchSerpAPI(query: string, limit: number): Promise<WebSearchResult[]> {
    try {
      const apiKey = process.env.SERPAPI_API_KEY;

      if (!apiKey) {
        throw new Error('SerpAPI key not configured');
      }

      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: apiKey,
          num: limit,
          engine: 'google'
        }
      });

      const results = response.data.organic_results || [];

      return results.map((result: any) => ({
        url: result.link,
        title: result.title,
        snippet: result.snippet || ''
      }));
    } catch (error: any) {
      console.error('SerpAPI error:', error.response?.data || error.message);
      throw new Error('SerpAPI search failed');
    }
  }

  /**
   * Search using Bing Web Search API
   * @param query - Search query
   * @param limit - Number of results
   * @returns Array of search results
   */
  private async searchBing(query: string, limit: number): Promise<WebSearchResult[]> {
    try {
      const apiKey = process.env.BING_SEARCH_API_KEY;

      if (!apiKey) {
        throw new Error('Bing Search API key not configured');
      }

      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        params: {
          q: query,
          count: limit
        },
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });

      const results = response.data.webPages?.value || [];

      return results.map((result: any) => ({
        url: result.url,
        title: result.name,
        snippet: result.snippet || ''
      }));
    } catch (error: any) {
      console.error('Bing search error:', error.response?.data || error.message);
      throw new Error('Bing search failed');
    }
  }

  /**
   * Fetch and extract readable content from a webpage
   * @param url - URL to fetch
   * @returns Extracted text content
   */
  private async fetchPageContent(url: string): Promise<string> {
    try {
      // Set timeout and user agent
      const response = await axios.get(url, {
        timeout: 3000, // 3 second timeout - faster failures for slow sites
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KodaBot/1.0)'
        },
        maxRedirects: 5
      });

      const html = response.data;

      // Use Readability to extract main content
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent) {
        // Limit content to 2000 characters for RAG context
        return article.textContent.substring(0, 2000).trim();
      }

      // Fallback: use cheerio to extract text
      const $ = cheerio.load(html);

      // Remove script, style, and nav elements
      $('script, style, nav, footer, header').remove();

      // Get main content
      const mainContent = $('main, article, .content, #content').text() || $('body').text();

      // Clean up whitespace
      const cleaned = mainContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000);

      return cleaned;
    } catch (error: any) {
      console.warn(`Failed to fetch ${url}:`, error.message);
      return ''; // Return empty string if fetch fails
    }
  }

  /**
   * Assess reliability of a URL based on its domain
   * @param url - URL to assess
   * @returns Reliability tier and domain
   */
  private assessReliability(url: string): { reliability: 'High' | 'Medium' | 'Low'; domain: string } {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');

      // Check Tier 1 (Highest credibility)
      if (TIER_1_DOMAINS.some(trusted => domain.includes(trusted) || domain.endsWith('.gov') || domain.endsWith('.edu'))) {
        return { reliability: 'High', domain };
      }

      // Check Tier 2 (High credibility)
      if (TIER_2_DOMAINS.some(trusted => domain.includes(trusted))) {
        return { reliability: 'High', domain };
      }

      // Check Tier 3 (Medium credibility)
      if (TIER_3_DOMAINS.some(trusted => domain.includes(trusted))) {
        return { reliability: 'Medium', domain };
      }

      // Default to Low for unknown sources
      return { reliability: 'Low', domain };
    } catch (error) {
      return { reliability: 'Low', domain: 'unknown' };
    }
  }

  /**
   * Filter and sort results by reliability
   * Prioritizes High > Medium > Low reliability sources
   * @param results - Search results
   * @param reliableOnly - If true, filter out Low reliability sources
   * @returns Filtered and sorted results
   */
  private filterByReliability(results: WebSearchResult[], reliableOnly: boolean = true): WebSearchResult[] {
    // Add reliability assessment to each result
    const assessedResults = results.map(result => {
      const { reliability, domain } = this.assessReliability(result.url);
      return {
        ...result,
        reliability,
        domain,
      };
    });

    // Filter out low reliability if requested
    let filtered = assessedResults;
    if (reliableOnly) {
      filtered = assessedResults.filter(r => r.reliability !== 'Low');
      console.log(`🔍 Filtered out ${assessedResults.length - filtered.length} low-reliability sources`);
    }

    // Sort by reliability: High > Medium > Low
    const sorted = filtered.sort((a, b) => {
      const reliabilityScore = { 'High': 3, 'Medium': 2, 'Low': 1 };
      return (reliabilityScore[b.reliability!] || 0) - (reliabilityScore[a.reliability!] || 0);
    });

    return sorted;
  }

  /**
   * Get current provider
   * @returns Current search provider
   */
  getProvider(): string {
    return this.provider;
  }

  /**
   * Check if web search is configured
   * @returns True if at least one provider is configured
   */
  isConfigured(): boolean {
    return !!(
      (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) ||
      process.env.BRAVE_SEARCH_API_KEY ||
      process.env.SERPAPI_API_KEY ||
      process.env.BING_SEARCH_API_KEY
    );
  }

  /**
   * Get list of reliable domains
   * @returns Object with tier 1, 2, and 3 domains
   */
  getReliableDomains(): { tier1: string[]; tier2: string[]; tier3: string[] } {
    return {
      tier1: TIER_1_DOMAINS,
      tier2: TIER_2_DOMAINS,
      tier3: TIER_3_DOMAINS,
    };
  }
}

export default new WebSearchService();
