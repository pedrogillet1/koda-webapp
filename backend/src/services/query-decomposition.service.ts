/**
 * Query Decomposition Service
 *
 * Breaks down complex queries into smaller sub-queries for better retrieval
 */
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SubQuery {
  id: number;
  query: string;
  depends_on: number[];
  type: 'retrieval' | 'synthesis' | 'comparison' | 'validation';
}

/**
 * Decompose complex query into sub-queries
 */
export async function decomposeQuery(
  query: string,
  documentTitles: string[]
): Promise<SubQuery[]> {
  console.log(`🔍 [DECOMPOSE] Breaking down query: "${query}"`);

  const prompt = `
You are a query decomposition expert. Break down this complex query into smaller sub-queries.

User Query: ${query}
Available Documents: ${documentTitles.join(', ')}

Break down the query into sub-queries that can be executed sequentially or in parallel.
Each sub-query should have:
- id: unique number
- query: the sub-query text
- depends_on: array of sub-query IDs that must complete first (empty if can run immediately)
- type: "retrieval" (find documents), "synthesis" (combine information), "comparison" (compare docs), or "validation" (check contradictions)

Return JSON array:
[
  {"id": 1, "query": "Find all financial documents", "depends_on": [], "type": "retrieval"},
  {"id": 2, "query": "Extract revenue figures from each document", "depends_on": [1], "type": "retrieval"},
  {"id": 3, "query": "Compare revenue across documents", "depends_on": [2], "type": "comparison"},
  {"id": 4, "query": "Check for contradictions in reported figures", "depends_on": [3], "type": "validation"}
]

IMPORTANT: Only decompose if the query is actually complex. Simple queries should return a single sub-query.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content || '{"subQueries": []}');
  const subQueries: SubQuery[] = result.subQueries || result;

  console.log(`🔍 [DECOMPOSE] Created ${subQueries.length} sub-queries`);

  return subQueries;
}

/**
 * Determine if query needs decomposition
 */
export function needsDecomposition(query: string): boolean {
  const complexIndicators = [
    'compare', 'contrast', 'difference between',
    'all documents', 'across all', 'every',
    'timeline', 'changes over time', 'evolution',
    'relationship between', 'how does X affect Y',
    'synthesize', 'summarize all'
  ];

  const lowerQuery = query.toLowerCase();
  return complexIndicators.some(indicator => lowerQuery.includes(indicator));
}
