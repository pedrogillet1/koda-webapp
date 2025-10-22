/**
 * Structured Extraction Service
 * Extract structured data from documents using JSON mode
 * - Support JSON schema-based extraction
 * - Extract tables from documents
 * - Entity recognition and extraction
 * - Schema validation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  description?: string;
}

interface ExtractionResult<T = any> {
  data: T;
  confidence: number;
  validationErrors: string[];
  extractionTime: number;
}

interface TableExtractionResult {
  tables: Array<{
    tableNumber: number;
    title?: string;
    headers: string[];
    rows: string[][];
    summary?: string;
  }>;
  totalTables: number;
  extractionTime: number;
}

interface EntityExtractionResult {
  entities: {
    people: Array<{ name: string; context: string; count: number }>;
    organizations: Array<{ name: string; context: string; count: number }>;
    locations: Array<{ name: string; context: string; count: number }>;
    dates: Array<{ date: string; context: string; count: number }>;
    monetary: Array<{ amount: string; context: string; count: number }>;
    custom?: Array<{ type: string; value: string; context: string; count: number }>;
  };
  totalEntities: number;
  extractionTime: number;
}

interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class StructuredExtractionService {
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
   * Extract structured data based on a JSON schema
   */
  async extractWithSchema<T = any>(
    text: string,
    schema: JSONSchema,
    additionalInstructions?: string
  ): Promise<ExtractionResult<T>> {
    const startTime = Date.now();

    console.log('[Structured Extraction] Extracting data with schema...');
    console.log(`   Schema type: ${schema.type}`);
    console.log(`   Text length: ${text.length} chars`);

    const processedText = this.truncateText(text);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

      const prompt = this.buildSchemaExtractionPrompt(processedText, schema, additionalInstructions);

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON response
      const data = this.parseJSONResponse(response);

      // Validate against schema
      const validation = this.validateAgainstSchema(data, schema);

      const extractionTime = Date.now() - startTime;

      console.log(`[Structured Extraction] Completed in ${(extractionTime / 1000).toFixed(2)}s`);
      console.log(`   Valid: ${validation.isValid}`);
      console.log(`   Errors: ${validation.errors.length}`);

      return {
        data: data as T,
        confidence: validation.isValid ? 0.9 : 0.6,
        validationErrors: validation.errors,
        extractionTime,
      };
    } catch (error: any) {
      console.error('[Structured Extraction] Error:', error);
      throw new Error(`Failed to extract structured data: ${error.message}`);
    }
  }

  /**
   * Extract tables from document
   */
  async extractTables(
    text: string,
    options?: {
      includeHeaders?: boolean;
      includeSummary?: boolean;
      maxTables?: number;
    }
  ): Promise<TableExtractionResult> {
    const startTime = Date.now();

    const opts = {
      includeHeaders: options?.includeHeaders !== false,
      includeSummary: options?.includeSummary !== false,
      maxTables: options?.maxTables || 10,
    };

    console.log('[Structured Extraction] Extracting tables...');

    const processedText = this.truncateText(text);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

      const prompt = `Extract all tables from the following document and return them in structured JSON format.

Document:
${processedText}

Instructions:
- Identify all tabular data in the document
- Extract headers and all rows
- Preserve the structure and relationships
- If a table has a title or caption, include it
- If requested, provide a brief summary of what each table contains
- Maximum tables to extract: ${opts.maxTables}

Return a JSON object with this structure:
{
  "tables": [
    {
      "tableNumber": 1,
      "title": "Table title or caption (if present)",
      "headers": ["Column 1", "Column 2", "Column 3"],
      "rows": [
        ["Row 1 Cell 1", "Row 1 Cell 2", "Row 1 Cell 3"],
        ["Row 2 Cell 1", "Row 2 Cell 2", "Row 2 Cell 3"]
      ],
      ${opts.includeSummary ? '"summary": "Brief description of table contents"' : ''}
    }
  ]
}

Return only valid JSON, no additional text.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const parsed = this.parseJSONResponse(response);

      const tables = Array.isArray(parsed.tables) ? parsed.tables : [];

      const extractionTime = Date.now() - startTime;

      console.log(`[Structured Extraction] Extracted ${tables.length} tables in ${(extractionTime / 1000).toFixed(2)}s`);

      return {
        tables,
        totalTables: tables.length,
        extractionTime,
      };
    } catch (error: any) {
      console.error('[Structured Extraction] Error extracting tables:', error);
      throw new Error(`Failed to extract tables: ${error.message}`);
    }
  }

  /**
   * Extract entities from document with context
   */
  async extractEntities(
    text: string,
    options?: {
      entityTypes?: string[]; // Custom entity types to extract
      includeContext?: boolean;
      minMentions?: number; // Minimum mentions to include entity
    }
  ): Promise<EntityExtractionResult> {
    const startTime = Date.now();

    const opts = {
      entityTypes: options?.entityTypes || [],
      includeContext: options?.includeContext !== false,
      minMentions: options?.minMentions || 1,
    };

    console.log('[Structured Extraction] Extracting entities...');

    const processedText = this.truncateText(text);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

      const customEntitiesSection = opts.entityTypes.length > 0
        ? `,
    "custom": [
      {
        "type": "entity type from: ${opts.entityTypes.join(', ')}",
        "value": "entity value",
        "context": "surrounding text for context",
        "count": number of mentions
      }
    ]`
        : '';

      const prompt = `Extract all significant entities from the following document with their context.

Document:
${processedText}

Instructions:
- Extract people, organizations, locations, dates, and monetary values
${opts.entityTypes.length > 0 ? `- Also extract these custom entity types: ${opts.entityTypes.join(', ')}` : ''}
- Include a brief context snippet (10-20 words) showing how each entity is used
- Count the number of times each entity appears
- Only include entities mentioned at least ${opts.minMentions} time(s)
- Be selective - only include entities that are significant to the document

Return a JSON object with this structure:
{
  "entities": {
    "people": [
      {
        "name": "Person Name",
        "context": "context where they appear",
        "count": number of mentions
      }
    ],
    "organizations": [
      {
        "name": "Organization Name",
        "context": "context where it appears",
        "count": number of mentions
      }
    ],
    "locations": [
      {
        "name": "Location Name",
        "context": "context where it appears",
        "count": number of mentions
      }
    ],
    "dates": [
      {
        "date": "Date or time reference",
        "context": "context where it appears",
        "count": number of mentions
      }
    ],
    "monetary": [
      {
        "amount": "Dollar amount or financial figure",
        "context": "context where it appears",
        "count": number of mentions
      }
    ]${customEntitiesSection}
  }
}

Return only valid JSON, no additional text.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const parsed = this.parseJSONResponse(response);

      const entities = {
        people: Array.isArray(parsed.entities?.people) ? parsed.entities.people : [],
        organizations: Array.isArray(parsed.entities?.organizations) ? parsed.entities.organizations : [],
        locations: Array.isArray(parsed.entities?.locations) ? parsed.entities.locations : [],
        dates: Array.isArray(parsed.entities?.dates) ? parsed.entities.dates : [],
        monetary: Array.isArray(parsed.entities?.monetary) ? parsed.entities.monetary : [],
        custom: Array.isArray(parsed.entities?.custom) ? parsed.entities.custom : undefined,
      };

      const totalEntities = Object.values(entities).reduce(
        (sum, arr) => sum + (arr ? arr.length : 0),
        0
      );

      const extractionTime = Date.now() - startTime;

      console.log(`[Structured Extraction] Extracted ${totalEntities} entities in ${(extractionTime / 1000).toFixed(2)}s`);
      console.log(`   People: ${entities.people.length}`);
      console.log(`   Organizations: ${entities.organizations.length}`);
      console.log(`   Locations: ${entities.locations.length}`);
      console.log(`   Dates: ${entities.dates.length}`);
      console.log(`   Monetary: ${entities.monetary.length}`);

      return {
        entities,
        totalEntities,
        extractionTime,
      };
    } catch (error: any) {
      console.error('[Structured Extraction] Error extracting entities:', error);
      throw new Error(`Failed to extract entities: ${error.message}`);
    }
  }

  /**
   * Extract data into a predefined structure (convenience method)
   */
  async extractStructure<T = any>(
    text: string,
    structureDescription: string,
    exampleOutput?: any
  ): Promise<ExtractionResult<T>> {
    const startTime = Date.now();

    console.log('[Structured Extraction] Extracting with structure description...');

    const processedText = this.truncateText(text);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

      const prompt = `Extract information from the following document according to the specified structure.

Document:
${processedText}

Desired Structure:
${structureDescription}

${exampleOutput ? `Example Output Format:\n${JSON.stringify(exampleOutput, null, 2)}\n` : ''}

Instructions:
- Extract all relevant information that matches the structure
- Return data in valid JSON format
- Use null for missing values
- Be precise and accurate
- Follow the example format if provided

Return only valid JSON, no additional text.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const data = this.parseJSONResponse(response);

      const extractionTime = Date.now() - startTime;

      console.log(`[Structured Extraction] Completed in ${(extractionTime / 1000).toFixed(2)}s`);

      return {
        data: data as T,
        confidence: 0.85,
        validationErrors: [],
        extractionTime,
      };
    } catch (error: any) {
      console.error('[Structured Extraction] Error extracting structure:', error);
      throw new Error(`Failed to extract structure: ${error.message}`);
    }
  }

  /**
   * Build extraction prompt from JSON schema
   */
  private buildSchemaExtractionPrompt(
    text: string,
    schema: JSONSchema,
    additionalInstructions?: string
  ): string {
    const schemaString = JSON.stringify(schema, null, 2);

    let prompt = `Extract structured data from the following document according to the provided JSON schema.

Document:
${text}

JSON Schema:
${schemaString}

Instructions:
- Extract data that matches the schema structure
- Follow the schema types and constraints
- Required fields must be included
- Use appropriate data types (string, number, boolean, array, object)
- Return valid JSON that conforms to the schema
- Use null for optional fields that are not present
${additionalInstructions ? `\nAdditional Instructions:\n${additionalInstructions}` : ''}

Return only valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * Parse JSON from AI response
   */
  private parseJSONResponse(response: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error: any) {
      console.error('Failed to parse JSON response:', error);
      console.error('Response:', response.substring(0, 500));
      throw new Error('Failed to parse JSON response from AI');
    }
  }

  /**
   * Validate data against JSON schema (basic validation)
   */
  private validateAgainstSchema(
    data: any,
    schema: JSONSchema
  ): SchemaValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check type
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      if (schema.type && dataType !== schema.type) {
        errors.push(`Type mismatch: expected ${schema.type}, got ${dataType}`);
      }

      // Check required fields
      if (schema.required && schema.type === 'object') {
        for (const field of schema.required) {
          if (!(field in data) || data[field] === undefined || data[field] === null) {
            errors.push(`Required field missing: ${field}`);
          }
        }
      }

      // Check properties types
      if (schema.properties && schema.type === 'object') {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            const propType = Array.isArray(data[key]) ? 'array' : typeof data[key];
            if (propSchema.type && propType !== propSchema.type && data[key] !== null) {
              errors.push(`Field '${key}': expected ${propSchema.type}, got ${propType}`);
            }
          }
        }
      }

      // Check array items
      if (schema.type === 'array' && schema.items && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const itemType = Array.isArray(data[i]) ? 'array' : typeof data[i];
          if (schema.items.type && itemType !== schema.items.type) {
            warnings.push(`Array item ${i}: expected ${schema.items.type}, got ${itemType}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [`Schema validation error: ${error.message}`],
        warnings,
      };
    }
  }

  /**
   * Truncate text to maximum length
   */
  private truncateText(text: string, maxLength?: number): string {
    const limit = maxLength || this.MAX_TEXT_LENGTH;
    if (text.length <= limit) return text;

    console.warn(`   Text truncated from ${text.length} to ${limit} chars`);
    return text.slice(0, limit) + '...';
  }
}

export default new StructuredExtractionService();
