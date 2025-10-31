/** Image Processing Service - Minimal Stub */
class ImageProcessingService {
  async processImage(image: Buffer) { return image; }
  async resize(image: Buffer, width: number, height: number) { return image; }
  async generateThumbnail(image: Buffer) { return image; }
  async extractText(image: Buffer) { return ''; }
}
export default new ImageProcessingService();
