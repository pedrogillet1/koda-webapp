/**
 * PPTX Slide Generator Service - STUB (service removed)
 */

export const checkLibreOffice = async () => ({ installed: false, error: 'Service removed' });
export const generateSlide = async () => ({ content: '', error: 'Service removed' });

export const pptxSlideGeneratorService = {
  checkLibreOffice,
  generateSlide,
};

export default {
  checkLibreOffice,
  generateSlide,
};
