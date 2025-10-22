import axios from 'axios';
import { config } from '../config/env';

/**
 * Live Data API Service
 * Provides real-time data from reliable sources:
 * - Alpha Vantage: Stock prices, forex, crypto
 * - FRED API: Economic indicators, inflation, GDP, unemployment
 * - NewsAPI: Verified news from reliable sources
 */

// ============================================
// INTERFACES
// ============================================

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: string;
  source: 'Alpha Vantage';
}

export interface EconomicData {
  indicator: string;
  value: number;
  date: string;
  unit: string;
  source: 'FRED';
  description?: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: string;
  category?: string;
  reliability: 'High' | 'Medium';
}

export interface CurrencyExchange {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: string;
  source: 'Alpha Vantage';
}

// ============================================
// RELIABLE NEWS SOURCES
// ============================================

/**
 * Tier 1: Highest reliability - Major global news organizations
 * These sources have established editorial standards and fact-checking
 */
const TIER_1_NEWS_SOURCES = [
  'reuters',
  'associated-press',
  'bbc-news',
  'the-wall-street-journal',
  'bloomberg',
  'financial-times',
  'the-economist',
  'npr',
  'pbs',
  'axios',
];

/**
 * Tier 2: High reliability - Reputable national news
 * Quality journalism with editorial oversight
 */
const TIER_2_NEWS_SOURCES = [
  'the-washington-post',
  'the-new-york-times',
  'cnn',
  'the-guardian',
  'time',
  'fortune',
  'business-insider',
  'cnbc',
  'abc-news',
  'cbs-news',
  'nbc-news',
];

/**
 * Combined list of reliable sources
 */
const RELIABLE_NEWS_SOURCES = [...TIER_1_NEWS_SOURCES, ...TIER_2_NEWS_SOURCES];

// ============================================
// LIVE DATA SERVICE
// ============================================

class LiveDataService {
  private alphaVantageKey: string;
  private fredApiKey: string;
  private newsApiKey: string;

  constructor() {
    this.alphaVantageKey = config.ALPHA_VANTAGE_API_KEY || '';
    this.fredApiKey = config.FRED_API_KEY || '';
    this.newsApiKey = config.NEWS_API_KEY || '';

    // Log configured services
    console.log('📊 Live Data API Configuration:');
    console.log(`  - Alpha Vantage (Stock/Forex): ${this.alphaVantageKey ? '✅' : '❌'}`);
    console.log(`  - FRED (Economic Data): ${this.fredApiKey ? '✅' : '❌'}`);
    console.log(`  - NewsAPI (Reliable News): ${this.newsApiKey ? '✅' : '❌'}`);
  }

  // ============================================
  // STOCK MARKET DATA (Alpha Vantage)
  // ============================================

  /**
   * Get real-time stock quote
   * @param symbol - Stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'MSFT')
   * @returns Stock quote with current price and details
   */
  async getStockQuote(symbol: string): Promise<StockQuote> {
    try {
      if (!this.alphaVantageKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      console.log(`📈 Fetching stock quote for: ${symbol}`);

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol.toUpperCase(),
          apikey: this.alphaVantageKey,
        },
        timeout: 10000,
      });

      const data = response.data['Global Quote'];

      if (!data || Object.keys(data).length === 0) {
        throw new Error(`No data found for symbol: ${symbol}`);
      }

      const quote: StockQuote = {
        symbol: data['01. symbol'],
        price: parseFloat(data['05. price']),
        change: parseFloat(data['09. change']),
        changePercent: parseFloat(data['10. change percent'].replace('%', '')),
        high: parseFloat(data['03. high']),
        low: parseFloat(data['04. low']),
        open: parseFloat(data['02. open']),
        previousClose: parseFloat(data['08. previous close']),
        volume: parseInt(data['06. volume']),
        timestamp: data['07. latest trading day'],
        source: 'Alpha Vantage',
      };

      console.log(`✅ Stock quote retrieved: ${quote.symbol} = $${quote.price}`);
      return quote;
    } catch (error: any) {
      console.error('Error fetching stock quote:', error.message);
      throw new Error(`Failed to fetch stock quote for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Search for stock symbols by company name
   * @param keywords - Company name or keywords
   * @returns Array of matching symbols
   */
  async searchStockSymbol(keywords: string): Promise<Array<{ symbol: string; name: string; type: string; region: string }>> {
    try {
      if (!this.alphaVantageKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      console.log(`🔍 Searching for stock symbol: ${keywords}`);

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords,
          apikey: this.alphaVantageKey,
        },
        timeout: 10000,
      });

      const matches = response.data.bestMatches || [];

      const results = matches.slice(0, 10).map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
      }));

      console.log(`✅ Found ${results.length} matching symbols`);
      return results;
    } catch (error: any) {
      console.error('Error searching stock symbol:', error.message);
      throw new Error(`Failed to search stock symbol: ${error.message}`);
    }
  }

  // ============================================
  // CURRENCY EXCHANGE (Alpha Vantage)
  // ============================================

  /**
   * Get currency exchange rate
   * @param fromCurrency - Source currency code (e.g., 'USD')
   * @param toCurrency - Target currency code (e.g., 'EUR')
   * @returns Exchange rate
   */
  async getCurrencyExchange(fromCurrency: string, toCurrency: string): Promise<CurrencyExchange> {
    try {
      if (!this.alphaVantageKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      console.log(`💱 Fetching exchange rate: ${fromCurrency} → ${toCurrency}`);

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: fromCurrency.toUpperCase(),
          to_currency: toCurrency.toUpperCase(),
          apikey: this.alphaVantageKey,
        },
        timeout: 10000,
      });

      const data = response.data['Realtime Currency Exchange Rate'];

      if (!data) {
        throw new Error(`No exchange rate found for ${fromCurrency}/${toCurrency}`);
      }

      const exchange: CurrencyExchange = {
        fromCurrency: data['1. From_Currency Code'],
        toCurrency: data['3. To_Currency Code'],
        rate: parseFloat(data['5. Exchange Rate']),
        timestamp: data['6. Last Refreshed'],
        source: 'Alpha Vantage',
      };

      console.log(`✅ Exchange rate: 1 ${exchange.fromCurrency} = ${exchange.rate} ${exchange.toCurrency}`);
      return exchange;
    } catch (error: any) {
      console.error('Error fetching currency exchange:', error.message);
      throw new Error(`Failed to fetch exchange rate: ${error.message}`);
    }
  }

  // ============================================
  // ECONOMIC DATA (FRED API)
  // ============================================

  /**
   * Get economic indicator from FRED
   * @param seriesId - FRED series ID (e.g., 'GDP', 'UNRATE', 'CPIAUCSL')
   * @returns Latest economic data point
   */
  async getEconomicIndicator(seriesId: string): Promise<EconomicData> {
    try {
      if (!this.fredApiKey) {
        throw new Error('FRED API key not configured');
      }

      console.log(`📊 Fetching FRED indicator: ${seriesId}`);

      // Get series data
      const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
        params: {
          series_id: seriesId,
          api_key: this.fredApiKey,
          file_type: 'json',
          sort_order: 'desc',
          limit: 1,
        },
        timeout: 10000,
      });

      // Get series metadata
      const metadataResponse = await axios.get('https://api.stlouisfed.org/fred/series', {
        params: {
          series_id: seriesId,
          api_key: this.fredApiKey,
          file_type: 'json',
        },
        timeout: 10000,
      });

      const observation = response.data.observations[0];
      const metadata = metadataResponse.data.seriess[0];

      if (!observation || observation.value === '.') {
        throw new Error(`No data available for series: ${seriesId}`);
      }

      const indicator: EconomicData = {
        indicator: seriesId,
        value: parseFloat(observation.value),
        date: observation.date,
        unit: metadata.units || 'Index',
        source: 'FRED',
        description: metadata.title,
      };

      console.log(`✅ Economic data: ${indicator.indicator} = ${indicator.value} ${indicator.unit} (${indicator.date})`);
      return indicator;
    } catch (error: any) {
      console.error('Error fetching FRED data:', error.message);
      throw new Error(`Failed to fetch economic indicator: ${error.message}`);
    }
  }

  /**
   * Get common economic indicators in one call
   * @returns Object with GDP, unemployment, inflation, etc.
   */
  async getEconomicSnapshot(): Promise<{
    gdp: EconomicData;
    unemployment: EconomicData;
    inflation: EconomicData;
    interestRate: EconomicData;
  }> {
    try {
      console.log('📊 Fetching economic snapshot...');

      const [gdp, unemployment, inflation, interestRate] = await Promise.all([
        this.getEconomicIndicator('GDP'), // Gross Domestic Product
        this.getEconomicIndicator('UNRATE'), // Unemployment Rate
        this.getEconomicIndicator('CPIAUCSL'), // Consumer Price Index (Inflation)
        this.getEconomicIndicator('DFF'), // Federal Funds Rate
      ]);

      console.log('✅ Economic snapshot complete');

      return {
        gdp,
        unemployment,
        inflation,
        interestRate,
      };
    } catch (error: any) {
      console.error('Error fetching economic snapshot:', error.message);
      throw new Error(`Failed to fetch economic snapshot: ${error.message}`);
    }
  }

  // ============================================
  // NEWS (NewsAPI - Reliable Sources Only)
  // ============================================

  /**
   * Get latest news from reliable sources
   * @param query - Search query (optional)
   * @param category - News category (business, technology, etc.)
   * @param limit - Number of articles (default: 10)
   * @returns Array of news articles from reliable sources
   */
  async getReliableNews(
    query?: string,
    category?: 'business' | 'technology' | 'science' | 'health' | 'general',
    limit: number = 10
  ): Promise<NewsArticle[]> {
    try {
      if (!this.newsApiKey) {
        throw new Error('NewsAPI key not configured');
      }

      console.log(`📰 Fetching news from reliable sources (query: "${query || 'latest'}", category: ${category || 'all'})`);

      // Use sources parameter to restrict to reliable sources
      const sources = RELIABLE_NEWS_SOURCES.join(',');

      const params: any = {
        apiKey: this.newsApiKey,
        sources,
        pageSize: limit,
        language: 'en',
      };

      // Use /everything endpoint if query provided, /top-headlines otherwise
      let endpoint = 'https://newsapi.org/v2/top-headlines';

      if (query) {
        endpoint = 'https://newsapi.org/v2/everything';
        params.q = query;
        params.sortBy = 'relevancy';
      } else if (category) {
        params.category = category;
      }

      const response = await axios.get(endpoint, {
        params,
        timeout: 10000,
      });

      const articles = response.data.articles || [];

      const newsArticles: NewsArticle[] = articles.map((article: any) => {
        // Determine reliability tier
        const sourceId = article.source.id || article.source.name.toLowerCase().replace(/\s+/g, '-');
        const reliability = TIER_1_NEWS_SOURCES.includes(sourceId) ? 'High' : 'Medium';

        return {
          title: article.title,
          description: article.description || '',
          url: article.url,
          source: article.source.name,
          author: article.author || undefined,
          publishedAt: article.publishedAt,
          category: category,
          reliability,
        };
      });

      console.log(`✅ Retrieved ${newsArticles.length} news articles from reliable sources`);
      return newsArticles;
    } catch (error: any) {
      console.error('Error fetching news:', error.message);
      throw new Error(`Failed to fetch news: ${error.message}`);
    }
  }

  /**
   * Get news by specific reliable source
   * @param source - News source ID (e.g., 'reuters', 'bloomberg')
   * @param limit - Number of articles (default: 10)
   * @returns Array of news articles
   */
  async getNewsBySource(source: string, limit: number = 10): Promise<NewsArticle[]> {
    try {
      if (!this.newsApiKey) {
        throw new Error('NewsAPI key not configured');
      }

      // Validate source is in our reliable list
      if (!RELIABLE_NEWS_SOURCES.includes(source.toLowerCase())) {
        throw new Error(`Source "${source}" is not in the list of reliable sources`);
      }

      console.log(`📰 Fetching news from source: ${source}`);

      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          apiKey: this.newsApiKey,
          sources: source,
          pageSize: limit,
        },
        timeout: 10000,
      });

      const articles = response.data.articles || [];

      const newsArticles: NewsArticle[] = articles.map((article: any) => ({
        title: article.title,
        description: article.description || '',
        url: article.url,
        source: article.source.name,
        author: article.author || undefined,
        publishedAt: article.publishedAt,
        reliability: TIER_1_NEWS_SOURCES.includes(source) ? 'High' : 'Medium',
      }));

      console.log(`✅ Retrieved ${newsArticles.length} articles from ${source}`);
      return newsArticles;
    } catch (error: any) {
      console.error('Error fetching news by source:', error.message);
      throw new Error(`Failed to fetch news from ${source}: ${error.message}`);
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get list of all reliable news sources
   * @returns Object with Tier 1 and Tier 2 sources
   */
  getReliableSources(): { tier1: string[]; tier2: string[]; all: string[] } {
    return {
      tier1: TIER_1_NEWS_SOURCES,
      tier2: TIER_2_NEWS_SOURCES,
      all: RELIABLE_NEWS_SOURCES,
    };
  }

  /**
   * Check if all APIs are configured
   * @returns Configuration status
   */
  getConfigStatus(): {
    alphaVantage: boolean;
    fred: boolean;
    newsApi: boolean;
    allConfigured: boolean;
  } {
    const status = {
      alphaVantage: !!this.alphaVantageKey,
      fred: !!this.fredApiKey,
      newsApi: !!this.newsApiKey,
      allConfigured: false,
    };

    status.allConfigured = status.alphaVantage && status.fred && status.newsApi;

    return status;
  }

  /**
   * Get supported stock exchanges
   * @returns List of supported exchanges
   */
  getSupportedExchanges(): string[] {
    return [
      'NYSE - New York Stock Exchange',
      'NASDAQ - NASDAQ Stock Market',
      'LSE - London Stock Exchange',
      'TSE - Tokyo Stock Exchange',
      'SSE - Shanghai Stock Exchange',
      'HKEX - Hong Kong Stock Exchange',
      'Euronext',
      'TSX - Toronto Stock Exchange',
    ];
  }

  /**
   * Get common FRED economic indicators
   * @returns List of popular FRED series
   */
  getCommonEconomicIndicators(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'GDP', name: 'Gross Domestic Product', description: 'Total economic output' },
      { id: 'UNRATE', name: 'Unemployment Rate', description: 'Percentage of unemployed workforce' },
      { id: 'CPIAUCSL', name: 'Consumer Price Index', description: 'Inflation measure' },
      { id: 'DFF', name: 'Federal Funds Rate', description: 'Interest rate target' },
      { id: 'DEXUSEU', name: 'USD/EUR Exchange Rate', description: 'US Dollar to Euro' },
      { id: 'MORTGAGE30US', name: '30-Year Mortgage Rate', description: 'Average mortgage interest rate' },
      { id: 'CSUSHPINSA', name: 'House Price Index', description: 'S&P Case-Shiller Index' },
      { id: 'T10Y2Y', name: 'Treasury Yield Spread', description: '10-Year minus 2-Year Treasury' },
    ];
  }
}

export default new LiveDataService();
