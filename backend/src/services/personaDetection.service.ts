import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PersonaProfile {
  persona: 'lawyer' | 'student' | 'accountant' | 'researcher' | 'business' | 'healthcare' | 'general';
  confidence: number;
  detectedKeywords: string[];
  suggestedResearchTopics: string[];
}

/**
 * Detect user persona from conversation history and current query
 */
export async function detectPersona(
  query: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<PersonaProfile> {
  try {
    // Combine recent conversation for context (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);
    const context = recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');

    const prompt = `Analyze the following user query and conversation history to detect the user's professional persona or role.

Conversation History:
${context}

Current Query:
${query}

Based on the language, terminology, and topics discussed, determine the most likely persona:
- lawyer: Legal terminology, case law, contracts, litigation, compliance
- student: Academic questions, homework, learning, studying, assignments
- accountant: Financial terms, tax, bookkeeping, auditing, financial statements
- researcher: Scientific language, research methodology, citations, academic papers
- business: Business strategy, marketing, management, sales, operations
- healthcare: Medical terms, patient care, diagnosis, treatment, healthcare regulations
- general: No specific professional context

Respond in JSON format:
{
  "persona": "detected_persona",
  "confidence": 0.85,
  "detectedKeywords": ["keyword1", "keyword2"],
  "suggestedResearchTopics": ["topic1", "topic2", "topic3"]
}

The suggestedResearchTopics should be specific to the persona and relevant to their likely needs.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]) as PersonaProfile;

    console.log('🎭 Persona detected:', result.persona, `(${(result.confidence * 100).toFixed(0)}% confidence)`);

    return result;
  } catch (error) {
    console.error('❌ Error detecting persona:', error);

    // Fallback: Use basic keyword matching
    return detectPersonaFallback(query);
  }
}

/**
 * Fallback persona detection using keyword matching
 */
function detectPersonaFallback(query: string): PersonaProfile {
  const lowerQuery = query.toLowerCase();

  // Define persona keywords
  const personaKeywords = {
    lawyer: ['legal', 'law', 'contract', 'case', 'court', 'litigation', 'compliance', 'regulation', 'statute', 'attorney', 'lawsuit', 'plaintiff', 'defendant'],
    student: ['homework', 'assignment', 'study', 'exam', 'course', 'professor', 'class', 'learn', 'textbook', 'semester', 'grade', 'university'],
    accountant: ['tax', 'accounting', 'financial', 'audit', 'bookkeeping', 'ledger', 'balance sheet', 'revenue', 'expense', 'deduction', 'fiscal', 'gaap'],
    researcher: ['research', 'study', 'hypothesis', 'methodology', 'data', 'analysis', 'paper', 'journal', 'citation', 'experiment', 'peer review', 'publication'],
    business: ['business', 'marketing', 'sales', 'strategy', 'customer', 'market', 'revenue', 'profit', 'management', 'operations', 'stakeholder', 'roi'],
    healthcare: ['patient', 'medical', 'diagnosis', 'treatment', 'healthcare', 'clinical', 'hospital', 'doctor', 'nurse', 'medication', 'symptoms', 'therapy'],
  };

  let maxMatches = 0;
  let detectedPersona: PersonaProfile['persona'] = 'general';
  let detectedKeywords: string[] = [];

  for (const [persona, keywords] of Object.entries(personaKeywords)) {
    const matches = keywords.filter(keyword => lowerQuery.includes(keyword));
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      detectedPersona = persona as PersonaProfile['persona'];
      detectedKeywords = matches;
    }
  }

  // Default suggestions per persona
  const defaultSuggestions: Record<string, string[]> = {
    lawyer: ['Recent legal precedents', 'Regulatory updates', 'Case law research'],
    student: ['Academic resources', 'Study guides', 'Course materials'],
    accountant: ['Tax code updates', 'Financial reporting standards', 'Accounting regulations'],
    researcher: ['Recent publications', 'Research methodologies', 'Academic databases'],
    business: ['Market trends', 'Industry reports', 'Competitor analysis'],
    healthcare: ['Clinical guidelines', 'Medical research', 'Treatment protocols'],
    general: ['Latest information', 'Comprehensive overview', 'Expert sources'],
  };

  const confidence = maxMatches > 0 ? Math.min(maxMatches * 0.3, 0.9) : 0.5;

  return {
    persona: detectedPersona,
    confidence,
    detectedKeywords,
    suggestedResearchTopics: defaultSuggestions[detectedPersona] || defaultSuggestions.general,
  };
}

/**
 * Get persona-specific research suggestions
 */
export function getPersonaResearchSuggestions(persona: PersonaProfile['persona'], query: string): string[] {
  const suggestions: Record<PersonaProfile['persona'], string[]> = {
    lawyer: [
      `Search for recent case law related to: ${query}`,
      `Find regulatory updates and compliance requirements`,
      `Look up legal precedents and statutory interpretations`,
    ],
    student: [
      `Search for academic sources and textbooks on: ${query}`,
      `Find study guides and educational materials`,
      `Look up course lectures and learning resources`,
    ],
    accountant: [
      `Search for latest tax regulations and accounting standards`,
      `Find financial reporting guidelines for: ${query}`,
      `Look up audit procedures and compliance requirements`,
    ],
    researcher: [
      `Search for peer-reviewed papers on: ${query}`,
      `Find recent publications and research studies`,
      `Look up methodologies and data sources`,
    ],
    business: [
      `Search for market analysis and industry trends`,
      `Find competitor insights and business strategies for: ${query}`,
      `Look up case studies and best practices`,
    ],
    healthcare: [
      `Search for clinical guidelines on: ${query}`,
      `Find medical research and treatment protocols`,
      `Look up evidence-based practices and patient care standards`,
    ],
    general: [
      `Search for comprehensive information on: ${query}`,
      `Find authoritative sources and expert analysis`,
      `Look up latest updates and current perspectives`,
    ],
  };

  return suggestions[persona] || suggestions.general;
}

/**
 * Get persona-specific context prompts for better AI responses
 */
export function getPersonaContextPrompt(persona: PersonaProfile['persona']): string {
  const prompts: Record<PersonaProfile['persona'], string> = {
    lawyer: 'You are assisting a legal professional. Provide precise, well-cited information with attention to legal accuracy. Reference statutes, case law, and regulatory requirements when applicable.',
    student: 'You are assisting a student. Provide clear, educational explanations that help with learning. Break down complex concepts and suggest additional resources for deeper understanding.',
    accountant: 'You are assisting an accounting professional. Focus on financial accuracy, compliance standards, and professional accounting practices. Reference GAAP, tax codes, and regulatory requirements.',
    researcher: 'You are assisting a researcher. Provide evidence-based information with proper citations. Focus on methodology, data quality, and academic rigor.',
    business: 'You are assisting a business professional. Provide actionable insights, strategic recommendations, and practical business solutions with attention to ROI and implementation.',
    healthcare: 'You are assisting a healthcare professional. Provide evidence-based medical information with attention to clinical guidelines, patient safety, and professional standards.',
    general: 'Provide comprehensive, accurate information tailored to the user\'s needs.',
  };

  return prompts[persona] || prompts.general;
}
