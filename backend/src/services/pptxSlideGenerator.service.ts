/**
 * PPTX Slide Generator Service - STUB (service removed)
 */

export const checkLibreOffice = async () => ({ installed: false, error: 'Service removed' });
export const generateSlide = async () => ({ content: '', error: 'Service removed' });

export interface SlideImageResult {
  success: boolean;
  slides: Array<{
    slideNumber: number;
    publicUrl?: string;
    width?: number;
    height?: number;
  }>;
  error?: string;
}

export const generateSlideImages = async (
  _filePath: string,
  _documentId: string,
  _options?: { uploadToGCS?: boolean; maxWidth?: number; quality?: number }
): Promise<SlideImageResult> => ({
  success: false,
  slides: [],
  error: 'Service removed'
});

export const pptxSlideGeneratorService = {
  checkLibreOffice,
  generateSlide,
  generateSlideImages,
};

// Used for default import AND named class access
export class PPTXSlideGeneratorService {
  static checkLibreOffice = checkLibreOffice;
  static generateSlide = generateSlide;
  static generateSlideImages = generateSlideImages;
}

export default {
  checkLibreOffice,
  generateSlide,
  generateSlideImages,
  PPTXSlideGeneratorService,
};
