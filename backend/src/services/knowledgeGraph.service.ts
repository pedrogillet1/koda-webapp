/**
 * Knowledge Graph Service
 * Extract entity relationships and build knowledge graph
 * - Entity extraction from documents
 * - Relationship identification
 * - Graph construction
 * - Graph-based queries
 * - Visualization data generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'event' | 'other';
  mentions: number;
  importance: number; // 0-1 score
}

interface Relationship {
  id: string;
  source: string; // Entity ID
  target: string; // Entity ID
  type: string; // e.g., "works_for", "located_in", "related_to"
  strength: number; // 0-1 confidence score
  context: string; // Brief context where relationship was found
}

interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
  documentId: string;
  createdAt: Date;
  metadata: {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  };
}

interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  relevanceScore: number;
}

class KnowledgeGraphService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL_NAME = 'gemini-2.5-pro';
  private readonly MAX_TEXT_LENGTH = 20000;

  // In-memory graph storage (in production, use a graph database like Neo4j)
  private graphs: Map<string, KnowledgeGraph> = new Map();

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Extract entities and relationships from document
   */
  async buildKnowledgeGraph(
    documentId: string,
    text: string,
    title?: string
  ): Promise<KnowledgeGraph> {
    console.log('🕸️ [Knowledge Graph] Building knowledge graph...');

    try {
      // Extract entities and relationships using Gemini
      const extracted = await this.extractEntitiesAndRelationships(text, title);

      // Build graph structure
      const graph: KnowledgeGraph = {
        entities: extracted.entities,
        relationships: extracted.relationships,
        documentId,
        createdAt: new Date(),
        metadata: this.calculateMetadata(extracted.entities, extracted.relationships),
      };

      // Store graph
      this.graphs.set(documentId, graph);

      console.log(`✅ [Knowledge Graph] Built graph with ${graph.entities.length} entities and ${graph.relationships.length} relationships`);

      return graph;
    } catch (error: any) {
      console.error('❌ [Knowledge Graph] Error:', error);
      throw new Error(`Failed to build knowledge graph: ${error.message}`);
    }
  }

  /**
   * Extract entities and relationships using Gemini AI
   */
  private async extractEntitiesAndRelationships(
    text: string,
    title?: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = this.buildExtractionPrompt(text, title);

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse structured response
    const parsed = this.parseExtractionResponse(response);

    return parsed;
  }

  /**
   * Build extraction prompt for Gemini
   */
  private buildExtractionPrompt(text: string, title?: string): string {
    const processedText = this.truncateText(text);

    let prompt = `Extract entities and their relationships from the following document. Return a JSON object with this structure:

{
  "entities": [
    {
      "name": "entity name",
      "type": "person|organization|location|concept|event|other",
      "importance": 0.8 (0-1 score based on significance)
    }
  ],
  "relationships": [
    {
      "source": "entity name",
      "target": "entity name",
      "type": "relationship type (e.g., works_for, located_in, related_to, founded_by)",
      "strength": 0.9 (0-1 confidence score),
      "context": "brief context or sentence where relationship was found"
    }
  ]
}

`;

    if (title) {
      prompt += `Document Title: ${title}\n\n`;
    }

    prompt += `Document Content:\n${processedText}\n\n`;

    prompt += `Instructions:
- Extract only the most important entities (aim for 10-30 entities)
- Focus on entities that have clear relationships with other entities
- For importance, consider: frequency of mentions, centrality in document, significance
- For relationships, identify clear connections between entities
- Common relationship types: works_for, manages, founded_by, located_in, part_of, collaborates_with, competes_with, related_to
- Ensure all relationship source/target refer to entities in the entities array
- Return valid JSON only, no additional text
`;

    return prompt;
  }

  /**
   * Parse extraction response from Gemini
   */
  private parseExtractionResponse(response: string): {
    entities: Entity[];
    relationships: Relationship[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build entity map for quick lookup
      const entityMap = new Map<string, Entity>();
      const entities: Entity[] = [];

      if (Array.isArray(parsed.entities)) {
        parsed.entities.forEach((e: any, index: number) => {
          const entity: Entity = {
            id: `entity_${index}`,
            name: e.name || 'Unknown',
            type: this.normalizeEntityType(e.type),
            mentions: 1,
            importance: typeof e.importance === 'number' ? e.importance : 0.5,
          };
          entities.push(entity);
          entityMap.set(entity.name.toLowerCase(), entity);
        });
      }

      // Build relationships
      const relationships: Relationship[] = [];

      if (Array.isArray(parsed.relationships)) {
        parsed.relationships.forEach((r: any, index: number) => {
          const sourceName = String(r.source || '').toLowerCase();
          const targetName = String(r.target || '').toLowerCase();

          const sourceEntity = entityMap.get(sourceName);
          const targetEntity = entityMap.get(targetName);

          if (sourceEntity && targetEntity) {
            relationships.push({
              id: `rel_${index}`,
              source: sourceEntity.id,
              target: targetEntity.id,
              type: r.type || 'related_to',
              strength: typeof r.strength === 'number' ? r.strength : 0.5,
              context: r.context || '',
            });
          }
        });
      }

      return { entities, relationships };
    } catch (error: any) {
      console.error('Failed to parse extraction response:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Query knowledge graph
   */
  async queryGraph(
    documentId: string,
    query: string,
    maxResults: number = 10
  ): Promise<GraphQueryResult> {
    const graph = this.graphs.get(documentId);

    if (!graph) {
      throw new Error(`Knowledge graph not found for document: ${documentId}`);
    }

    console.log(`🔍 [Knowledge Graph] Querying: "${query}"`);

    // Simple keyword-based search (in production, use more sophisticated methods)
    const queryLower = query.toLowerCase();
    const matchedEntities = graph.entities.filter(e =>
      e.name.toLowerCase().includes(queryLower)
    );

    // Find relationships involving matched entities
    const entityIds = new Set(matchedEntities.map(e => e.id));
    const matchedRelationships = graph.relationships.filter(r =>
      entityIds.has(r.source) || entityIds.has(r.target)
    );

    // Include connected entities
    const allEntityIds = new Set(entityIds);
    matchedRelationships.forEach(r => {
      allEntityIds.add(r.source);
      allEntityIds.add(r.target);
    });

    const allEntities = graph.entities.filter(e => allEntityIds.has(e.id));

    return {
      entities: allEntities.slice(0, maxResults),
      relationships: matchedRelationships.slice(0, maxResults),
      relevanceScore: matchedEntities.length > 0 ? 0.8 : 0.3,
    };
  }

  /**
   * Find paths between two entities
   */
  findPathsBetweenEntities(
    documentId: string,
    sourceEntityName: string,
    targetEntityName: string,
    maxDepth: number = 3
  ): Array<{ path: Entity[]; relationships: Relationship[] }> {
    const graph = this.graphs.get(documentId);
    if (!graph) return [];

    const source = graph.entities.find(e =>
      e.name.toLowerCase() === sourceEntityName.toLowerCase()
    );
    const target = graph.entities.find(e =>
      e.name.toLowerCase() === targetEntityName.toLowerCase()
    );

    if (!source || !target) return [];

    // Build adjacency list
    const adjacency = new Map<string, Array<{ entityId: string; relationship: Relationship }>>();

    graph.relationships.forEach(rel => {
      if (!adjacency.has(rel.source)) adjacency.set(rel.source, []);
      adjacency.get(rel.source)!.push({ entityId: rel.target, relationship: rel });

      // Add reverse direction for undirected relationships
      if (!adjacency.has(rel.target)) adjacency.set(rel.target, []);
      adjacency.get(rel.target)!.push({ entityId: rel.source, relationship: rel });
    });

    // BFS to find paths
    const paths: Array<{ path: Entity[]; relationships: Relationship[] }> = [];
    const queue: Array<{ current: string; path: string[]; rels: Relationship[] }> = [
      { current: source.id, path: [source.id], rels: [] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0 && paths.length < 5) {
      const { current, path, rels } = queue.shift()!;

      if (path.length > maxDepth) continue;

      if (current === target.id) {
        const entityPath = path.map(id => graph.entities.find(e => e.id === id)!);
        paths.push({ path: entityPath, relationships: rels });
        continue;
      }

      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adjacency.get(current) || [];
      for (const { entityId, relationship } of neighbors) {
        if (!path.includes(entityId)) {
          queue.push({
            current: entityId,
            path: [...path, entityId],
            rels: [...rels, relationship],
          });
        }
      }
    }

    return paths;
  }

  /**
   * Get subgraph around an entity
   */
  getEntitySubgraph(
    documentId: string,
    entityName: string,
    depth: number = 1
  ): { entities: Entity[]; relationships: Relationship[] } {
    const graph = this.graphs.get(documentId);
    if (!graph) return { entities: [], relationships: [] };

    const entity = graph.entities.find(e =>
      e.name.toLowerCase() === entityName.toLowerCase()
    );

    if (!entity) return { entities: [], relationships: [] };

    const entityIds = new Set<string>([entity.id]);
    const relationships: Relationship[] = [];

    // Find connected entities up to specified depth
    for (let d = 0; d < depth; d++) {
      const currentIds = Array.from(entityIds);
      for (const id of currentIds) {
        const connectedRels = graph.relationships.filter(r =>
          r.source === id || r.target === id
        );

        connectedRels.forEach(rel => {
          relationships.push(rel);
          entityIds.add(rel.source);
          entityIds.add(rel.target);
        });
      }
    }

    const entities = graph.entities.filter(e => entityIds.has(e.id));

    return { entities, relationships };
  }

  /**
   * Get graph for document
   */
  getGraph(documentId: string): KnowledgeGraph | undefined {
    return this.graphs.get(documentId);
  }

  /**
   * Delete graph for document
   */
  deleteGraph(documentId: string): boolean {
    return this.graphs.delete(documentId);
  }

  /**
   * Get visualization data for graph
   */
  getVisualizationData(documentId: string): {
    nodes: Array<{ id: string; label: string; type: string; size: number }>;
    edges: Array<{ source: string; target: string; label: string; weight: number }>;
  } {
    const graph = this.graphs.get(documentId);
    if (!graph) return { nodes: [], edges: [] };

    const nodes = graph.entities.map(e => ({
      id: e.id,
      label: e.name,
      type: e.type,
      size: e.importance * 100,
    }));

    const edges = graph.relationships.map(r => ({
      source: r.source,
      target: r.target,
      label: r.type,
      weight: r.strength,
    }));

    return { nodes, edges };
  }

  /**
   * Calculate metadata for graph
   */
  private calculateMetadata(
    entities: Entity[],
    relationships: Relationship[]
  ): KnowledgeGraph['metadata'] {
    const entityTypes: Record<string, number> = {};
    entities.forEach(e => {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    });

    const relationshipTypes: Record<string, number> = {};
    relationships.forEach(r => {
      relationshipTypes[r.type] = (relationshipTypes[r.type] || 0) + 1;
    });

    return {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entityTypes,
      relationshipTypes,
    };
  }

  /**
   * Normalize entity type
   */
  private normalizeEntityType(type: any): Entity['type'] {
    const str = String(type).toLowerCase();
    if (str.includes('person')) return 'person';
    if (str.includes('organization') || str.includes('company')) return 'organization';
    if (str.includes('location') || str.includes('place')) return 'location';
    if (str.includes('concept')) return 'concept';
    if (str.includes('event')) return 'event';
    return 'other';
  }

  /**
   * Truncate text to maximum length
   */
  private truncateText(text: string): string {
    if (text.length <= this.MAX_TEXT_LENGTH) return text;
    console.warn(`   ⚠️ Text truncated from ${text.length} to ${this.MAX_TEXT_LENGTH} chars`);
    return text.slice(0, this.MAX_TEXT_LENGTH) + '...';
  }
}

export default new KnowledgeGraphService();
