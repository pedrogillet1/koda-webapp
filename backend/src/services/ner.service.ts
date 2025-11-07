/**
 * Named Entity Recognition (NER) Service - Phase 3 Week 9-10
 * Extracts entities from documents and enables auto-tagging
 * Makes KODA aware of people, organizations, dates, amounts in documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Entity {
  type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone' | 'url' | 'product' | 'other';
  value: string;
  normalizedValue: string;
  confidence: number;
  context?: string;
  pageNumber?: number;
}

export interface EntityExtractionResult {
  entities: Entity[];
  suggestedTags: string[];
  documentType?: string;
  keyTopics?: string[];
}

class NERService {
  /**
   * Extract entities from document text using Gemini AI
   */
  async extractEntities(
    text: string,
    documentName: string
  ): Promise<EntityExtractionResult> {
    console.log(`🔍 NER: Extracting entities from "${documentName}"`);

    // Truncate text if too long (Gemini has token limits)
    const maxChars = 15000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

    const prompt = `Analyze the following document and extract all named entities.

Document: ${documentName}

Content:
${truncatedText}

Extract the following information in JSON format:
{
  "entities": [
    {
      "type": "person|organization|location|date|amount|email|phone|url|product|other",
      "value": "exact text from document",
      "normalizedValue": "normalized form (e.g., dates as ISO, amounts as numbers)",
      "confidence": 0.0-1.0,
      "context": "surrounding text for context"
    }
  ],
  "documentType": "invoice|contract|resume|report|presentation|spreadsheet|legal|financial|personal|other",
  "keyTopics": ["main topic 1", "main topic 2", "main topic 3"],
  "suggestedTags": ["tag1", "tag2", "tag3"]
}

Focus on:
1. **People**: Names of individuals mentioned
2. **Organizations**: Company names, institutions
3. **Locations**: Cities, countries, addresses
4. **Dates**: Important dates, deadlines, events
5. **Amounts**: Monetary values, quantities, percentages
6. **Contact Info**: Emails, phone numbers, URLs
7. **Products**: Product names, services mentioned

Return ONLY the JSON object, no additional text.`;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.2, // Low temperature for factual extraction
        }
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response with better error handling
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`⚠️ NER: Failed to extract JSON from Gemini response`);
        return {
          entities: [],
          suggestedTags: [],
          keyTopics: []
        };
      }

      let extracted;
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn(`⚠️ NER: JSON parsing failed, attempting to fix common issues...`);
        // Try to fix common JSON issues (trailing commas, missing quotes, etc.)
        try {
          // Remove trailing commas before closing brackets/braces
          const fixedJson = jsonMatch[0]
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/\n/g, ' ')
            .trim();
          extracted = JSON.parse(fixedJson);
          console.log(`✅ NER: JSON fixed and parsed successfully`);
        } catch (fixError) {
          console.error(`❌ NER: Entity extraction failed:`, fixError);
          return {
            entities: [],
            suggestedTags: [],
            keyTopics: []
          };
        }
      }
      console.log(`   ✅ Extracted ${extracted.entities?.length || 0} entities`);
      console.log(`   📊 Document Type: ${extracted.documentType || 'unknown'}`);
      console.log(`   🏷️  Suggested Tags: ${extracted.suggestedTags?.join(', ') || 'none'}`);

      return {
        entities: extracted.entities || [],
        suggestedTags: extracted.suggestedTags || [],
        documentType: extracted.documentType,
        keyTopics: extracted.keyTopics || []
      };
    } catch (error) {
      console.error(`❌ NER: Entity extraction failed:`, error);
      return {
        entities: [],
        suggestedTags: [],
        keyTopics: []
      };
    }
  }

  /**
   * Extract entities using simple regex patterns (fallback method)
   */
  extractEntitiesSimple(text: string): Entity[] {
    const entities: Entity[] = [];

    // Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        normalizedValue: match[0].toLowerCase(),
        confidence: 1.0,
        context: this.getContext(text, match.index, 50)
      });
    }

    // Phone pattern (various formats)
    const phoneRegex = /\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        type: 'phone',
        value: match[0],
        normalizedValue: match[0].replace(/[^\d]/g, ''),
        confidence: 0.9,
        context: this.getContext(text, match.index, 50)
      });
    }

    // URL pattern
    const urlRegex = /https?:\/\/[^\s]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      entities.push({
        type: 'url',
        value: match[0],
        normalizedValue: match[0],
        confidence: 1.0,
        context: this.getContext(text, match.index, 50)
      });
    }

    // Amount pattern (currency)
    const amountRegex = /\$\s*[\d,]+(?:\.\d{2})?|\€\s*[\d,]+(?:\.\d{2})?|R\$\s*[\d,]+(?:\.\d{2})?/g;
    while ((match = amountRegex.exec(text)) !== null) {
      entities.push({
        type: 'amount',
        value: match[0],
        normalizedValue: match[0].replace(/[^\d.]/g, ''),
        confidence: 0.95,
        context: this.getContext(text, match.index, 50)
      });
    }

    // Date pattern (ISO format)
    const dateRegex = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/g;
    while ((match = dateRegex.exec(text)) !== null) {
      entities.push({
        type: 'date',
        value: match[0],
        normalizedValue: this.normalizeDate(match[0]),
        confidence: 0.9,
        context: this.getContext(text, match.index, 50)
      });
    }

    return entities;
  }

  /**
   * Get surrounding context for an entity
   */
  private getContext(text: string, index: number, contextLength: number): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return text.substring(start, end).trim();
  }

  /**
   * Normalize date to ISO format
   */
  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * Generate tags based on entities and content
   */
  async generateTags(
    entities: Entity[],
    documentName: string,
    documentType?: string
  ): Promise<string[]> {
    const tags: Set<string> = new Set();

    // Add document type as tag
    if (documentType && documentType !== 'other') {
      tags.add(documentType);
    }

    // Add tags based on entity types
    const entityTypes = new Set(entities.map(e => e.type));

    if (entityTypes.has('person')) {
      tags.add('people');
    }
    if (entityTypes.has('organization')) {
      tags.add('business');
    }
    if (entityTypes.has('amount')) {
      tags.add('financial');
    }
    if (entityTypes.has('date')) {
      tags.add('time-sensitive');
    }
    if (entityTypes.has('location')) {
      tags.add('geographic');
    }

    // Add tags based on filename
    const filenameLower = documentName.toLowerCase();
    if (filenameLower.includes('contract')) tags.add('contract');
    if (filenameLower.includes('invoice')) tags.add('invoice');
    if (filenameLower.includes('receipt')) tags.add('receipt');
    if (filenameLower.includes('resume') || filenameLower.includes('cv')) tags.add('resume');
    if (filenameLower.includes('report')) tags.add('report');
    if (filenameLower.includes('presentation')) tags.add('presentation');
    if (filenameLower.includes('proposal')) tags.add('proposal');
    if (filenameLower.includes('agreement')) tags.add('agreement');

    return Array.from(tags);
  }

  /**
   * Auto-tag document based on entities and content
   */
  async autoTagDocument(
    userId: string,
    documentId: string,
    entities: Entity[],
    suggestedTags: string[]
  ): Promise<void> {
    console.log(`🏷️  Auto-tagging document ${documentId}`);

    // Get document info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { filename: true }
    });

    if (!document) {
      console.warn(`⚠️ Document ${documentId} not found for auto-tagging`);
      return;
    }

    // Generate tags
    const generatedTags = await this.generateTags(entities, document.filename);
    const allTags = [...new Set([...generatedTags, ...suggestedTags])];

    console.log(`   Generated tags: ${allTags.join(', ')}`);

    // Create or find tags
    for (const tagName of allTags) {
      try {
        // Find or create tag
        let tag = await prisma.tag.findFirst({
          where: {
            userId,
            name: tagName
          }
        });

        if (!tag) {
          // Create new tag
          tag = await prisma.tag.create({
            data: {
              userId,
              name: tagName,
              color: this.getTagColor(tagName)
            }
          });
        }

        // Associate tag with document (if not already associated)
        await prisma.documentTag.upsert({
          where: {
            documentId_tagId: {
              documentId,
              tagId: tag.id
            }
          },
          create: {
            documentId,
            tagId: tag.id
          },
          update: {}
        });

        console.log(`   ✅ Tagged with: ${tagName}`);
      } catch (error) {
        console.error(`   ❌ Failed to tag with "${tagName}":`, error);
      }
    }
  }

  /**
   * Get color for tag based on tag name
   */
  private getTagColor(tagName: string): string {
    const colorMap: Record<string, string> = {
      'financial': '#10b981',
      'invoice': '#3b82f6',
      'contract': '#8b5cf6',
      'legal': '#6366f1',
      'personal': '#ec4899',
      'business': '#f59e0b',
      'report': '#14b8a6',
      'presentation': '#f97316',
      'time-sensitive': '#ef4444',
      'people': '#06b6d4',
      'geographic': '#84cc16'
    };

    return colorMap[tagName.toLowerCase()] || '#6b7280';
  }

  /**
   * Store entities in database for quick retrieval
   */
  async storeEntities(
    documentId: string,
    entities: Entity[]
  ): Promise<void> {
    console.log(`💾 Storing ${entities.length} entities for document ${documentId}`);

    for (const entity of entities) {
      try {
        await prisma.documentEntity.create({
          data: {
            documentId,
            entityType: entity.type,
            value: entity.value,
            normalizedValue: entity.normalizedValue,
            pageNumber: entity.pageNumber || 0,
            textIndex: 0,
            context: entity.context || '',
            metadata: JSON.stringify({
              confidence: entity.confidence
            })
          }
        });
      } catch (error) {
        // Ignore duplicates
        if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
          console.error(`   ❌ Failed to store entity:`, error);
        }
      }
    }

    console.log(`   ✅ Entities stored in database`);
  }

  /**
   * Search for entities across documents
   */
  async searchEntities(
    userId: string,
    entityType: string,
    searchValue: string
  ): Promise<Array<{ documentId: string; documentName: string; entity: Entity }>> {
    const results = await prisma.documentEntity.findMany({
      where: {
        entityType,
        normalizedValue: {
          contains: searchValue
        }
      },
      take: 50
    });

    // Get unique document IDs
    const documentIds = [...new Set(results.map(r => r.documentId))];

    // Fetch documents separately to get filenames and filter by userId
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId
      },
      select: {
        id: true,
        filename: true
      }
    });

    // Create a map of documentId to filename
    const docMap = new Map(documents.map(d => [d.id, d.filename]));

    // Filter results to only include documents owned by this user
    return results
      .filter(r => docMap.has(r.documentId))
      .map(r => ({
        documentId: r.documentId,
        documentName: docMap.get(r.documentId) || 'Unknown',
        entity: {
          type: r.entityType as any,
          value: r.value,
          normalizedValue: r.normalizedValue,
          confidence: 0.9,
          context: r.context,
          pageNumber: r.pageNumber
        }
      }));
  }
}

export const nerService = new NERService();
export default nerService;
