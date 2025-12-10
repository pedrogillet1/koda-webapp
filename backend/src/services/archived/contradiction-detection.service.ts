/**
 * Contradiction Detection Service
 *
 * Identifies contradictions across documents
 */
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface Claim {
  text: string;
  source: string;
  document_id: string;
  confidence: number;
}

export interface Contradiction {
  claim1: Claim;
  claim2: Claim;
  contradiction_type: 'direct' | 'partial' | 'contextual';
  explanation: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Detect contradictions in claims
 */
export async function detectContradictions(
  claims: Claim[]
): Promise<Contradiction[]> {
  if (claims.length < 2) {
    return [];
  }

  console.log(`🔍 [CONTRADICTION] Analyzing ${claims.length} claims`);

  const prompt = `
Analyze these claims and identify any contradictions:

${claims.map((c, i) => `${i + 1}. "${c.text}" (from ${c.source})`).join('\n')}

Return JSON array of contradictions:
[
  {
    "claim1_index": 0,
    "claim2_index": 1,
    "contradiction_type": "direct" | "partial" | "contextual",
    "explanation": "Brief explanation of the contradiction",
    "severity": "high" | "medium" | "low"
  }
]

Types:
- direct: Claims directly contradict each other
- partial: Claims partially contradict (different numbers, dates, etc.)
- contextual: Claims contradict when considering context

Severity:
- high: Major contradiction (e.g., opposite conclusions)
- medium: Moderate contradiction (e.g., different numbers)
- low: Minor contradiction (e.g., slightly different wording)

Return empty array if no contradictions found.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content || '{"contradictions": []}');
  const rawContradictions = result.contradictions || [];

  // Map back to full claims
  const contradictions: Contradiction[] = rawContradictions.map((c: any) => ({
    claim1: claims[c.claim1_index],
    claim2: claims[c.claim2_index],
    contradiction_type: c.contradiction_type,
    explanation: c.explanation,
    severity: c.severity
  }));

  console.log(`🔍 [CONTRADICTION] Found ${contradictions.length} contradictions`);

  return contradictions;
}

/**
 * Extract claims from document chunks
 */
export async function extractClaims(
  documentChunks: { document_id: string; document_title: string; content: string }[]
): Promise<Claim[]> {
  console.log(`🔍 [CLAIMS] Extracting claims from ${documentChunks.length} documents`);

  const allClaims: Claim[] = [];

  for (const chunk of documentChunks) {
    const prompt = `
Extract factual claims from this document excerpt:

Document: ${chunk.document_title}
Content: ${chunk.content}

Return JSON array of claims:
[
  {
    "text": "The claim text",
    "confidence": 0.9
  }
]

Only extract verifiable factual claims (numbers, dates, names, statements).
Do not extract opinions or subjective statements.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"claims": []}');
    const claims = result.claims || [];

    for (const claim of claims) {
      allClaims.push({
        text: claim.text,
        source: chunk.document_title,
        document_id: chunk.document_id,
        confidence: claim.confidence
      });
    }
  }

  console.log(`🔍 [CLAIMS] Extracted ${allClaims.length} claims`);

  return allClaims;
}
