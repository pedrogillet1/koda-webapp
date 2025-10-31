import vision from '@google-cloud/vision';
import { config } from '../config/env';

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
 * Extract text from PDF document (for scanned PDFs)
 * @param pdfBuffer - Buffer containing the PDF data
 * @returns Extracted text and confidence score
 */
export const extractTextFromScannedPDF = async (pdfBuffer: Buffer): Promise<OCRResult> => {
  try {
    console.log('🔍 Attempting Google Cloud Vision PDF extraction...');
    // For scanned PDFs, Vision API can process them directly
    const [result] = await visionClient.documentTextDetection(pdfBuffer);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      console.warn('⚠️ Google Cloud Vision returned no text for PDF');
      console.warn('Result:', JSON.stringify(result, null, 2).substring(0, 500));
      return {
        text: '',
        confidence: 0,
      };
    }

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

    console.log(`✅ Google Cloud Vision extracted ${fullTextAnnotation.text.length} characters from PDF`);
    return {
      text: fullTextAnnotation.text,
      confidence: averageConfidence,
    };
  } catch (error: any) {
    console.error('❌ Error extracting text from scanned PDF with Google Cloud Vision:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to extract text from scanned PDF: ${error.message}`);
  }
};
