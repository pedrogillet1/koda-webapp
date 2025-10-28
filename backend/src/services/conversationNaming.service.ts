import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CONVERSATION_NAMING_PROMPT = `You are a conversation title generator. Your job is to create short, descriptive titles for chat conversations.

Rules:
1. Generate a title that is 3-6 words long
2. Capture the main topic or intent of the user's message
3. Be specific and descriptive
4. Use title case (capitalize main words)
5. Do NOT use quotes around the title
6. Do NOT use punctuation at the end
7. Be concise and clear

Examples:
User message: "What are the revenue projections for Year 3?"
Title: Year 3 Revenue Projections

User message: "Can you help me analyze the Q4 financial statements?"
Title: Q4 Financial Analysis

User message: "I need to understand the marketing budget breakdown"
Title: Marketing Budget Breakdown

User message: "Show me the employee retention data"
Title: Employee Retention Data

Generate ONLY the title, nothing else.`;

interface Message {
  content: string;
  role: string;
}

/**
 * Generate a conversation name from the first user message
 */
export async function generateConversationName(firstMessage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONVERSATION_NAMING_PROMPT },
        { role: 'user', content: firstMessage }
      ],
      max_tokens: 10,
      temperature: 0.7
    });

    const generatedName = response.choices[0]?.message?.content?.trim();

    if (!generatedName) {
      return fallbackName(firstMessage);
    }

    return cleanConversationName(generatedName);
  } catch (error) {
    console.error('Error generating conversation name:', error);
    return fallbackName(firstMessage);
  }
}

/**
 * Generate a name from conversation context (multiple messages)
 */
export async function generateNameFromContext(messages: Message[]): Promise<string> {
  try {
    // Use first 3 messages for context
    const contextMessages = messages.slice(0, 3);
    const context = contextMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONVERSATION_NAMING_PROMPT },
        {
          role: 'user',
          content: `Based on this conversation, generate a title:\n\n${context}`
        }
      ],
      max_tokens: 10,
      temperature: 0.7
    });

    const generatedName = response.choices[0]?.message?.content?.trim();

    if (!generatedName) {
      return fallbackName(messages[0]?.content || 'New Chat');
    }

    return cleanConversationName(generatedName);
  } catch (error) {
    console.error('Error generating conversation name from context:', error);
    return fallbackName(messages[0]?.content || 'New Chat');
  }
}

/**
 * Clean and format the generated conversation name
 */
function cleanConversationName(name: string): string {
  // Remove quotes if present
  let cleaned = name.replace(/^["']|["']$/g, '');

  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.!?;,]+$/, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Limit to reasonable length (50 characters max)
  if (cleaned.length > 50) {
    cleaned = cleaned.substring(0, 47) + '...';
  }

  // If empty after cleaning, return default
  if (!cleaned) {
    return 'New Chat';
  }

  return cleaned;
}

/**
 * Fallback naming strategy using simple rules
 */
function fallbackName(message: string): string {
  if (!message || message.trim().length === 0) {
    return 'New Chat';
  }

  // Take first meaningful words (up to 6 words)
  const words = message
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .slice(0, 6);

  let name = words.join(' ');

  // Truncate if too long
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }

  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name || 'New Chat';
}

/**
 * Check if a conversation needs a name (first message scenario)
 */
export function shouldGenerateName(messageCount: number, currentTitle: string): boolean {
  return messageCount === 1 && (currentTitle === 'New Chat' || !currentTitle);
}
