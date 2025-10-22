// Test Google Cloud Vision API Connection
require('dotenv').config();
const vision = require('@google-cloud/vision');

async function testVisionAPI() {
  try {
    console.log('🔍 Testing Google Cloud Vision API connection...\n');

    // Check environment variables
    console.log('📋 Configuration:');
    console.log(`   Project ID: ${process.env.GCS_PROJECT_ID}`);
    console.log(`   Key File: ${process.env.GCS_KEY_FILE}\n`);

    // Initialize client
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GCS_KEY_FILE,
      projectId: process.env.GCS_PROJECT_ID,
    });

    // Test with a simple text detection
    console.log('🧪 Running test OCR...');

    // Create a simple test image with text (base64 encoded "Hello World")
    const testImage = {
      content: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    };

    const [result] = await client.textDetection(testImage);

    console.log('✅ Vision API connected successfully!\n');
    console.log('📊 API Response Structure:');
    console.log('   - textAnnotations:', result.textAnnotations ? 'Available' : 'Empty');
    console.log('   - fullTextAnnotation:', result.fullTextAnnotation ? 'Available' : 'Empty');

    console.log('\n🎉 Google Cloud Vision API is ready to use!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start your backend: npm run dev');
    console.log('   2. Upload a document with text or an image');
    console.log('   3. Check processing status to see extracted text\n');

  } catch (error) {
    console.error('❌ Vision API Test Failed!\n');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');

    if (error.message.includes('ENOENT')) {
      console.error('   ❌ Key file not found');
      console.error('   ➜ Check GCS_KEY_FILE path in .env');
      console.error('   ➜ Make sure gcp-service-account.json exists');
    } else if (error.message.includes('Permission denied')) {
      console.error('   ❌ Permission denied');
      console.error('   ➜ Add "Cloud Vision API User" role to your service account');
    } else if (error.message.includes('API has not been used')) {
      console.error('   ❌ Vision API not enabled');
      console.error('   ➜ Run: gcloud services enable vision.googleapis.com');
    } else if (error.message.includes('Could not load the default credentials')) {
      console.error('   ❌ Invalid credentials');
      console.error('   ➜ Check your service account JSON file');
      console.error('   ➜ Verify GCS_PROJECT_ID matches your project');
    } else {
      console.error('   ➜ Full error:', error);
    }
    console.error('');
    process.exit(1);
  }
}

testVisionAPI();
