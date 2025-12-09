/**
 * Document Weaver Service
 *
 * A sophisticated three-pass document and presentation generation system.
 *
 * Pass 1: Content Generation - Generate raw content outline
 * Pass 2: Structure & Layout - Choose components and layout
 * Pass 3: Rendering - Combine content and layout into final output
 *
 * Supports multiple output formats: HTML, JSON (for PPTX generation)
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { llmProvider } from './llm.provider';
import { detectLanguage, buildCulturalSystemPrompt } from './languageDetection.service';

// Import all components
import { TitleSlide } from '../components/TitleSlide';
import { TextSlide } from '../components/TextSlide';
import { ImageSlide } from '../components/ImageSlide';
import { ChartSlide } from '../components/ChartSlide';
import { QuoteSlide } from '../components/QuoteSlide';
import { ComparisonSlide } from '../components/ComparisonSlide';
import { SummarySlide } from '../components/SummarySlide';

// Component registry
const components = {
  TitleSlide,
  TextSlide,
  ImageSlide,
  ChartSlide,
  QuoteSlide,
  ComparisonSlide,
  SummarySlide,
} as const;

type ComponentName = keyof typeof components;
type ThemeType = 'light' | 'dark' | 'corporate' | 'creative';

// Document plan structure
interface SlideConfig {
  component: ComponentName;
  props: Record<string, any>;
}

type DocumentPlan = SlideConfig[];

// Content outline structure
interface ContentOutline {
  title: string;
  subtitle?: string;
  author?: string;
  sections: Array<{
    title: string;
    type: 'text' | 'chart' | 'quote' | 'comparison' | 'image';
    content: string | string[];
    data?: any;
  }>;
  conclusion?: {
    keyPoints: string[];
    callToAction?: string;
  };
}

// Generation options
interface GenerationOptions {
  theme?: ThemeType;
  slideCount?: number;
  includeCharts?: boolean;
  includeImages?: boolean;
  outputFormat?: 'html' | 'json' | 'slides';
}

// Generation result
interface GenerationResult {
  html?: string;
  slides?: DocumentPlan;
  outline?: ContentOutline;
  metadata: {
    topic: string;
    slideCount: number;
    theme: ThemeType;
    generatedAt: string;
    language: string;
  };
}

class DocumentWeaver {
  private readonly defaultModel = 'gemini-2.5-flash';

  /**
   * Main entry point - generate a complete document/presentation
   */
  async generateDocument(
    topic: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const {
      theme = 'corporate',
      slideCount = 5,
      includeCharts = true,
      includeImages = false,
      outputFormat = 'html',
    } = options;

    console.log(`[DocumentWeaver] Starting generation for topic: "${topic}"`);

    // Detect language for culturally appropriate content
    const language = detectLanguage(topic);
    const systemPrompt = await buildCulturalSystemPrompt(language);

    // Pass 1: Generate content outline
    console.log('[DocumentWeaver] Pass 1: Generating content outline...');
    const contentOutline = await this.generateContentOutline(topic, systemPrompt, slideCount);

    // Pass 2: Generate structural plan
    console.log('[DocumentWeaver] Pass 2: Generating structural plan...');
    const plan = await this.generateStructuralPlan(contentOutline, theme, includeCharts);

    // Pass 3: Render the document
    console.log('[DocumentWeaver] Pass 3: Rendering document...');
    const result: GenerationResult = {
      metadata: {
        topic,
        slideCount: plan.length,
        theme,
        generatedAt: new Date().toISOString(),
        language,
      },
    };

    if (outputFormat === 'html' || outputFormat === 'slides') {
      result.html = this.renderPlanToHtml(plan, topic, theme);
    }

    if (outputFormat === 'json' || outputFormat === 'slides') {
      result.slides = plan;
      result.outline = contentOutline;
    }

    console.log(`[DocumentWeaver] Generation complete: ${plan.length} slides created`);
    return result;
  }

  /**
   * Pass 1: Generate content outline using LLM
   */
  private async generateContentOutline(
    topic: string,
    systemPrompt: string,
    slideCount: number
  ): Promise<ContentOutline> {
    const prompt = `${systemPrompt}

You are creating a professional presentation outline.

Topic: "${topic}"
Number of slides: ${slideCount}

Create a detailed content outline in JSON format with the following structure:
{
  "title": "Main presentation title",
  "subtitle": "Subtitle or tagline",
  "author": "Koda AI",
  "sections": [
    {
      "title": "Section title",
      "type": "text|chart|quote|comparison",
      "content": "Content text or array of bullet points",
      "data": {} // Optional: chart data or comparison items
    }
  ],
  "conclusion": {
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "callToAction": "Call to action text"
  }
}

Section types:
- "text": Regular content with title and bullet points
- "chart": Data visualization (provide data array with label/value pairs)
- "quote": Inspirational or relevant quote
- "comparison": Side-by-side comparison of concepts

For chart type, include data like:
"data": { "chartType": "bar", "items": [{"label": "A", "value": 50}] }

For comparison type, include:
"data": { "items": [{"title": "Option A", "points": ["Point 1", "Point 2"]}] }

Create exactly ${slideCount - 1} content sections (title and summary slides are automatic).
Output ONLY valid JSON, no markdown or explanations.`;

    try {
      const response = await llmProvider.createChatCompletion({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = response.choices[0].message.content || '{}';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('No valid JSON found in response');
    } catch (error: any) {
      console.error('[DocumentWeaver] Content outline generation failed:', error.message);
      // Return a fallback outline
      return this.createFallbackOutline(topic, slideCount);
    }
  }

  /**
   * Pass 2: Generate structural plan from content outline
   */
  private async generateStructuralPlan(
    outline: ContentOutline,
    theme: ThemeType,
    includeCharts: boolean
  ): Promise<DocumentPlan> {
    const plan: DocumentPlan = [];

    // Title slide
    plan.push({
      component: 'TitleSlide',
      props: {
        title: outline.title,
        subtitle: outline.subtitle,
        author: outline.author || 'Generated by Koda',
        date: new Date().toLocaleDateString(),
        theme,
      },
    });

    // Content sections
    for (const section of outline.sections) {
      switch (section.type) {
        case 'chart':
          if (includeCharts && section.data?.items) {
            plan.push({
              component: 'ChartSlide',
              props: {
                title: section.title,
                data: section.data.items.map((item: any) => ({
                  label: item.label,
                  value: item.value,
                })),
                chartType: section.data.chartType || 'bar',
                subtitle: typeof section.content === 'string' ? section.content : undefined,
                theme,
              },
            });
          } else {
            // Fallback to text slide
            plan.push({
              component: 'TextSlide',
              props: {
                title: section.title,
                content: section.content,
                theme,
              },
            });
          }
          break;

        case 'quote':
          const quoteContent = Array.isArray(section.content)
            ? section.content[0]
            : section.content;
          plan.push({
            component: 'QuoteSlide',
            props: {
              quote: quoteContent,
              author: section.data?.author,
              source: section.data?.source,
              theme,
            },
          });
          break;

        case 'comparison':
          if (section.data?.items) {
            plan.push({
              component: 'ComparisonSlide',
              props: {
                title: section.title,
                items: section.data.items,
                subtitle: typeof section.content === 'string' ? section.content : undefined,
                theme,
              },
            });
          } else {
            plan.push({
              component: 'TextSlide',
              props: {
                title: section.title,
                content: section.content,
                theme,
              },
            });
          }
          break;

        case 'image':
          plan.push({
            component: 'ImageSlide',
            props: {
              title: section.title,
              imagePlaceholder: `[Image: ${section.title}]`,
              description: typeof section.content === 'string'
                ? section.content
                : section.content.join(' '),
              layout: 'right',
              theme,
            },
          });
          break;

        case 'text':
        default:
          plan.push({
            component: 'TextSlide',
            props: {
              title: section.title,
              content: section.content,
              theme,
            },
          });
          break;
      }
    }

    // Summary/conclusion slide
    if (outline.conclusion) {
      plan.push({
        component: 'SummarySlide',
        props: {
          title: 'Key Takeaways',
          keyPoints: outline.conclusion.keyPoints,
          callToAction: outline.conclusion.callToAction,
          theme,
        },
      });
    }

    return plan;
  }

  /**
   * Pass 3: Render plan to HTML
   */
  private renderPlanToHtml(plan: DocumentPlan, title: string, theme: ThemeType): string {
    const slidesHtml = plan
      .map((item, index) => {
        const Component = components[item.component];
        if (!Component) {
          return `<div class="slide error-slide" data-slide="${index + 1}">
            <p>Error: Component "${item.component}" not found</p>
          </div>`;
        }

        try {
          const element = React.createElement(Component as any, item.props);
          const slideHtml = ReactDOMServer.renderToString(element);
          return `<div class="slide-wrapper" data-slide="${index + 1}" data-component="${item.component}">
            ${slideHtml}
          </div>`;
        } catch (error: any) {
          return `<div class="slide error-slide" data-slide="${index + 1}">
            <p>Error rendering ${item.component}: ${error.message}</p>
          </div>`;
        }
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      background: #f0f0f0;
    }

    .presentation {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .slide-wrapper {
      margin-bottom: 40px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }

    .slide {
      aspect-ratio: 16 / 9;
      min-height: 500px;
    }

    .error-slide {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fee;
      color: #c00;
      padding: 40px;
    }

    @media print {
      .slide-wrapper {
        page-break-after: always;
        margin-bottom: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="presentation">
    ${slidesHtml}
  </div>
</body>
</html>`;
  }

  /**
   * Create a fallback outline when LLM generation fails
   */
  private createFallbackOutline(topic: string, slideCount: number): ContentOutline {
    return {
      title: topic,
      subtitle: 'A Comprehensive Overview',
      author: 'Koda AI',
      sections: [
        {
          title: 'Introduction',
          type: 'text' as const,
          content: [
            `Overview of ${topic}`,
            'Key concepts and definitions',
            'Why this topic matters',
          ],
        },
        {
          title: 'Main Points',
          type: 'text' as const,
          content: [
            'First key point to consider',
            'Second important aspect',
            'Third relevant factor',
          ],
        },
        {
          title: 'Analysis',
          type: 'text' as const,
          content: [
            'Detailed examination of the topic',
            'Supporting evidence and examples',
            'Implications and applications',
          ],
        },
      ].slice(0, Math.max(slideCount - 2, 1)),
      conclusion: {
        keyPoints: [
          `Understanding ${topic} is essential`,
          'Key concepts reviewed',
          'Next steps and recommendations',
        ],
        callToAction: 'Take action today!',
      },
    };
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate a quick single-slide preview
   */
  async generateSlidePreview(
    slideType: ComponentName,
    content: Record<string, any>,
    theme: ThemeType = 'corporate'
  ): Promise<string> {
    const Component = components[slideType];
    if (!Component) {
      throw new Error(`Unknown slide type: ${slideType}`);
    }

    const element = React.createElement(Component as any, { ...content, theme });
    return ReactDOMServer.renderToString(element);
  }

  /**
   * Get available component types
   */
  getAvailableComponents(): string[] {
    return Object.keys(components);
  }

  /**
   * Get component schema for a specific type
   */
  getComponentSchema(componentName: ComponentName): Record<string, string> {
    const schemas: Record<ComponentName, Record<string, string>> = {
      TitleSlide: {
        title: 'string (required)',
        subtitle: 'string',
        author: 'string',
        date: 'string',
        theme: 'light | dark | corporate | creative',
      },
      TextSlide: {
        title: 'string (required)',
        content: 'string | string[]',
        subtitle: 'string',
        theme: 'light | dark | corporate | creative',
      },
      ImageSlide: {
        title: 'string (required)',
        imageUrl: 'string',
        imagePlaceholder: 'string',
        caption: 'string',
        layout: 'full | left | right',
        description: 'string',
        theme: 'light | dark | corporate | creative',
      },
      ChartSlide: {
        title: 'string (required)',
        data: 'Array<{label: string, value: number, color?: string}>',
        chartType: 'bar | horizontal-bar | progress',
        subtitle: 'string',
        showValues: 'boolean',
        theme: 'light | dark | corporate | creative',
      },
      QuoteSlide: {
        quote: 'string (required)',
        author: 'string',
        source: 'string',
        theme: 'light | dark | corporate | creative',
      },
      ComparisonSlide: {
        title: 'string (required)',
        items: 'Array<{title: string, points: string[], highlight?: boolean}>',
        subtitle: 'string',
        theme: 'light | dark | corporate | creative',
      },
      SummarySlide: {
        title: 'string (required)',
        keyPoints: 'string[] (required)',
        conclusion: 'string',
        callToAction: 'string',
        theme: 'light | dark | corporate | creative',
      },
    };

    return schemas[componentName] || {};
  }
}

export const documentWeaver = new DocumentWeaver();
