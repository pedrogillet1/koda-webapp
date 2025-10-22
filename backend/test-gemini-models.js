const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listAvailableModels() {
  console.log('🔍 Testing Gemini API Key...\n');
  console.log('API Key:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 20)}...` : 'NOT FOUND');
  console.log('\n📋 Testing different model names:\n');

  const modelsToTry = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro',
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`Testing: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hello');
      const response = await result.response;
      const text = response.text();
      console.log(`✅ ${modelName} - WORKS! Response: ${text.substring(0, 50)}...`);
    } catch (error) {
      console.log(`❌ ${modelName} - FAILED: ${error.message}`);
    }
    console.log('');
  }
}

listAvailableModels().catch(console.error);
