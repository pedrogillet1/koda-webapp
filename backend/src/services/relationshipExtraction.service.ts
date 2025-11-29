/**
 * Relationship Extraction Service
 *
 * Extracts entities and relationships from documents to build knowledge graphs.
 * Supports entity recognition, relationship detection, and graph construction.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { retryWithBackoff } from '../utils/retryUtils';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  attributes: Record<string, any>;
  mentions: EntityMention[];
  confidence: number;
}

export interface EntityMention {
  text: string;
  startOffset: number;
  endOffset: number;
  context: string;
}

export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'DATE'
  | 'MONEY'
  | 'PERCENTAGE'
  | 'PRODUCT'
  | 'EVENT'
  | 'DOCUMENT'
  | 'CONCEPT'
  | 'REGULATION'
  | 'ACCOUNT'
  | 'TRANSACTION'
  | 'ASSET'
  | 'LIABILITY'
  | 'METRIC'
  | 'OTHER';

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  label: string;
  attributes: Record<string, any>;
  evidence: string[];
  confidence: number;
}

export type RelationType =
  | 'OWNS'
  | 'EMPLOYS'
  | 'REPORTS_TO'
  | 'LOCATED_IN'
  | 'PART_OF'
  | 'RELATED_TO'
  | 'ACQUIRED'
  | 'INVESTED_IN'
  | 'COMPETES_WITH'
  | 'PARTNER_OF'
  | 'SIGNED'
  | 'AMENDED'
  | 'REFERENCES'
  | 'DEPENDS_ON'
  | 'AFFECTS'
  | 'INCREASED'
  | 'DECREASED'
  | 'EQUALS'
  | 'OTHER';

export interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
  document_metadata: {
    documentId?: string;
    extractedAt: Date;
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<EntityType, number>;
    relationshipTypes: Record<RelationType, number>;
  };
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract context around a mention
 */
function extractContext(text: string, start: number, end: number, windowSize: number = 100): string {
  const contextStart = Math.max(0, start - windowSize);
  const contextEnd = Math.min(text.length, end + windowSize);
  return text.slice(contextStart, contextEnd);
}

/**
 * Rule-based entity extraction for common patterns
 */
function extractRuleBasedEntities(text: string): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // Money patterns
  const moneyPatterns = [
    /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion|M|B|K))?/gi,
    /(?:USD|EUR|GBP|BRL|R\$)\s*[\d,]+(?:\.\d{2})?/gi,
    /[\d,]+(?:\.\d{2})?\s*(?:dollars|euros|reais)/gi,
  ];

  for (const pattern of moneyPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[0].trim();
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        entities.push({
          id: generateId('ent'),
          name,
          type: 'MONEY',
          aliases: [],
          attributes: { value: name },
          mentions: [{
            text: name,
            startOffset: match.index,
            endOffset: match.index + name.length,
            context: extractContext(text, match.index, match.index + name.length)
          }],
          confidence: 0.95
        });
      }
    }
  }

  // Percentage patterns
  const percentagePattern = /\d+(?:\.\d+)?%/g;
  let match;
  while ((match = percentagePattern.exec(text)) !== null) {
    const name = match[0];
    if (!seen.has(name)) {
      seen.add(name);
      entities.push({
        id: generateId('ent'),
        name,
        type: 'PERCENTAGE',
        aliases: [],
        attributes: { value: parseFloat(name) },
        mentions: [{
          text: name,
          startOffset: match.index,
          endOffset: match.index + name.length,
          context: extractContext(text, match.index, match.index + name.length)
        }],
        confidence: 0.95
      });
    }
  }

  // Date patterns
  const datePatterns = [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b(?:Q[1-4]|FY)\s*\d{4}\b/gi,
  ];

  for (const pattern of datePatterns) {
    while ((match = pattern.exec(text)) !== null) {
      const name = match[0].trim();
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        entities.push({
          id: generateId('ent'),
          name,
          type: 'DATE',
          aliases: [],
          attributes: {},
          mentions: [{
            text: name,
            startOffset: match.index,
            endOffset: match.index + name.length,
            context: extractContext(text, match.index, match.index + name.length)
          }],
          confidence: 0.9
        });
      }
    }
  }

  // Common organization suffixes
  const orgPattern = /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Inc\.|Corp\.|LLC|Ltd\.|LLP|Company|Corporation|Group|Holdings|Partners|Associates|Bank|Insurance|Fund)\b/g;
  while ((match = orgPattern.exec(text)) !== null) {
    const name = match[0].trim();
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      entities.push({
        id: generateId('ent'),
        name,
        type: 'ORGANIZATION',
        aliases: [],
        attributes: {},
        mentions: [{
          text: name,
          startOffset: match.index,
          endOffset: match.index + name.length,
          context: extractContext(text, match.index, match.index + name.length)
        }],
        confidence: 0.85
      });
    }
  }

  return entities;
}

/**
 * Use LLM to extract entities and relationships
 */
async function extractWithLLM(
  text: string,
  existingEntities: Entity[] = [],
  domain?: string
): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const existingEntityNames = existingEntities.map(e => e.name).join(', ');

  const prompt = `Analyze the following text and extract:
1. Named entities (people, organizations, locations, dates, monetary values, concepts)
2. Relationships between entities

${domain ? `Domain context: ${domain}` : ''}
${existingEntityNames ? `Already identified entities: ${existingEntityNames}` : ''}

Text to analyze:
"""
${text.slice(0, 4000)}
"""

Respond in JSON format:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "PERSON|ORGANIZATION|LOCATION|DATE|MONEY|PERCENTAGE|PRODUCT|EVENT|DOCUMENT|CONCEPT|REGULATION|ACCOUNT|METRIC|OTHER",
      "aliases": ["other names"],
      "attributes": {}
    }
  ],
  "relationships": [
    {
      "source": "Entity Name 1",
      "target": "Entity Name 2",
      "type": "OWNS|EMPLOYS|REPORTS_TO|LOCATED_IN|PART_OF|RELATED_TO|ACQUIRED|INVESTED_IN|COMPETES_WITH|PARTNER_OF|SIGNED|AMENDED|REFERENCES|DEPENDS_ON|AFFECTS|INCREASED|DECREASED|EQUALS|OTHER",
      "label": "description of relationship",
      "evidence": "quote from text supporting this"
    }
  ]
}

Only include entities and relationships you can clearly identify from the text. Be precise.`;

  try {
    const result = await retryWithBackoff(async () => {
      const response = await model.generateContent(prompt);
      return response.response.text();
    });

    // Parse JSON response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[RELATIONSHIP] Could not parse LLM response');
      return { entities: [], relationships: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    // Process entities
    if (Array.isArray(parsed.entities)) {
      for (const e of parsed.entities) {
        entities.push({
          id: generateId('ent'),
          name: e.name || 'Unknown',
          type: e.type || 'OTHER',
          aliases: e.aliases || [],
          attributes: e.attributes || {},
          mentions: [],
          confidence: 0.7
        });
      }
    }

    // Process relationships
    if (Array.isArray(parsed.relationships)) {
      for (const r of parsed.relationships) {
        // Find source and target entities
        const sourceEntity = [...existingEntities, ...entities].find(
          e => e.name.toLowerCase() === r.source?.toLowerCase()
        );
        const targetEntity = [...existingEntities, ...entities].find(
          e => e.name.toLowerCase() === r.target?.toLowerCase()
        );

        if (sourceEntity && targetEntity) {
          relationships.push({
            id: generateId('rel'),
            sourceId: sourceEntity.id,
            targetId: targetEntity.id,
            type: r.type || 'RELATED_TO',
            label: r.label || '',
            attributes: {},
            evidence: r.evidence ? [r.evidence] : [],
            confidence: 0.7
          });
        }
      }
    }

    return { entities, relationships };
  } catch (error) {
    console.error('[RELATIONSHIP] LLM extraction failed:', error);
    return { entities: [], relationships: [] };
  }
}

/**
 * Merge duplicate entities
 */
function mergeEntities(entities: Entity[]): Entity[] {
  const merged: Map<string, Entity> = new Map();

  for (const entity of entities) {
    const key = entity.name.toLowerCase();

    if (merged.has(key)) {
      // Merge with existing
      const existing = merged.get(key)!;
      existing.mentions.push(...entity.mentions);
      existing.aliases.push(...entity.aliases);
      existing.aliases = [...new Set(existing.aliases)];
      existing.confidence = Math.max(existing.confidence, entity.confidence);

      // Merge attributes
      existing.attributes = { ...existing.attributes, ...entity.attributes };
    } else {
      merged.set(key, { ...entity });
    }
  }

  return Array.from(merged.values());
}

/**
 * Find entity mentions in text and update offsets
 */
function findMentions(text: string, entities: Entity[]): Entity[] {
  for (const entity of entities) {
    // Search for entity name and aliases
    const searchTerms = [entity.name, ...entity.aliases];

    for (const term of searchTerms) {
      if (term.length < 2) continue;

      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Check if we already have this mention
        const alreadyExists = entity.mentions.some(
          m => m.startOffset === match!.index
        );

        if (!alreadyExists) {
          entity.mentions.push({
            text: match[0],
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            context: extractContext(text, match.index, match.index + match[0].length)
          });
        }
      }
    }
  }

  return entities;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main function to extract entities and relationships
 */
export async function extractRelationships(
  text: string,
  options: {
    domain?: string;
    useLLM?: boolean;
    chunkSize?: number;
    documentId?: string;
  } = {}
): Promise<KnowledgeGraph> {
  const {
    domain,
    useLLM = true,
    chunkSize = 4000,
    documentId
  } = options;

  console.log(`[RELATIONSHIP] Starting extraction for document ${documentId || 'unknown'}`);

  // Step 1: Rule-based extraction
  let entities = extractRuleBasedEntities(text);
  console.log(`[RELATIONSHIP] Rule-based extraction found ${entities.length} entities`);

  // Step 2: LLM-based extraction (if enabled)
  let relationships: Relationship[] = [];

  if (useLLM) {
    // Process text in chunks
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    console.log(`[RELATIONSHIP] Processing ${chunks.length} chunks with LLM`);

    for (let i = 0; i < Math.min(chunks.length, 5); i++) {
      const chunk = chunks[i];
      try {
        const llmResult = await extractWithLLM(chunk, entities, domain);
        entities.push(...llmResult.entities);
        relationships.push(...llmResult.relationships);
      } catch (error) {
        console.error(`[RELATIONSHIP] LLM extraction failed for chunk ${i}:`, error);
      }
    }
  }

  // Step 3: Merge duplicate entities
  entities = mergeEntities(entities);
  console.log(`[RELATIONSHIP] After merge: ${entities.length} entities`);

  // Step 4: Find all mentions in text
  entities = findMentions(text, entities);

  // Step 5: Build metadata
  const entityTypeCounts = {} as Record<EntityType, number>;
  const relationshipTypeCounts = {} as Record<RelationType, number>;

  for (const entity of entities) {
    entityTypeCounts[entity.type] = (entityTypeCounts[entity.type] || 0) + 1;
  }

  for (const rel of relationships) {
    relationshipTypeCounts[rel.type] = (relationshipTypeCounts[rel.type] || 0) + 1;
  }

  const graph: KnowledgeGraph = {
    entities,
    relationships,
    document_metadata: {
      documentId,
      extractedAt: new Date(),
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entityTypes: entityTypeCounts,
      relationshipTypes: relationshipTypeCounts
    }
  };

  console.log(`[RELATIONSHIP] Extraction complete: ${entities.length} entities, ${relationships.length} relationships`);

  return graph;
}

/**
 * Get entities by type
 */
export function getEntitiesByType(
  graph: KnowledgeGraph,
  type: EntityType
): Entity[] {
  return graph.entities.filter(e => e.type === type);
}

/**
 * Get relationships for an entity
 */
export function getEntityRelationships(
  graph: KnowledgeGraph,
  entityId: string
): { incoming: Relationship[]; outgoing: Relationship[] } {
  return {
    incoming: graph.relationships.filter(r => r.targetId === entityId),
    outgoing: graph.relationships.filter(r => r.sourceId === entityId)
  };
}

/**
 * Get related entities (neighbors in graph)
 */
export function getRelatedEntities(
  graph: KnowledgeGraph,
  entityId: string
): Entity[] {
  const relatedIds = new Set<string>();

  for (const rel of graph.relationships) {
    if (rel.sourceId === entityId) {
      relatedIds.add(rel.targetId);
    } else if (rel.targetId === entityId) {
      relatedIds.add(rel.sourceId);
    }
  }

  return graph.entities.filter(e => relatedIds.has(e.id));
}

/**
 * Find entities by name (fuzzy match)
 */
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  fuzzy: boolean = true
): Entity | undefined {
  const normalizedName = name.toLowerCase();

  // Exact match first
  let entity = graph.entities.find(
    e => e.name.toLowerCase() === normalizedName ||
         e.aliases.some(a => a.toLowerCase() === normalizedName)
  );

  // Fuzzy match if not found
  if (!entity && fuzzy) {
    entity = graph.entities.find(
      e => e.name.toLowerCase().includes(normalizedName) ||
           normalizedName.includes(e.name.toLowerCase()) ||
           e.aliases.some(a =>
             a.toLowerCase().includes(normalizedName) ||
             normalizedName.includes(a.toLowerCase())
           )
    );
  }

  return entity;
}

/**
 * Merge two knowledge graphs
 */
export function mergeGraphs(
  graph1: KnowledgeGraph,
  graph2: KnowledgeGraph
): KnowledgeGraph {
  // Merge entities
  const allEntities = [...graph1.entities, ...graph2.entities];
  const mergedEntities = mergeEntities(allEntities);

  // Build entity ID mapping for relationship updates
  const entityIdMap = new Map<string, string>();
  for (const oldEntity of [...graph1.entities, ...graph2.entities]) {
    const newEntity = mergedEntities.find(
      e => e.name.toLowerCase() === oldEntity.name.toLowerCase()
    );
    if (newEntity) {
      entityIdMap.set(oldEntity.id, newEntity.id);
    }
  }

  // Merge relationships with updated IDs
  const allRelationships: Relationship[] = [];
  const seenRelationships = new Set<string>();

  for (const rel of [...graph1.relationships, ...graph2.relationships]) {
    const newSourceId = entityIdMap.get(rel.sourceId) || rel.sourceId;
    const newTargetId = entityIdMap.get(rel.targetId) || rel.targetId;
    const key = `${newSourceId}-${rel.type}-${newTargetId}`;

    if (!seenRelationships.has(key)) {
      seenRelationships.add(key);
      allRelationships.push({
        ...rel,
        sourceId: newSourceId,
        targetId: newTargetId
      });
    }
  }

  // Rebuild metadata
  const entityTypeCounts = {} as Record<EntityType, number>;
  const relationshipTypeCounts = {} as Record<RelationType, number>;

  for (const entity of mergedEntities) {
    entityTypeCounts[entity.type] = (entityTypeCounts[entity.type] || 0) + 1;
  }

  for (const rel of allRelationships) {
    relationshipTypeCounts[rel.type] = (relationshipTypeCounts[rel.type] || 0) + 1;
  }

  return {
    entities: mergedEntities,
    relationships: allRelationships,
    document_metadata: {
      extractedAt: new Date(),
      totalEntities: mergedEntities.length,
      totalRelationships: allRelationships.length,
      entityTypes: entityTypeCounts,
      relationshipTypes: relationshipTypeCounts
    }
  };
}

/**
 * Export graph to simple format for visualization
 */
export function exportForVisualization(graph: KnowledgeGraph): {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
} {
  return {
    nodes: graph.entities.map(e => ({
      id: e.id,
      label: e.name,
      type: e.type
    })),
    edges: graph.relationships.map(r => ({
      source: r.sourceId,
      target: r.targetId,
      label: r.label || r.type
    }))
  };
}

/**
 * Get graph summary as text
 */
export function getGraphSummary(graph: KnowledgeGraph): string {
  const lines: string[] = [];

  lines.push(`Knowledge Graph Summary`);
  lines.push(`=======================`);
  lines.push(`Total Entities: ${graph.document_metadata.totalEntities}`);
  lines.push(`Total Relationships: ${graph.document_metadata.totalRelationships}`);

  lines.push(`\nEntity Types:`);
  for (const [type, count] of Object.entries(graph.document_metadata.entityTypes)) {
    lines.push(`  - ${type}: ${count}`);
  }

  if (Object.keys(graph.document_metadata.relationshipTypes).length > 0) {
    lines.push(`\nRelationship Types:`);
    for (const [type, count] of Object.entries(graph.document_metadata.relationshipTypes)) {
      lines.push(`  - ${type}: ${count}`);
    }
  }

  lines.push(`\nTop Entities:`);
  const sortedEntities = [...graph.entities]
    .sort((a, b) => b.mentions.length - a.mentions.length)
    .slice(0, 10);

  for (const entity of sortedEntities) {
    lines.push(`  - ${entity.name} (${entity.type}): ${entity.mentions.length} mentions`);
  }

  return lines.join('\n');
}

export default {
  extractRelationships,
  getEntitiesByType,
  getEntityRelationships,
  getRelatedEntities,
  findEntityByName,
  mergeGraphs,
  exportForVisualization,
  getGraphSummary
};
