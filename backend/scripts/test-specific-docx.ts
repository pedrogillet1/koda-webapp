import { getDocumentPreview } from '../src/services/document.service';
import prisma from '../src/config/database';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DOCUMENT_ID = 'f5fe8b59-d7d3-484b-ba86-df908cfc50ca';

async function testSpecificDocx() {
  console.log('\n🔍 Testing Specific DOCX Document\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get document from database
    const doc = await prisma.document.findUnique({
      where: { id: DOCUMENT_ID },
      include: { metadata: true }
    });

    if (!doc) {
      console.error('❌ Document not found');
      return;
    }

    console.log('📄 Document Info:');
    console.log(`   ID: ${doc.id}`);
    console.log(`   Filename: ${doc.filename}`);
    console.log(`   MIME Type: ${doc.mimeType}`);
    console.log(`   User ID: ${doc.userId}`);
    console.log(`   Size: ${doc.fileSize} bytes\n`);

    // Get preview
    console.log('📡 Calling getDocumentPreview...\n');
    const preview = await getDocumentPreview(DOCUMENT_ID, doc.userId);

    console.log('✅ Preview Response:');
    console.log(`   Preview Type: ${preview.previewType}`);
    console.log(`   Original Type: ${preview.originalType}`);
    console.log(`   Filename: ${preview.filename}`);
    console.log(`   Preview URL Length: ${preview.previewUrl.length} characters`);
    console.log(`   Preview URL: ${preview.previewUrl}\n`);

    // Download and test the PDF
    console.log('📥 Downloading PDF from signed URL...\n');
    const tempPdfPath = path.join(os.tmpdir(), `test-${DOCUMENT_ID}.pdf`);

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(tempPdfPath);

      https.get(preview.previewUrl, (response) => {
        console.log(`   HTTP Status: ${response.statusCode}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Content-Length: ${response.headers['content-length']} bytes\n`);

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(tempPdfPath, () => {});
        reject(err);
      });
    });

    const stats = fs.statSync(tempPdfPath);
    console.log(`✅ PDF Downloaded: ${tempPdfPath}`);
    console.log(`   Size: ${stats.size} bytes\n`);

    // Check if it's a valid PDF
    const buffer = fs.readFileSync(tempPdfPath);
    const header = buffer.slice(0, 8).toString();

    console.log('🔍 PDF Validation:');
    console.log(`   File Header: ${header}`);
    console.log(`   Starts with %PDF-: ${header.startsWith('%PDF-')}`);
    console.log(`   First 100 bytes: ${buffer.slice(0, 100).toString('hex')}\n`);

    if (header.startsWith('%PDF-')) {
      console.log('✅ Valid PDF file!\n');
    } else {
      console.log('❌ NOT a valid PDF file!\n');
      console.log('First 500 characters of file content:');
      console.log(buffer.slice(0, 500).toString());
    }

    // Clean up
    fs.unlinkSync(tempPdfPath);
    console.log('✅ Cleanup complete\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testSpecificDocx().catch(console.error);
