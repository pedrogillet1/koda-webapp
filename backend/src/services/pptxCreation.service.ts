import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import geminiService from './gemini.service';
import manusService from './manus.service';
import { uploadFileToS3 } from './s3Storage.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SlideContent {
  id: string;
  page_title: string;
  summary: string;
  content: string;
}

interface PPTXCreationParams {
  userId: string;
  topic: string;
  slideCount?: number;
  conversationId?: string | null;
}

class PPTXCreationService {

  /**
   * Create PPTX presentation using Manus slide system
   */
  async createPPTX(params: PPTXCreationParams): Promise<any> {
    const { userId, topic, slideCount = 8, conversationId } = params;

    console.log(`📊 [PPTX] Creating presentation about: "${topic}"`);
    console.log(`📊 [PPTX] Slide count: ${slideCount}`);

    const projectId = uuidv4();
    const projectDir = `/tmp/koda-slides-${projectId}`;
    const timestamp = Date.now();

    try {
      // Step 1: Generate presentation outline
      console.log(`📊 [PPTX] Step 1: Generating outline...`);
      const outline = await this.generateOutline(topic, slideCount);

      // Step 2: Initialize slide project
      console.log(`📊 [PPTX] Step 2: Initializing slide project...`);
      await this.initializeSlideProject(projectDir, topic, outline);

      // Step 3: Generate content for each slide
      console.log(`📊 [PPTX] Step 3: Generating slide content...`);
      await this.generateSlideContent(projectDir, outline, topic);

      // Step 4: Export to PPTX
      console.log(`📊 [PPTX] Step 4: Exporting to PPTX...`);
      const pptxPath = await this.exportToPPTX(projectDir);

      // Step 5: Upload to S3
      console.log(`📊 [PPTX] Step 5: Uploading to S3...`);
      const fileBuffer = await fs.readFile(pptxPath);
      const filename = `${topic.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pptx`;
      const s3Key = `users/${userId}/generated/${projectId}-${timestamp}/${filename}`;

      const s3Url = await uploadFileToS3(s3Key, fileBuffer, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

      console.log(`✅ [PPTX] Uploaded to S3: ${s3Url}`);

      // Step 6: Create database records
      console.log(`📊 [PPTX] Step 6: Creating database records...`);
      const generatedDoc = await prisma.generatedDocument.create({
        data: {
          id: projectId,
          userId,
          conversationId,
          generationType: 'from_prompt',
          prompt: `Create a presentation about ${topic}`,
          renderableContent: JSON.stringify(outline),
          fileType: 'pptx',
          fileName: filename,
          fileSize: fileBuffer.length,
          s3Url,
          isTemporary: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Step 7: Cleanup temp files
      console.log(`📊 [PPTX] Step 7: Cleaning up...`);
      await fs.rm(projectDir, { recursive: true, force: true });
      await fs.unlink(pptxPath).catch(() => {});

      console.log(`✅ [PPTX] Presentation created successfully`);

      return {
        id: generatedDoc.id,
        filename,
        s3Url,
        slideCount: outline.length,
        topic,
      };

    } catch (error) {
      console.error(`❌ [PPTX] Creation failed:`, error);

      // Cleanup on error
      await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {});

      throw error;
    }
  }

  /**
   * Generate presentation outline using Gemini
   */
  private async generateOutline(topic: string, slideCount: number): Promise<SlideContent[]> {
    const prompt = `Create a professional presentation outline about "${topic}".

Requirements:
- ${slideCount} slides total (including title and conclusion)
- First slide: Title slide with main topic
- Middle slides: Key points with detailed content
- Last slide: Conclusion and key takeaways

For each slide, provide:
1. id: lowercase_with_underscores (e.g., "introduction", "key_benefits")
2. page_title: Short, clear title
3. summary: 1-2 sentence description of slide content
4. content: Detailed bullet points or paragraphs (3-5 points per slide)

Return as JSON array:
[
  {
    "id": "title_slide",
    "page_title": "Main Topic Title",
    "summary": "Introduction to the topic",
    "content": "• Main point\\n• Supporting detail\\n• Key insight"
  },
  ...
]`;

    const response = await geminiService.generateText({
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse outline from AI response');
    }

    const outline: SlideContent[] = JSON.parse(jsonMatch[0]);

    // Ensure we have the right number of slides
    if (outline.length !== slideCount) {
      console.warn(`⚠️  [PPTX] Expected ${slideCount} slides, got ${outline.length}`);
    }

    return outline;
  }

  /**
   * Initialize slide project directory
   */
  private async initializeSlideProject(
    projectDir: string,
    mainTitle: string,
    outline: SlideContent[]
  ): Promise<void> {
    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });

    // Create slide_state.json
    const slideState = {
      main_title: mainTitle,
      style_instruction: {
        aesthetic_direction: "Professional corporate design with clean layouts and data visualization focus",
        color_palette: "#6366f1 (primary), #8b5cf6 (accent), #1e293b (text), #f8fafc (background)",
        typography: "Inter font family - Front: 64px/32px/20px, Content: 32px/20px/16px"
      },
      slides: outline.map((slide, index) => ({
        id: slide.id,
        page_title: slide.page_title,
        summary: slide.summary,
        index: index + 1,
        status: 'pending',
        file_path: `${projectDir}/${slide.id}.html`
      }))
    };

    await fs.writeFile(
      path.join(projectDir, 'slide_state.json'),
      JSON.stringify(slideState, null, 2)
    );

    console.log(`✅ [PPTX] Slide project initialized at ${projectDir}`);
  }

  /**
   * Generate HTML content for each slide
   */
  private async generateSlideContent(
    projectDir: string,
    outline: SlideContent[],
    topic: string
  ): Promise<void> {
    for (let i = 0; i < outline.length; i++) {
      const slide = outline[i];
      console.log(`📝 [PPTX] Generating slide ${i + 1}/${outline.length}: ${slide.page_title}`);

      const html = this.generateSlideHTML(slide, i === 0, i === outline.length - 1);

      await fs.writeFile(
        path.join(projectDir, `${slide.id}.html`),
        html
      );
    }

    console.log(`✅ [PPTX] All slides generated`);
  }

  /**
   * Generate HTML for a single slide
   */
  private generateSlideHTML(slide: SlideContent, isTitle: boolean, isConclusion: boolean): string {
    if (isTitle) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${slide.page_title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; }
    .slide-container { min-height: 720px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; }
    h1 { font-size: 64px; font-weight: 700; margin-bottom: 32px; text-align: center; }
    .subtitle { font-size: 32px; font-weight: 400; opacity: 0.9; text-align: center; }
    .footer { position: absolute; bottom: 40px; right: 40px; font-size: 16px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="slide-container">
    <h1>${slide.page_title}</h1>
    <div class="subtitle">${slide.summary}</div>
    <div class="footer">Created by Koda AI</div>
  </div>
</body>
</html>`;
    }

    // Content slide
    const contentPoints = slide.content.split('\n').filter(p => p.trim());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${slide.page_title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
    .slide-container { min-height: 720px; padding: 60px 80px; }
    h2 { font-size: 32px; font-weight: 700; color: #6366f1; margin-bottom: 40px; }
    .content { font-size: 20px; line-height: 1.6; }
    .content ul { list-style: none; }
    .content li { padding-top: 20px; position: relative; padding-left: 30px; }
    .content li:before { content: "•"; position: absolute; left: 0; color: #6366f1; font-weight: bold; font-size: 24px; }
    .footer { position: absolute; bottom: 40px; right: 40px; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="slide-container">
    <h2>${slide.page_title}</h2>
    <div class="content">
      <ul>
        ${contentPoints.map(point => `<li>${point.replace(/^[•\-]\s*/, '')}</li>`).join('\n        ')}
      </ul>
    </div>
    <div class="footer">Created by Koda AI</div>
  </div>
</body>
</html>`;
  }

  /**
   * Export slide project to PPTX using Manus service
   */
  private async exportToPPTX(projectDir: string): Promise<string> {
    const outputPath = `${projectDir}/presentation.pptx`;

    try {
      // First, combine all HTML slides into a single presentation HTML
      const slideFiles = await fs.readdir(projectDir);
      const htmlFiles = slideFiles.filter(f => f.endsWith('.html'));

      // Create a combined HTML with all slides
      let combinedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation</title>
</head>
<body>`;

      for (const htmlFile of htmlFiles.sort()) {
        if (htmlFile === 'presentation.html') continue; // Skip if exists
        const htmlContent = await fs.readFile(path.join(projectDir, htmlFile), 'utf-8');
        // Extract the slide content (body content)
        const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/);
        if (bodyMatch) {
          combinedHTML += `<div class="slide">${bodyMatch[1]}</div>\n`;
        }
      }

      combinedHTML += `
</body>
</html>`;

      // Write combined HTML
      const htmlPath = path.join(projectDir, 'presentation.html');
      await fs.writeFile(htmlPath, combinedHTML);

      console.log(`✅ [PPTX] Combined HTML created: ${htmlPath}`);

      // Use Manus service to convert HTML to PPTX
      const buffer = await manusService.convertHTMLToPPTX(htmlPath, outputPath);

      // Write buffer to file
      await fs.writeFile(outputPath, buffer);

      console.log(`✅ [PPTX] PPTX created successfully: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`❌ [PPTX] Export failed:`, error);
      throw new Error('Failed to export slides to PPTX');
    }
  }
}

const pptxCreationService = new PPTXCreationService();
export default pptxCreationService;
