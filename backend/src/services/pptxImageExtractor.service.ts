import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { getSignedUrl, uploadFile } from '../config/storage';

interface ExtractedImage {
  slideNumber: number;
  imageNumber: number;
  filename: string;
  localPath: string;
  gcsPath?: string;
  imageUrl?: string;
}

interface SlideWithImages {
  slideNumber: number;
  images: ExtractedImage[];
  compositeImageUrl?: string;
}

/**
 * Extract images directly from PPTX file structure
 * This bypasses LibreOffice and extracts embedded images from the ZIP archive
 */
export class PPTXImageExtractorService {

  /**
   * Extract all images from PPTX and organize by slide
   */
  async extractImages(
    pptxFilePath: string,
    documentId: string,
    options: {
      uploadToGCS?: boolean;
      outputDir?: string;
    } = {}
  ): Promise<{
    success: boolean;
    slides?: SlideWithImages[];
    totalImages?: number;
    error?: string;
  }> {
    try {
      console.log('📸 [PPTX Image Extractor] Starting image extraction...');

      const { uploadToGCS = true, outputDir } = options;

      // 1. Create temp directory
      const tempDir = outputDir || path.join(process.cwd(), 'temp', `pptx-images-${documentId}-${Date.now()}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 2. Extract PPTX (it's a ZIP file)
      console.log('📦 [PPTX Image Extractor] Extracting PPTX archive...');
      const zip = new AdmZip(pptxFilePath);
      const zipEntries = zip.getEntries();

      // 3. Find all images in ppt/media/
      const mediaImages: { [key: string]: Buffer } = {};
      zipEntries.forEach(entry => {
        if (entry.entryName.startsWith('ppt/media/') && !entry.isDirectory) {
          const filename = path.basename(entry.entryName);
          if (/\.(png|jpg|jpeg|gif|bmp|tiff|webp)$/i.test(filename)) {
            mediaImages[filename] = entry.getData();
            console.log(`   Found image: ${filename} (${entry.getData().length} bytes)`);
          }
        }
      });

      console.log(`✅ [PPTX Image Extractor] Found ${Object.keys(mediaImages).length} images in media folder`);

      // 4. Parse slide relationships to map images to slides
      const slideImageMap = await this.mapImagesToSlides(zip);

      // 5. Save images and organize by slide
      const slides: SlideWithImages[] = [];
      let totalImagesSaved = 0;

      for (const [slideNumber, imageRefs] of Object.entries(slideImageMap)) {
        const slideNum = parseInt(slideNumber);
        const slideImages: ExtractedImage[] = [];

        for (let i = 0; i < imageRefs.length; i++) {
          const imageRef = imageRefs[i];
          const imageBuffer = mediaImages[imageRef];

          if (!imageBuffer) {
            console.warn(`⚠️  Image ${imageRef} referenced in slide ${slideNum} but not found in media`);
            continue;
          }

          // Save image to temp directory
          const outputFilename = `slide-${slideNum}-image-${i + 1}.png`;
          const outputPath = path.join(tempDir, outputFilename);

          // Convert to PNG with Sharp for consistency
          await sharp(imageBuffer)
            .png({ quality: 90 })
            .toFile(outputPath);

          slideImages.push({
            slideNumber: slideNum,
            imageNumber: i + 1,
            filename: outputFilename,
            localPath: outputPath
          });

          totalImagesSaved++;
        }

        if (slideImages.length > 0) {
          slides.push({
            slideNumber: slideNum,
            images: slideImages
          });
        }
      }

      console.log(`✅ [PPTX Image Extractor] Saved ${totalImagesSaved} images from ${slides.length} slides`);

      // 6. Upload to GCS if requested
      if (uploadToGCS) {
        console.log('☁️  [PPTX Image Extractor] Uploading images to GCS...');

        for (const slide of slides) {
          for (const image of slide.images) {
            const gcsPath = `slides/${documentId}/slide-${slide.slideNumber}-image-${image.imageNumber}.png`;

            try {
              await uploadFile(image.localPath, gcsPath);
              image.gcsPath = `gcs://${process.env.GCS_BUCKET_NAME}/${gcsPath}`;
              image.imageUrl = await getSignedUrl(gcsPath, 3600);
              console.log(`   ✅ Uploaded: ${gcsPath}`);
            } catch (uploadError) {
              console.error(`   ❌ Failed to upload ${gcsPath}:`, uploadError);
            }
          }
        }
      }

      // 7. Clean up temp directory
      if (!outputDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      return {
        success: true,
        slides,
        totalImages: totalImagesSaved
      };

    } catch (error: any) {
      console.error('❌ [PPTX Image Extractor] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse slide XML relationships to map images to specific slides
   */
  private async mapImagesToSlides(zip: AdmZip): Promise<{ [slideNumber: number]: string[] }> {
    const slideImageMap: { [slideNumber: number]: string[] } = {};

    try {
      const entries = zip.getEntries();

      // Find all slide XML files
      const slideFiles = entries.filter(e =>
        e.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/)
      );

      for (const slideFile of slideFiles) {
        const match = slideFile.entryName.match(/slide(\d+)\.xml$/);
        if (!match) continue;

        const slideNumber = parseInt(match[1]);
        const slideXml = slideFile.getData().toString('utf8');

        // Find relationship file for this slide
        const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
        const relsEntry = zip.getEntry(relsPath);

        if (!relsEntry) {
          console.warn(`⚠️  No relationships file found for slide ${slideNumber}`);
          continue;
        }

        const relsXml = relsEntry.getData().toString('utf8');

        // Extract image relationships (Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" )
        const imageRelRegex = /<Relationship[^>]+Type="[^"]*\/image"[^>]+Target="\.\.\/media\/([^"]+)"/g;
        const imageRefs: string[] = [];
        let relMatch;

        while ((relMatch = imageRelRegex.exec(relsXml)) !== null) {
          imageRefs.push(relMatch[1]);
        }

        if (imageRefs.length > 0) {
          slideImageMap[slideNumber] = imageRefs;
          console.log(`   Slide ${slideNumber}: ${imageRefs.length} images`);
        }
      }

      console.log(`✅ [PPTX Image Extractor] Mapped images for ${Object.keys(slideImageMap).length} slides`);

    } catch (error) {
      console.error('❌ Error parsing slide relationships:', error);
    }

    return slideImageMap;
  }
}

export const pptxImageExtractorService = new PPTXImageExtractorService();
