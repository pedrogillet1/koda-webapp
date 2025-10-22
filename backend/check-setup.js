// Google Cloud Setup Checker
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Google Cloud Setup...\n');

let allGood = true;

// Check 1: .env file exists
console.log('1️⃣  Checking .env file...');
if (!fs.existsSync('.env')) {
  console.log('   ❌ .env file not found!');
  console.log('   ➜ Copy .env.example to .env\n');
  allGood = false;
} else {
  console.log('   ✅ .env file exists\n');
}

// Check 2: Project ID
console.log('2️⃣  Checking GCS_PROJECT_ID...');
const projectId = process.env.GCS_PROJECT_ID;
if (!projectId || projectId === 'your-gcp-project-id') {
  console.log('   ❌ GCS_PROJECT_ID not set or using placeholder');
  console.log('   ➜ Update GCS_PROJECT_ID in .env with your actual project ID');
  console.log('   ➜ Find it at: https://console.cloud.google.com\n');
  allGood = false;
} else {
  console.log(`   ✅ Project ID: ${projectId}\n`);
}

// Check 3: Bucket Name
console.log('3️⃣  Checking GCS_BUCKET_NAME...');
const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName || bucketName === 'koda-documents-dev') {
  console.log('   ⚠️  Using default bucket name: koda-documents-dev');
  console.log('   ➜ Make sure this bucket exists in your GCP project\n');
} else {
  console.log(`   ✅ Bucket: ${bucketName}\n`);
}

// Check 4: Service Account JSON File
console.log('4️⃣  Checking service account JSON file...');
const keyFile = process.env.GCS_KEY_FILE || './gcp-service-account.json';
const keyPath = path.resolve(keyFile);

if (!fs.existsSync(keyPath)) {
  console.log(`   ❌ Service account file not found: ${keyPath}`);
  console.log('   ➜ Download JSON key from: https://console.cloud.google.com/iam-admin/serviceaccounts');
  console.log('   ➜ Save it as: gcp-service-account.json in backend folder\n');
  allGood = false;
} else {
  console.log(`   ✅ Key file exists: ${keyFile}`);

  // Try to read and validate JSON
  try {
    const keyContent = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

    if (keyContent.type === 'service_account') {
      console.log('   ✅ Valid service account JSON');
      console.log(`   📧 Service account: ${keyContent.client_email}\n`);

      // Check if project ID matches
      if (projectId && keyContent.project_id !== projectId) {
        console.log('   ⚠️  WARNING: Project ID mismatch!');
        console.log(`      .env has: ${projectId}`);
        console.log(`      JSON has: ${keyContent.project_id}`);
        console.log('   ➜ Update GCS_PROJECT_ID to match the JSON file\n');
      }
    } else {
      console.log('   ❌ Not a service account JSON file');
      console.log('   ➜ Make sure you downloaded the right type of credentials\n');
      allGood = false;
    }
  } catch (error) {
    console.log('   ❌ Invalid JSON file');
    console.log(`   ➜ Error: ${error.message}\n`);
    allGood = false;
  }
}

// Check 5: Redis
console.log('5️⃣  Checking Redis configuration...');
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
console.log(`   ℹ️  Redis: ${redisHost}:${redisPort}`);
console.log('   ➜ Make sure Redis is running: redis-server\n');

// Check 6: Dependencies
console.log('6️⃣  Checking required packages...');
const requiredPackages = [
  '@google-cloud/vision',
  '@google-cloud/storage',
  'pdf-parse',
  'mammoth',
  'xlsx',
  'sharp',
  'socket.io'
];

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const installed = packageJson.dependencies || {};

  let missingPackages = [];
  requiredPackages.forEach(pkg => {
    if (!installed[pkg]) {
      missingPackages.push(pkg);
    }
  });

  if (missingPackages.length > 0) {
    console.log('   ❌ Missing packages:');
    missingPackages.forEach(pkg => console.log(`      - ${pkg}`));
    console.log('   ➜ Run: npm install\n');
    allGood = false;
  } else {
    console.log('   ✅ All required packages installed\n');
  }
} catch (error) {
  console.log('   ⚠️  Could not check packages\n');
}

// Final summary
console.log('─'.repeat(50));
if (allGood) {
  console.log('\n🎉 Setup looks good! Next steps:\n');
  console.log('   1. Run: node test-vision-api.js');
  console.log('   2. If test passes, start backend: npm run dev');
  console.log('   3. Upload a document to test full pipeline\n');
  console.log('📖 See setup-google-cloud.md for detailed instructions\n');
} else {
  console.log('\n⚠️  Setup incomplete. Please fix the issues above.\n');
  console.log('📖 See setup-google-cloud.md for step-by-step guide\n');
  console.log('🔗 Quick links:');
  console.log('   Service Accounts: https://console.cloud.google.com/iam-admin/serviceaccounts');
  console.log('   Enable Vision API: https://console.cloud.google.com/apis/library/vision.googleapis.com');
  console.log('   Cloud Storage: https://console.cloud.google.com/storage/browser\n');
  process.exit(1);
}
