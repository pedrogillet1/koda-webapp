/**
 * Test File Creation API
 * Tests the file creation endpoint without needing documents
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testFileCreation() {
  console.log('🧪 Testing File Creation API...\n');

  // Test creating a Markdown file
  const testData = {
    query: 'Create a markdown document about artificial intelligence trends in 2024',
    userId: 'test-user-123',
  };

  try {
    console.log('📤 Sending request to RAG endpoint...');
    console.log('Query:', testData.query);
    console.log('User ID:', testData.userId);
    console.log('');

    const response = await axios.post(`${API_BASE}/api/rag/chat`, testData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 second timeout for file generation
    });

    console.log('✅ Response received!\n');
    console.log('Status:', response.status);
    console.log('Action Type:', response.data.actionType);
    console.log('Success:', response.data.success);
    console.log('\n📄 File Details:');
    console.log('  Name:', response.data.file?.name);
    console.log('  Type:', response.data.file?.type);
    console.log('  Size:', response.data.file?.size, 'bytes');
    console.log('  URL:', response.data.file?.url);
    console.log('  Preview URL:', response.data.file?.previewUrl);
    console.log('\n💬 Message:', response.data.message);

    if (response.data.file?.content) {
      console.log('\n📝 Content Preview (first 500 chars):');
      console.log(response.data.file.content.substring(0, 500) + '...');
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing file creation:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Is the backend running on http://localhost:5000?');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Test different file types
async function testAllFileTypes() {
  console.log('🧪 Testing All File Types...\n');

  const tests = [
    {
      name: 'Markdown',
      query: 'Create a markdown document about project management best practices',
    },
    {
      name: 'PDF',
      query: 'Create a PDF report about cybersecurity threats',
    },
    {
      name: 'DOCX',
      query: 'Create a Word document about business strategy',
    },
    {
      name: 'PPTX',
      query: 'Create a presentation about data analytics',
    },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Testing ${test.name} Creation`);
    console.log('='.repeat(60));

    try {
      const response = await axios.post(
        `${API_BASE}/api/rag/chat`,
        {
          query: test.query,
          userId: 'test-user-123',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 90000,
        }
      );

      console.log(`✅ ${test.name} created successfully!`);
      console.log('  File:', response.data.file?.name);
      console.log('  Size:', response.data.file?.size, 'bytes');
    } catch (error) {
      console.error(`❌ ${test.name} creation failed:`, error.message);
    }

    // Wait 2 seconds between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n✅ All tests completed!');
}

// Run the test
const testType = process.argv[2] || 'single';

if (testType === 'all') {
  testAllFileTypes();
} else {
  testFileCreation();
}
