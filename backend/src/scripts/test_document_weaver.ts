/**
 * Test Script: Document Weaver Service
 *
 * Tests the three-pass document generation system:
 * 1. Content Generation
 * 2. Structure & Layout
 * 3. Rendering
 *
 * Run: npx ts-node src/scripts/test_document_weaver.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { documentWeaver } from '../services/documentWeaver.service';

// Check for required API key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set');
  process.exit(1);
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          DOCUMENT WEAVER - TEST SUITE                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../../output');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test 1: List available components
  console.log('🧪 Test 1: List Available Components');
  console.log('─'.repeat(50));
  const components = documentWeaver.getAvailableComponents();
  console.log(`Available components: ${components.join(', ')}`);
  console.log(`✅ Found ${components.length} components\n`);

  // Test 2: Get component schema
  console.log('🧪 Test 2: Get Component Schemas');
  console.log('─'.repeat(50));
  for (const comp of components.slice(0, 3)) {
    const schema = documentWeaver.getComponentSchema(comp as any);
    console.log(`\n${comp}:`);
    Object.entries(schema).forEach(([key, type]) => {
      console.log(`  - ${key}: ${type}`);
    });
  }
  console.log('\n✅ Schemas retrieved successfully\n');

  // Test 3: Generate a single slide preview
  console.log('🧪 Test 3: Generate Single Slide Preview');
  console.log('─'.repeat(50));
  try {
    const slideHtml = await documentWeaver.generateSlidePreview(
      'TitleSlide',
      {
        title: 'Welcome to Koda',
        subtitle: 'AI-Powered Document Generation',
        author: 'Koda Team',
        date: new Date().toLocaleDateString(),
      },
      'corporate'
    );
    console.log(`Generated HTML length: ${slideHtml.length} characters`);
    console.log(`Preview: ${slideHtml.substring(0, 100)}...`);
    console.log('✅ Slide preview generated successfully\n');
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  }

  // Test 4: Generate a full presentation
  console.log('🧪 Test 4: Generate Full Presentation');
  console.log('─'.repeat(50));

  const topics = [
    'The Future of Artificial Intelligence',
    'Sustainable Business Practices',
    'Digital Transformation Strategies',
  ];

  for (const topic of topics) {
    console.log(`\n📄 Generating: "${topic}"`);

    try {
      const startTime = Date.now();

      const result = await documentWeaver.generateDocument(topic, {
        theme: 'corporate',
        slideCount: 5,
        includeCharts: true,
        outputFormat: 'slides', // Get both HTML and JSON
      });

      const duration = Date.now() - startTime;

      console.log(`   ⏱️  Duration: ${duration}ms`);
      console.log(`   📊 Slides generated: ${result.metadata.slideCount}`);
      console.log(`   🌍 Language detected: ${result.metadata.language}`);
      console.log(`   🎨 Theme: ${result.metadata.theme}`);

      if (result.slides) {
        console.log('   📋 Slide structure:');
        result.slides.forEach((slide, i) => {
          console.log(`      ${i + 1}. ${slide.component}: ${slide.props.title || 'N/A'}`);
        });
      }

      // Save HTML output
      if (result.html) {
        const filename = `presentation-${topic.toLowerCase().replace(/\s+/g, '-').substring(0, 30)}.html`;
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, result.html);
        console.log(`   💾 Saved to: ${filePath}`);
      }

      console.log('   ✅ Success!');

    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  // Test 5: Generate with different themes
  console.log('\n\n🧪 Test 5: Generate with Different Themes');
  console.log('─'.repeat(50));

  const themes = ['light', 'dark', 'corporate', 'creative'] as const;
  const themeTopic = 'Introduction to Machine Learning';

  for (const theme of themes) {
    console.log(`\n🎨 Theme: ${theme}`);

    try {
      const result = await documentWeaver.generateDocument(themeTopic, {
        theme,
        slideCount: 3,
        outputFormat: 'html',
      });

      console.log(`   ✅ Generated ${result.metadata.slideCount} slides`);

      // Save themed output
      const filename = `presentation-${theme}-theme.html`;
      const filePath = path.join(outputDir, filename);
      if (result.html) {
        fs.writeFileSync(filePath, result.html);
        console.log(`   💾 Saved to: ${filePath}`);
      }

    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  // Test 6: Generate Portuguese presentation
  console.log('\n\n🧪 Test 6: Multi-language Support');
  console.log('─'.repeat(50));

  const multiLangTopics = [
    { topic: 'O Futuro da Inteligência Artificial', lang: 'Portuguese' },
    { topic: 'El Futuro de la Inteligencia Artificial', lang: 'Spanish' },
    { topic: 'L\'avenir de l\'intelligence artificielle', lang: 'French' },
  ];

  for (const { topic, lang } of multiLangTopics) {
    console.log(`\n🌍 ${lang}: "${topic}"`);

    try {
      const result = await documentWeaver.generateDocument(topic, {
        theme: 'corporate',
        slideCount: 3,
        outputFormat: 'json',
      });

      console.log(`   ✅ Language detected: ${result.metadata.language}`);
      console.log(`   📊 Slides: ${result.metadata.slideCount}`);

      if (result.outline) {
        console.log(`   📄 Title: ${result.outline.title}`);
      }

    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📁 Output files saved to: ${outputDir}`);
  console.log('\n✅ All tests completed!\n');
}

// Run the tests
runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
