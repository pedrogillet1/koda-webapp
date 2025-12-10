/**
 * Skill Pack Loader Service
 *
 * Loads domain-specific skill packs and injects them into RAG prompts.
 * Skill packs provide expert knowledge for finance, accounting, legal,
 * medical, education, and research domains.
 */

import fs from 'fs';
import path from 'path';
import { Domain } from './domainDetector.service';

interface SkillPack {
  domain: Domain;
  content: string;
  loaded: boolean;
  error?: string;
}

/**
 * Cache for loaded skill packs
 */
const skillPackCache: Map<Domain, SkillPack> = new Map();

/**
 * Path to domain knowledge directory
 */
const DOMAIN_KNOWLEDGE_PATH = path.join(__dirname, '../domain-knowledge');

/**
 * Mapping of domains to file names
 */
const DOMAIN_FILES: Record<Domain, string> = {
  finance: 'finance.md',
  accounting: 'accounting.md',
  legal: 'legal.md',
  medical: 'medical.md',
  education: 'education.md',
  research: 'research.md',
  general: '' // No skill pack for general
};

/**
 * Load a skill pack from file system
 */
function loadSkillPackFromFile(domain: Domain): SkillPack {
  // Check if general domain (no skill pack)
  if (domain === 'general') {
    return {
      domain: 'general',
      content: '',
      loaded: true
    };
  }

  const fileName = DOMAIN_FILES[domain];
  if (!fileName) {
    return {
      domain,
      content: '',
      loaded: false,
      error: `No skill pack file defined for domain: ${domain}`
    };
  }

  const filePath = path.join(DOMAIN_KNOWLEDGE_PATH, fileName);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        domain,
        content: '',
        loaded: false,
        error: `Skill pack file not found: ${filePath}`
      };
    }

    // Read file
    const content = fs.readFileSync(filePath, 'utf-8');

    return {
      domain,
      content,
      loaded: true
    };
  } catch (error) {
    return {
      domain,
      content: '',
      loaded: false,
      error: `Error loading skill pack: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get skill pack for domain (with caching)
 */
export function getSkillPack(domain: Domain): SkillPack {
  // Check cache
  if (skillPackCache.has(domain)) {
    return skillPackCache.get(domain)!;
  }

  // Load from file
  const skillPack = loadSkillPackFromFile(domain);

  // Cache it
  skillPackCache.set(domain, skillPack);

  return skillPack;
}

/**
 * Preload all skill packs (call at startup)
 */
export function preloadAllSkillPacks(): void {
  const domains: Domain[] = ['finance', 'accounting', 'legal', 'medical', 'education', 'research'];

  console.log('[SkillPackLoader] Preloading all skill packs...');

  for (const domain of domains) {
    const skillPack = getSkillPack(domain);
    if (skillPack.loaded) {
      console.log(`[SkillPackLoader] Loaded ${domain} skill pack (${skillPack.content.length} chars)`);
    } else {
      console.error(`[SkillPackLoader] Failed to load ${domain} skill pack: ${skillPack.error}`);
    }
  }

  console.log('[SkillPackLoader] Preloading complete');
}

/**
 * Clear skill pack cache (useful for hot reload in development)
 */
export function clearSkillPackCache(): void {
  skillPackCache.clear();
  console.log('[SkillPackLoader] Cache cleared');
}

/**
 * Inject skill pack into RAG prompt
 */
export function injectSkillPackIntoPrompt(
  basePrompt: string,
  domain: Domain,
  insertionPoint: 'before_context' | 'after_context' | 'before_query' = 'before_context'
): string {
  const skillPack = getSkillPack(domain);

  // If general or failed to load, return original prompt
  if (domain === 'general' || !skillPack.loaded) {
    return basePrompt;
  }

  // Build skill pack section
  const skillPackSection = `
================================================================================
DOMAIN KNOWLEDGE ACTIVATED: ${domain.toUpperCase()}
================================================================================

${skillPack.content}

================================================================================
END OF DOMAIN KNOWLEDGE
================================================================================

`;

  // Insert at appropriate location
  switch (insertionPoint) {
    case 'before_context':
      return skillPackSection + basePrompt;

    case 'after_context':
      // Find context marker and insert after
      const contextMarker = 'Context from documents:';
      const contextIndex = basePrompt.indexOf(contextMarker);
      if (contextIndex !== -1) {
        // Find end of context section (usually before "User question:")
        const queryMarker = 'User question:';
        const queryIndex = basePrompt.indexOf(queryMarker, contextIndex);
        if (queryIndex !== -1) {
          return basePrompt.slice(0, queryIndex) + skillPackSection + basePrompt.slice(queryIndex);
        }
      }
      // Fallback: insert at beginning
      return skillPackSection + basePrompt;

    case 'before_query':
      // Insert before "User question:" section
      const queryMarker2 = 'User question:';
      const queryIndex2 = basePrompt.indexOf(queryMarker2);
      if (queryIndex2 !== -1) {
        return basePrompt.slice(0, queryIndex2) + skillPackSection + basePrompt.slice(queryIndex2);
      }
      // Fallback: insert at end
      return basePrompt + '\n\n' + skillPackSection;

    default:
      return skillPackSection + basePrompt;
  }
}

/**
 * Build complete RAG prompt with skill pack injection
 */
export function buildPromptWithSkillPack(params: {
  domain: Domain;
  systemInstruction: string;
  conversationHistory?: string;
  retrievedContext: string;
  userQuery: string;
  language?: string;
}): string {
  const { domain, systemInstruction, conversationHistory, retrievedContext, userQuery, language } = params;

  const skillPack = getSkillPack(domain);

  let prompt = '';

  // Add system instruction
  prompt += systemInstruction + '\n\n';

  // Add skill pack if domain is specific
  if (domain !== 'general' && skillPack.loaded) {
    prompt += `
================================================================================
DOMAIN EXPERTISE: ${domain.toUpperCase()}
================================================================================

You have specialized knowledge for this domain. Apply the following guidelines:

${skillPack.content}

================================================================================

`;
  }

  // Add conversation history if present
  if (conversationHistory) {
    prompt += `
Previous conversation:
${conversationHistory}

`;
  }

  // Add retrieved context
  prompt += `
Context from documents:
${retrievedContext}

`;

  // Add language instruction if specified
  if (language) {
    prompt += `
IMPORTANT: Respond in ${language}.

`;
  }

  // Add user query
  prompt += `
User question: ${userQuery}

`;

  // Add domain-specific instruction reminder
  if (domain !== 'general' && skillPack.loaded) {
    prompt += `
IMPORTANT: Apply the ${domain.toUpperCase()} domain knowledge above when answering.
Follow the response style, formulas, and guidelines specified in the domain knowledge.
`;
  }

  return prompt;
}

/**
 * Get skill pack statistics
 */
export function getSkillPackStats(): Record<Domain, { loaded: boolean; size: number; error?: string }> {
  const stats: Record<Domain, { loaded: boolean; size: number; error?: string }> = {} as any;

  const domains: Domain[] = ['finance', 'accounting', 'legal', 'medical', 'education', 'research', 'general'];

  for (const domain of domains) {
    const skillPack = getSkillPack(domain);
    stats[domain] = {
      loaded: skillPack.loaded,
      size: skillPack.content.length,
      error: skillPack.error
    };
  }

  return stats;
}

/**
 * Validate all skill packs are loaded correctly
 */
export function validateSkillPacks(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const domains: Domain[] = ['finance', 'accounting', 'legal', 'medical', 'education', 'research'];

  for (const domain of domains) {
    const skillPack = getSkillPack(domain);
    if (!skillPack.loaded) {
      errors.push(`${domain}: ${skillPack.error}`);
    } else if (skillPack.content.length < 500) {
      errors.push(`${domain}: Content too short (${skillPack.content.length} chars)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  getSkillPack,
  preloadAllSkillPacks,
  clearSkillPackCache,
  injectSkillPackIntoPrompt,
  buildPromptWithSkillPack,
  getSkillPackStats,
  validateSkillPacks
};
