import { GoogleGenerativeAI } from '@google/generative-ai';

class LLMProvider {
  private googleClient: GoogleGenerativeAI;

  constructor() {
    this.googleClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async createChatCompletion(params: {
    model: string;
    messages: Array<{ role: 'user' | 'system' | 'model'; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }) {
    // For now, we only support Google, but you can add logic here to switch
    // based on the model name (e.g., if model.includes('claude'))
    const model = this.googleClient.getGenerativeModel({ model: params.model });

    const history = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = params.messages.find((m) => m.role === 'system');

    const result = await model.generateContent({
      contents: history,
      generationConfig: {
        temperature: params.temperature || 0.7,
        maxOutputTokens: params.maxTokens || 4096,
      },
      systemInstruction: systemInstruction ? systemInstruction.content : undefined,
    });

    const response = result.response;
    const text = response.text();

    return {
      choices: [
        {
          message: {
            role: 'model',
            content: text,
          },
        },
      ],
    };
  }
}

export const llmProvider = new LLMProvider();
