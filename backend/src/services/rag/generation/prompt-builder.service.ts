/**
 * Prompt Builder Service - A+ Implementation
 * Constructs optimized prompts for different query tiers
 *
 * Features:
 * - Tier-specific system prompts
 * - Inline intent detection and light QA instructions
 * - Dynamic prompt construction
 * - Centralized prompt management
 */

import { Prompt, PromptOptions } from "../types/generation.types";

const SYSTEM_PROMPTS = {
  simple: `You are a document assistant. Answer using ONLY the context provided. Be concise.`,
  medium: `You are a document assistant. Answer using ONLY the context provided. Include citations [1], [2]. If information is missing, say "não especificado no documento".`,
  complex: `You are an expert document analyst. Synthesize information from multiple sources. Use ONLY the context provided. Include citations [1], [2]. Before finalizing, verify: (1) all facts are grounded, (2) all citations are valid, (3) no information is invented.`,
  trivial: `You are a helpful assistant.`,
};

class PromptBuilderService {
  public build(options: PromptOptions): Prompt {
    const { query, context, tier, includeIntentDetection, includeLightQA } = options;

    const system = SYSTEM_PROMPTS[tier];
    let user = `Context from documents:\n${context}\n\nUser question: ${query}`;

    if (includeIntentDetection) {
      user = `Instructions:\n1. Interpret what the user is asking for.\n2. Answer using ONLY the context provided.\n\n${user}`;
    }

    if (includeLightQA) {
      user += `\n\nBefore finalizing your answer, double-check that all information comes directly from the provided context and that citations are correct.`;
    }

    const fullPrompt = `${system}\n\n${user}`;

    return { system, user, fullPrompt };
  }
}

export const promptBuilderService = new PromptBuilderService();
