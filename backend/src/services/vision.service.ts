import vision from '@google-cloud/vision';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { config } from '../config/env';
import { pdfToPng } from 'pdf-to-png-converter';

// Initialize Google Cloud Vision client
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: config.GCS_KEY_FILE,
  projectId: config.GCS_PROJECT_ID,
});

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
}

/**
 * Extract text from an image using Google Cloud Vision API
 * @param imageBuffer - Buffer containing the image data
 * @returns Extracted text and confidence score
 */
export const extractTextFromImage = async (imageBuffer: Buffer): Promise<OCRResult> => {
  try {
    const [result] = await visionClient.documentTextDetection(imageBuffer);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return {
        text: '',
        confidence: 0,
      };
    }

    // Calculate average confidence from all pages
    const pages = fullTextAnnotation.pages || [];
    let totalConfidence = 0;
    let wordCount = 0;

    pages.forEach((page) => {
      page.blocks?.forEach((block) => {
        block.paragraphs?.forEach((paragraph) => {
          paragraph.words?.forEach((word) => {
            if (word.confidence) {
              totalConfidence += word.confidence;
              wordCount++;
            }
          });
        });
      });
    });

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

    // Detect language
    const detectedLanguages = fullTextAnnotation.pages?.[0]?.property?.detectedLanguages;
    const primaryLanguage = detectedLanguages?.[0]?.languageCode;

    return {
      text: fullTextAnnotation.text,
      confidence: averageConfidence,
      language: (primaryLanguage as string | undefined),
    };
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error('Failed to extract text from image');
  }
};

/**
 * Detect handwriting in an image
 * @param imageBuffer - Buffer containing the image data
 * @returns Extracted handwritten text and confidence score
 */
export const detectHandwriting = async (imageBuffer: Buffer): Promise<OCRResult> => {
  try {
    const [result] = await visionClient.documentTextDetection(imageBuffer);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return {
        text: '',
        confidence: 0,
      };
    }

    // For handwriting, use the same document text detection
    // Vision API automatically handles handwriting
    const pages = fullTextAnnotation.pages || [];
    let totalConfidence = 0;
    let wordCount = 0;

    pages.forEach((page) => {
      page.blocks?.forEach((block) => {
        block.paragraphs?.forEach((paragraph) => {
          paragraph.words?.forEach((word) => {
            if (word.confidence) {
              totalConfidence += word.confidence;
              wordCount++;
            }
          });
        });
      });
    });

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

    return {
      text: fullTextAnnotation.text,
      confidence: averageConfidence,
    };
  } catch (error) {
    console.error('Error detecting handwriting:', error);
    throw new Error('Failed to detect handwriting');
  }
};

/**
 * Detect document type and extract structured data
 * @param imageBuffer - Buffer containing the image data
 * @returns Document classification and extracted entities
 */
export const detectDocumentType = async (
  imageBuffer: Buffer
): Promise<{
  type: string;
  entities: Record<string, string>;
}> => {
  try {
    // Use text detection to extract content
    const [result] = await visionClient.documentTextDetection(imageBuffer);
    const text = result.fullTextAnnotation?.text || '';

    // Simple heuristic-based classification
    // In production, you could use a ML model or more sophisticated logic
    let type = 'unknown';
    const entities: Record<string, string> = {};

    const lowerText = text.toLowerCase();

    if (lowerText.includes('invoice') || lowerText.includes('bill')) {
      type = 'invoice';
    } else if (lowerText.includes('receipt')) {
      type = 'receipt';
    } else if (lowerText.includes('contract') || lowerText.includes('agreement')) {
      type = 'contract';
    } else if (lowerText.includes('report')) {
      type = 'report';
    } else if (lowerText.includes('statement')) {
      type = 'statement';
    }

    // Extract potential dates (simple regex)
    const dateRegex = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
    const dates = text.match(dateRegex);
    if (dates && dates.length > 0) {
      entities.dates = dates.join(', ');
    }

    // Extract potential amounts (simple regex for currency)
    const amountRegex = /\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const amounts = text.match(amountRegex);
    if (amounts && amounts.length > 0) {
      entities.amounts = amounts.join(', ');
    }

    return {
      type,
      entities,
    };
  } catch (error) {
    console.error('Error detecting document type:', error);
    throw new Error('Failed to detect document type');
  }
};

/**
 * Extract text from scanned PDF using Google Document AI (enhanced for books)
 * Falls back to Vision API if Document AI is not configured
 * @param pdfBuffer - Buffer containing the PDF data
 * @returns Extracted text and confidence score
 */
export const extractTextFromScannedPDF = async (pdfBuffer: Buffer): Promise<OCRResult> => {
  // Try Document AI first (better for complex layouts like books)
  if (process.env.DOCUMENT_AI_PROCESSOR_ID && process.env.GOOGLE_CLOUD_PROJECT_ID) {
    try {
      console.log('📄 [OCR] Starting Document AI processing...');

      const client = new DocumentProcessorServiceClient({
        keyFilename: config.GCS_KEY_FILE,
        projectId: config.GCS_PROJECT_ID,
      });

      const name = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/us/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

      const request = {
        name,
        rawDocument: {
          content: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      };

      const [result] = await client.processDocument(request);
      const { document } = result;

      if (!document || !document.text) {
        throw new Error('No text extracted from document');
      }

      console.log(`✅ [OCR] Document AI extracted ${document.text.length} characters`);
      console.log(`📊 [OCR] Document has ${document.pages?.length || 0} pages`);

      // Document AI preserves layout, columns, tables
      return {
        text: document.text,
        confidence: 0.99, // Document AI is very accurate
        language: document.pages?.[0]?.detectedLanguages?.[0]?.languageCode || 'unknown',
      };
    } catch (error: any) {
      console.error('❌ [OCR] Document AI failed:', error.message);
      console.log('⚠️  [OCR] Falling back to Google Vision API...');
      // Fall through to Vision API fallback below
    }
  }

  // Fallback: Use Vision API (original method)
  return await extractTextFromScannedPDFWithVision(pdfBuffer);
};

/**
 * Extract text from scanned PDF by converting to images first (Vision API fallback)
 * @param pdfBuffer - Buffer containing the PDF data
 * @returns Extracted text and confidence score
 */
async function extractTextFromScannedPDFWithVision(pdfBuffer: Buffer): Promise<OCRResult> {
  try {
    console.log('🔍 Converting PDF to images for OCR...');

    // Convert PDF to PNG images (all pages)
    // When outputFolder is not specified, it returns buffers by default
    const pngPages = await pdfToPng(pdfBuffer, {
      viewportScale: 2.0, // Higher quality for better OCR
    });

    console.log(`  ✅ Converted ${pngPages.length} pages to images`);

    let allText = '';
    let totalConfidence = 0;
    let wordCount = 0;

    // Process each page (limit to 10 for cost control)
    const pagesToProcess = pngPages.slice(0, 10);

    for (let i = 0; i < pagesToProcess.length; i++) {
      const pageNum = i + 1;
      const page = pagesToProcess[i];

      try {
        // OCR the image
        const [result] = await visionClient.documentTextDetection(page.content);
        const fullTextAnnotation = result.fullTextAnnotation;

        if (fullTextAnnotation && fullTextAnnotation.text) {
          allText += fullTextAnnotation.text + '\n\n';

          // Calculate confidence
          const pages = fullTextAnnotation.pages || [];
          pages.forEach((page) => {
            page.blocks?.forEach((block) => {
              block.paragraphs?.forEach((paragraph) => {
                paragraph.words?.forEach((word) => {
                  if (word.confidence) {
                    totalConfidence += word.confidence;
                    wordCount++;
                  }
                });
              });
            });
          });
        }

        console.log(`  ✅ Page ${pageNum}: ${fullTextAnnotation?.text?.length || 0} chars`);
      } catch (pageError) {
        console.log(`  ⚠️ Page ${pageNum} failed:`, pageError);
        // Continue with next page
      }
    }

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

    console.log(`✅ OCR complete: ${allText.length} characters, confidence: ${averageConfidence.toFixed(2)}`);

    return {
      text: allText.trim(),
      confidence: averageConfidence,
    };
  } catch (error: any) {
    console.error('❌ PDF OCR failed:', error.message);
    throw new Error(`Failed to extract text from scanned PDF: ${error.message}`);
  }
}
