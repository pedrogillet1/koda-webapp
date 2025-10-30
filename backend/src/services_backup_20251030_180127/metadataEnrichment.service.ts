/**
 * Metadata Enrichment Service
 * Extract comprehensive metadata from documents using Gemini AI
 * - Topic extraction
 * - Entity recognition (people, organizations, locations, dates)
 * - Summary generation
 * - Key points extraction
 * - Sentiment analysis
 * - Complexity assessment
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { DocumentAnalysis } from '../types/unifiedDocument';

interface EnrichmentOptions {
  extractTopics?: boolean;
  extractEntities?: boolean;
  generateSummary?: boolean;
  extractKeyPoints?: boolean;
  analyzeSentiment?: boolean;
  assessComplexity?: boolean;
}

interface EnrichmentResult extends DocumentAnalysis {
  processingTime: number;
}

class MetadataEnrichmentService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL_NAME = 'gemini-2.5-pro';
  private readonly MAX_TEXT_LENGTH = 30000; // Characters

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Enrich document with comprehensive metadata
   */
  async enrichDocument(
    text: string,
    title?: string,
    options: EnrichmentOptions = {}
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();

    // Set defaults
    const opts = {
      extractTopics: options.extractTopics !== false,
      extractEntities: options.extractEntities !== false,
      generateSummary: options.generateSummary !== false,
      extractKeyPoints: options.extractKeyPoints !== false,
      analyzeSentiment: options.analyzeSentiment !== false,
      assessComplexity: options.assessComplexity !== false,
    };

    console.log('🔍 [Metadata Enrichment] Enriching document metadata...');

    // Truncate text if too long
    const processedText = this.truncateText(text);

    try {
      // Call Gemini AI with comprehensive analysis prompt
      const analysis = await this.performComprehensiveAnalysis(
        processedText,
        opts,
        title
      );

      const processingTime = Date.now() - startTime;

      console.log(`✅ [Metadata Enrichment] Completed in ${(processingTime / 1000).toFixed(2)}s`);
      console.log(`   Topics: ${analysis.topics.length}`);
      console.log(`   Entities: ${Object.values(analysis.entities).flat().length}`);
      console.log(`   Summary: ${analysis.summary.length} chars`);
      console.log(`   Key Points: ${analysis.keyPoints.length}`);

      return {
        ...analysis,
        processingTime,
      };
    } catch (error: any) {
      console.error('❌ [Metadata Enrichment] Error:', error);
      throw new Error(`Failed to enrich metadata: ${error.message}`);
    }
  }

  /**
   * Perform comprehensive analysis using Gemini
   */
  private async performComprehensiveAnalysis(
    text: string,
    options: EnrichmentOptions,
    title?: string
  ): Promise<DocumentAnalysis> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = this.buildAnalysisPrompt(text, title, options);

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse structured JSON response
    const analysis = this.parseAnalysisResponse(response);

    return analysis;
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(
    text: string,
    title: string | undefined,
    options: EnrichmentOptions
  ): string {
    let prompt = `Analyze the following document and extract comprehensive metadata. Return your response as a valid JSON object with the following structure:

{
  "topics": ["array of 3-7 main topics/themes"],
  "entities": {
    "people": ["names of people mentioned"],
    "organizations": ["organizations, companies, institutions"],
    "locations": ["places, cities, countries"],
    "dates": ["important dates mentioned"],
    "numbers": ["significant numbers or statistics"],
    "emails": ["email addresses found"],
    "phones": ["phone numbers found"],
    "urls": ["URLs found"]
  },
  "summary": "A concise 2-3 sentence summary of the document",
  "keyPoints": ["array of 3-7 main points or takeaways"],
  "sentiment": "positive, neutral, or negative",
  "complexity": "simple, moderate, or complex",
  "readingLevel": number (estimated grade level 1-20)
}

`;

    if (title) {
      prompt += `Document Title: ${title}\n\n`;
    }

    prompt += `Document Content:\n${text}\n\n`;

    prompt += `Instructions:
- Extract only the most relevant and significant information
- Be concise but accurate
- For entities, only include those that appear to be significant to the document
- If a field has no relevant data, use an empty array [] or empty string ""
- Ensure the response is valid JSON that can be parsed
- Do not include any text outside the JSON object
`;

    return prompt;
  }

  /**
   * Parse AI response into structured analysis
   */
  private parseAnalysisResponse(response: string): DocumentAnalysis {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize structure
      return {
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        entities: {
          people: Array.isArray(parsed.entities?.people) ? parsed.entities.people : [],
          organizations: Array.isArray(parsed.entities?.organizations) ? parsed.entities.organizations : [],
          locations: Array.isArray(parsed.entities?.locations) ? parsed.entities.locations : [],
          dates: Array.isArray(parsed.entities?.dates) ? parsed.entities.dates : [],
          numbers: Array.isArray(parsed.entities?.numbers) ? parsed.entities.numbers : [],
          emails: Array.isArray(parsed.entities?.emails) ? parsed.entities.emails : [],
          phones: Array.isArray(parsed.entities?.phones) ? parsed.entities.phones : [],
          urls: Array.isArray(parsed.entities?.urls) ? parsed.entities.urls : [],
        },
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary available',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        sentiment: this.normalizeSentiment(parsed.sentiment),
        complexity: this.normalizeComplexity(parsed.complexity),
        readingLevel: typeof parsed.readingLevel === 'number' ? parsed.readingLevel : undefined,
      };
    } catch (error: any) {
      console.error('Failed to parse analysis response:', error);
      console.error('Response:', response);

      // Return default structure on parse error
      return {
        topics: [],
        entities: {
          people: [],
          organizations: [],
          locations: [],
          dates: [],
          numbers: [],
          emails: [],
          phones: [],
          urls: [],
        },
        summary: 'Failed to generate summary',
        keyPoints: [],
        sentiment: 'neutral',
        complexity: 'moderate',
      };
    }
  }

  /**
   * Extract topics only (faster, lighter operation)
   */
  async extractTopics(text: string, count: number = 5): Promise<string[]> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Extract the ${count} most important topics or themes from this document. Return only a JSON array of topics as strings.

Document:
${this.truncateText(text, 10000)}

Return format: ["topic1", "topic2", "topic3", ...]`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const topics = JSON.parse(jsonMatch[0]);
        return Array.isArray(topics) ? topics : [];
      }

      return [];
    } catch (error) {
      console.error('Failed to extract topics:', error);
      return [];
    }
  }

  /**
   * Generate summary only
   */
  async generateSummary(text: string, maxLength: number = 500): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Generate a concise summary of this document in ${maxLength} characters or less.

Document:
${this.truncateText(text)}

Return only the summary text, no additional formatting.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return 'Failed to generate summary';
    }
  }

  /**
   * Extract key points only
   */
  async extractKeyPoints(text: string, count: number = 5): Promise<string[]> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Extract the ${count} most important key points or takeaways from this document. Return only a JSON array of strings.

Document:
${this.truncateText(text, 10000)}

Return format: ["point1", "point2", "point3", ...]`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const points = JSON.parse(jsonMatch[0]);
        return Array.isArray(points) ? points : [];
      }

      return [];
    } catch (error) {
      console.error('Failed to extract key points:', error);
      return [];
    }
  }

  /**
   * Extract entities using regex patterns (fallback for simple extraction)
   */
  private extractEntitiesWithRegex(text: string): DocumentAnalysis['entities'] {
    return {
      people: [],
      organizations: [],
      locations: [],
      dates: this.extractDates(text),
      numbers: this.extractNumbers(text),
      emails: this.extractEmails(text),
      phones: this.extractPhones(text),
      urls: this.extractUrls(text),
    };
  }

  private extractEmails(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return [...new Set(text.match(emailRegex) || [])];
  }

  private extractPhones(text: string): string[] {
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    return [...new Set(text.match(phoneRegex) || [])];
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    return [...new Set(text.match(urlRegex) || [])];
  }

  private extractDates(text: string): string[] {
    const dateRegex = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g;
    return [...new Set(text.match(dateRegex) || [])];
  }

  private extractNumbers(text: string): string[] {
    const numberRegex = /\b\d{1,3}(,\d{3})*(\.\d+)?\b/g;
    const matches = text.match(numberRegex) || [];
    // Filter out dates and phone numbers
    return [...new Set(matches.filter(n => n.length < 15))].slice(0, 20);
  }

  /**
   * Normalize sentiment value
   */
  private normalizeSentiment(value: any): 'positive' | 'neutral' | 'negative' {
    const str = String(value).toLowerCase();
    if (str.includes('positive')) return 'positive';
    if (str.includes('negative')) return 'negative';
    return 'neutral';
  }

  /**
   * Normalize complexity value
   */
  private normalizeComplexity(value: any): 'simple' | 'moderate' | 'complex' {
    const str = String(value).toLowerCase();
    if (str.includes('simple')) return 'simple';
    if (str.includes('complex')) return 'complex';
    return 'moderate';
  }

  /**
   * Truncate text to maximum length
   */
  private truncateText(text: string, maxLength?: number): string {
    const limit = maxLength || this.MAX_TEXT_LENGTH;
    if (text.length <= limit) return text;

    console.warn(`   ⚠️ Text truncated from ${text.length} to ${limit} chars`);
    return text.slice(0, limit) + '...';
  }
}

export default new MetadataEnrichmentService();
