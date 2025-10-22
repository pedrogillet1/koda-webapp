// Simple Google Cloud Vision API Test
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
    console.log('🔌 Initializing Vision API client...');
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GCS_KEY_FILE,
      projectId: process.env.GCS_PROJECT_ID,
    });

    console.log('✅ Client initialized successfully!\n');

    // Create a simple 1x1 red pixel PNG image
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    console.log('🧪 Testing with simple image...');

    const [result] = await client.textDetection({
      image: { content: testImageBuffer },
    });

    console.log('✅ Vision API request successful!\n');

    if (result.textAnnotations && result.textAnnotations.length > 0) {
      console.log('📝 Text found:', result.textAnnotations[0].description);
    } else {
      console.log('📝 No text detected (expected for test image)');
    }

    console.log('\n🎉 Google Cloud Vision API is working correctly!\n');
    console.log('✅ Your setup is complete! Next steps:\n');
    console.log('   1. Make sure Redis is running: redis-server');
    console.log('   2. Start backend: npm run dev');
    console.log('   3. Upload a real document with text to test OCR\n');
    console.log('🚨 IMPORTANT: Rotate your service account key!');
    console.log('   Run: gcloud iam service-accounts keys delete c97c802b2a910e468f743b23b0012b29064bbfe8 \\');
    console.log('        --iam-account=test-143@psychic-catwalk-474012-q1.iam.gserviceaccount.com\n');

  } catch (error) {
    console.error('❌ Vision API Test Failed!\n');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:\n');

    if (error.message.includes('ENOENT')) {
      console.error('   ❌ Key file not found');
      console.error('   ➜ Check GCS_KEY_FILE path in .env');
      console.error('   ➜ Make sure gcp-service-account.json exists');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('   ❌ Permission denied');
      console.error('   ➜ Add "Cloud Vision API User" role to your service account');
      console.error('   ➜ Link: https://console.cloud.google.com/iam-admin/iam?project=psychic-catwalk-474012-q1');
    } else if (error.message.includes('API has not been used')) {
      console.error('   ❌ Vision API not enabled');
      console.error('   ➜ Enable it: https://console.cloud.google.com/apis/library/vision.googleapis.com?project=psychic-catwalk-474012-q1');
    } else if (error.message.includes('Could not load the default credentials')) {
      console.error('   ❌ Invalid credentials');
      console.error('   ➜ Check your service account JSON file');
      console.error('   ➜ Verify GCS_PROJECT_ID matches your project');
    } else if (error.code === 7) {
      console.error('   ❌ Vision API not enabled or no permissions');
      console.error('   ➜ Enable API: https://console.cloud.google.com/apis/library/vision.googleapis.com?project=psychic-catwalk-474012-q1');
      console.error('   ➜ Add roles to service account (IAM page)');
    } else {
      console.error('\n   Full error details:');
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      if (error.details) console.error('   Details:', error.details);
    }
    console.error('');
    process.exit(1);
  }
}

testVisionAPI();
