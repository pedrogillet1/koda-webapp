/**
 * HTML Processor Service
 * Converts HTML documents to clean markdown while preserving structure
 * - Removes unwanted tags (script, style, nav, footer)
 * - Extracts metadata (title, description, author)
 * - Converts to markdown with proper formatting
 * - Preserves links, images, tables, and headings
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { ExtractionResult } from './textExtraction.service';

interface HTMLMetadata {
  title: string;
  description?: string;
  author?: string;
  keywords?: string[];
  canonicalUrl?: string;
  language?: string;
}

class HTMLProcessorService {
  private turndownService: TurndownService;

  constructor() {
    // Initialize Turndown with custom options
    this.turndownService = new TurndownService({
      headingStyle: 'atx', // Use # for headings
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
    });

    // Add custom rules for better conversion
    this.addCustomRules();
  }

  /**
   * Process HTML content and convert to markdown
   */
  async processHTML(buffer: Buffer): Promise<ExtractionResult> {
    try {
      console.log('🌐 [HTML Processor] Processing HTML document...');

      const htmlContent = buffer.toString('utf-8');
      const $ = cheerio.load(htmlContent);

      // Extract metadata
      const metadata = this.extractMetadata($);
      console.log(`   Title: "${metadata.title}"`);
      if (metadata.description) {
        console.log(`   Description: "${metadata.description.substring(0, 100)}..."`);
      }

      // Remove unwanted elements
      this.removeUnwantedElements($);

      // Try to find main content area
      const mainContent = this.extractMainContent($);

      // Convert to markdown
      let markdown = this.turndownService.turndown(mainContent);

      // Clean up markdown
      markdown = this.cleanMarkdown(markdown);

      // Add title if not already in content
      if (metadata.title && !markdown.startsWith('# ')) {
        markdown = `# ${metadata.title}\n\n${markdown}`;
      }

      // Add metadata section if we have useful info
      if (metadata.description || metadata.author || metadata.keywords) {
        let metadataSection = '\n\n---\n\n**Document Metadata:**\n\n';
        if (metadata.author) metadataSection += `- **Author:** ${metadata.author}\n`;
        if (metadata.description) metadataSection += `- **Description:** ${metadata.description}\n`;
        if (metadata.keywords && metadata.keywords.length > 0) {
          metadataSection += `- **Keywords:** ${metadata.keywords.join(', ')}\n`;
        }
        if (metadata.language) metadataSection += `- **Language:** ${metadata.language}\n`;

        markdown = markdown + metadataSection;
      }

      const wordCount = markdown.split(/\s+/).filter(w => w.length > 0).length;

      console.log(`✅ [HTML Processor] Converted to markdown (${markdown.length} chars, ${wordCount} words)`);

      return {
        text: markdown,
        wordCount,
        confidence: 1.0,
        language: metadata.language,
      };
    } catch (error: any) {
      console.error('❌ [HTML Processor] Error:', error);
      throw new Error(`Failed to process HTML: ${error.message}`);
    }
  }

  /**
   * Extract metadata from HTML head
   */
  private extractMetadata($: cheerio.CheerioAPI): HTMLMetadata {
    const metadata: HTMLMetadata = {
      title: 'Untitled Document',
    };

    // Title
    const titleTag = $('title').first().text().trim();
    const ogTitle = $('meta[property="og:title"]').attr('content');
    metadata.title = titleTag || ogTitle || 'Untitled Document';

    // Description
    const metaDescription = $('meta[name="description"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    metadata.description = metaDescription || ogDescription;

    // Author
    const authorMeta = $('meta[name="author"]').attr('content');
    const articleAuthor = $('meta[property="article:author"]').attr('content');
    metadata.author = authorMeta || articleAuthor;

    // Keywords
    const keywordsMeta = $('meta[name="keywords"]').attr('content');
    if (keywordsMeta) {
      metadata.keywords = keywordsMeta.split(',').map(k => k.trim());
    }

    // Canonical URL
    const canonical = $('link[rel="canonical"]').attr('href');
    metadata.canonicalUrl = canonical;

    // Language
    const htmlLang = $('html').attr('lang');
    const metaLang = $('meta[http-equiv="content-language"]').attr('content');
    metadata.language = htmlLang || metaLang || 'en';

    return metadata;
  }

  /**
   * Remove unwanted HTML elements
   */
  private removeUnwantedElements($: cheerio.CheerioAPI): void {
    // Remove scripts, styles, and other non-content elements
    $(
      'script, style, noscript, iframe, object, embed, ' +
      'nav, header, footer, aside, ' +
      '.advertisement, .ads, .sidebar, .comment, ' +
      '[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
    ).remove();

    // Remove hidden elements
    $('[style*="display: none"], [style*="display:none"]').remove();
    $('.hidden, .hide').remove();

    // Remove tracking pixels and analytics
    $('img[width="1"][height="1"]').remove();
    $('img[src*="pixel"], img[src*="track"]').remove();
  }

  /**
   * Extract main content from HTML
   * Tries to find the main article/content area
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Priority list of selectors for main content
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main',
      'body',
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const html = element.html();
        if (html && html.trim().length > 100) {
          console.log(`   📄 Found main content using selector: ${selector}`);
          return html;
        }
      }
    }

    // Fallback to body
    console.log('   📄 Using body as main content');
    return $('body').html() || '';
  }

  /**
   * Clean up converted markdown
   */
  private cleanMarkdown(markdown: string): string {
    // Remove excessive newlines (max 2 consecutive)
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace
    markdown = markdown.trim();

    // Fix broken links (empty text)
    markdown = markdown.replace(/\[(\s*)\]\([^)]+\)/g, '');

    // Fix excessive spaces
    markdown = markdown.replace(/ {2,}/g, ' ');

    // Remove empty list items
    markdown = markdown.replace(/^[-*+]\s*$/gm, '');

    // Fix heading spacing (ensure blank line after headings)
    markdown = markdown.replace(/^(#{1,6}\s+.+)$/gm, '$1\n');

    // Remove stray HTML entities that weren't converted
    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");

    return markdown;
  }

  /**
   * Add custom Turndown rules for better conversion
   */
  private addCustomRules(): void {
    // Better handling of code blocks
    this.turndownService.addRule('pre-code', {
      filter: ['pre'],
      replacement: (content, node: any) => {
        const code = node.querySelector('code');
        const language = code ? (code.className.match(/language-(\w+)/) || [])[1] : '';
        return '\n\n```' + (language || '') + '\n' + content + '\n```\n\n';
      },
    });

    // Better handling of tables
    this.turndownService.addRule('table', {
      filter: 'table',
      replacement: (content, node: any) => {
        // Keep tables as HTML if they're complex
        if (node.querySelectorAll('colspan, rowspan').length > 0) {
          return '\n\n' + node.outerHTML + '\n\n';
        }
        return content;
      },
    });

    // Handle figure captions
    this.turndownService.addRule('figure', {
      filter: 'figure',
      replacement: (content, node: any) => {
        const caption = node.querySelector('figcaption');
        const captionText = caption ? caption.textContent.trim() : '';
        return content + (captionText ? '\n\n*' + captionText + '*\n\n' : '\n\n');
      },
    });

    // Handle definition lists
    this.turndownService.addRule('dl', {
      filter: 'dl',
      replacement: (content) => {
        return '\n\n' + content + '\n\n';
      },
    });

    this.turndownService.addRule('dt', {
      filter: 'dt',
      replacement: (content) => {
        return '**' + content + '**\n';
      },
    });

    this.turndownService.addRule('dd', {
      filter: 'dd',
      replacement: (content) => {
        return ': ' + content + '\n\n';
      },
    });
  }
}

export default new HTMLProcessorService();
