/**
 * Evidence Aggregation Service
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface EvidenceItem {
  claim: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    excerpt: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export interface EvidenceMap {
  claims: EvidenceItem[];
  overallCoverage: number;
}

export async function generateEvidenceMap(
  answer: string,
  documents: Array<{ id: string; filename: string; content: string }>
): Promise<EvidenceMap> {
  console.log(`📚 [EVIDENCE] Generating evidence map`);

  if (documents.length === 0) {
    return { claims: [], overallCoverage: 0 };
  }

  try {
    const prompt = buildEvidencePrompt(answer, documents);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const evidenceMap = parseEvidenceResponse(responseText, documents);

    console.log(`📚 [EVIDENCE] Mapped ${evidenceMap.claims.length} claims`);

    return evidenceMap;
  } catch (error) {
    console.error('❌ [EVIDENCE] Error:', error);
    return { claims: [], overallCoverage: 0 };
  }
}

function buildEvidencePrompt(
  answer: string,
  documents: Array<{ id: string; filename: string; content: string }>
): string {
  let prompt = `Analyze which parts of the answer are supported by which documents.

**Answer**:
${answer}

**Documents**:

`;

  documents.forEach((doc, index) => {
    const truncated = doc.content.length > 3000
      ? doc.content.substring(0, 3000) + '...'
      : doc.content;
    prompt += `**Document ${index + 1}: ${doc.filename}**\n${truncated}\n\n${'='.repeat(80)}\n\n`;
  });

  prompt += `**Output Format** (JSON):
{
  "claims": [
    {
      "claim": "Statement from answer",
      "sources": [
        {
          "documentIndex": 1,
          "excerpt": "Supporting quote",
          "confidence": "high/medium/low"
        }
      ]
    }
  ],
  "overallCoverage": 85
}

Provide JSON:`;

  return prompt;
}

function parseEvidenceResponse(
  responseText: string,
  documents: Array<{ id: string; filename: string; content: string }>
): EvidenceMap {
  try {
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(jsonText);

    const claims: EvidenceItem[] = (parsed.claims || []).map((c: any) => ({
      claim: c.claim,
      sources: (c.sources || []).map((s: any) => ({
        documentId: documents[s.documentIndex - 1]?.id || '',
        documentName: documents[s.documentIndex - 1]?.filename || 'Unknown',
        excerpt: s.excerpt,
        confidence: s.confidence || 'medium'
      }))
    }));

    return {
      claims,
      overallCoverage: parsed.overallCoverage || 0
    };
  } catch (error) {
    console.error('❌ [EVIDENCE] Parse error:', error);
    return { claims: [], overallCoverage: 0 };
  }
}

export function formatEvidenceForUser(evidenceMap: EvidenceMap): string {
  if (evidenceMap.claims.length === 0) return '';

  let message = '\n\n📚 **Evidence Breakdown**\n\n';
  message += `Overall coverage: ${evidenceMap.overallCoverage}%\n\n`;

  evidenceMap.claims.forEach((item, index) => {
    message += `${index + 1}. "${item.claim}"\n`;
    item.sources.forEach(source => {
      const emoji = source.confidence === 'high' ? '🟢' : source.confidence === 'medium' ? '🟡' : '🟠';
      message += `   ${emoji} **${source.documentName}**: "${source.excerpt}"\n`;
    });
    message += '\n';
  });

  return message;
}

export function shouldAggregateEvidence(
  complexity: 'simple' | 'medium' | 'complex',
  documentCount: number
): boolean {
  return complexity === 'complex' && documentCount >= 2;
}
