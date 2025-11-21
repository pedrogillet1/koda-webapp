/**
 * Contradiction Detection Service
 * Detects conflicting information across documents using Gemini AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { FullDocument } from './fullDocumentRetrieval.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Contradiction {
  documents: string[];
  conflictingClaims: string[];
  severity: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface ContradictionResult {
  hasContradictions: boolean;
  contradictions: Contradiction[];
  overallSeverity: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Detect contradictions across multiple documents
 */
export async function detectContradictions(
  documents: FullDocument[],
  query: string
): Promise<ContradictionResult> {
  if (documents.length < 2) {
    console.log('🔍 [CONTRADICTION] Less than 2 documents, skipping detection');
    return {
      hasContradictions: false,
      contradictions: [],
      overallSeverity: 'none'
    };
  }

  console.log(`🔍 [CONTRADICTION] Analyzing ${documents.length} documents for conflicts`);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build document summaries for analysis
    const documentSummaries = documents.map((doc, idx) => {
      const contentPreview = doc.content.substring(0, 3000);
      return `**Document ${idx + 1}: ${doc.filename}**\n${contentPreview}${doc.content.length > 3000 ? '\n[... truncated ...]' : ''}`;
    }).join('\n\n---\n\n');

    const prompt = `You are analyzing multiple documents for contradictions and conflicting information.

**User Query**: ${query}

**Documents to Analyze**:
${documentSummaries}

**Task**: Identify any contradictions, conflicts, or inconsistencies across these documents that are relevant to the user's query.

**Instructions**:
1. Look for direct contradictions (e.g., different dates, amounts, terms)
2. Identify conflicting interpretations or conclusions
3. Note inconsistencies in data or facts
4. Assess the severity of each contradiction:
   - HIGH: Critical conflicts that would significantly impact understanding (e.g., different contract amounts, conflicting legal terms)
   - MEDIUM: Notable differences that could cause confusion (e.g., different timelines, varying descriptions)
   - LOW: Minor inconsistencies that don't affect main points (e.g., formatting differences, slight wording variations)

**Output Format** (JSON):
{
  "hasContradictions": true/false,
  "contradictions": [
    {
      "documents": ["Document 1: filename1.pdf", "Document 2: filename2.pdf"],
      "conflictingClaims": [
        "Document 1 states: [claim]",
        "Document 2 states: [claim]"
      ],
      "severity": "high/medium/low",
      "explanation": "Brief explanation of why this is a contradiction"
    }
  ],
  "overallSeverity": "high/medium/low/none"
}

If no contradictions are found, return:
{
  "hasContradictions": false,
  "contradictions": [],
  "overallSeverity": "none"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log(`🔍 [CONTRADICTION] Raw AI response: ${responseText.substring(0, 200)}...`);

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('🔍 [CONTRADICTION] Failed to parse JSON from response');
      return {
        hasContradictions: false,
        contradictions: [],
        overallSeverity: 'none'
      };
    }

    const parsedResult: ContradictionResult = JSON.parse(jsonMatch[0]);

    console.log(`🔍 [CONTRADICTION] Found ${parsedResult.contradictions.length} contradictions (severity: ${parsedResult.overallSeverity})`);

    return parsedResult;
  } catch (error) {
    console.error('🔍 [CONTRADICTION] Error detecting contradictions:', error);
    return {
      hasContradictions: false,
      contradictions: [],
      overallSeverity: 'none'
    };
  }
}

/**
 * Format contradictions for user display
 */
export function formatContradictionsForUser(result: ContradictionResult): string {
  if (!result.hasContradictions || result.contradictions.length === 0) {
    return '';
  }

  const severityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    none: ''
  };

  let message = `\n\n---\n\n${severityEmoji[result.overallSeverity]} **⚠️ CONTRADICTIONS DETECTED**\n\n`;
  message += `I found ${result.contradictions.length} contradiction${result.contradictions.length > 1 ? 's' : ''} across your documents:\n\n`;

  result.contradictions.forEach((contradiction, idx) => {
    message += `**${idx + 1}. ${severityEmoji[contradiction.severity]} ${contradiction.severity.toUpperCase()} SEVERITY**\n`;
    message += `**Conflicting Documents**: ${contradiction.documents.join(' vs ')}\n\n`;

    contradiction.conflictingClaims.forEach((claim, claimIdx) => {
      message += `   ${claimIdx + 1}. ${claim}\n`;
    });

    message += `\n**Why this matters**: ${contradiction.explanation}\n\n`;
  });

  message += `---\n\n💡 **Recommendation**: Please review these documents carefully to understand which information is correct for your needs.`;

  return message;
}

/**
 * Determine if contradiction detection should run
 */
export function shouldDetectContradictions(
  complexity: 'simple' | 'medium' | 'complex',
  documentCount: number
): boolean {
  // Only run for medium/complex queries with multiple documents
  if (documentCount < 2) {
    return false;
  }

  if (complexity === 'complex') {
    return true;
  }

  if (complexity === 'medium' && documentCount >= 3) {
    return true;
  }

  return false;
}
