/**
 * RAG V2 Test Script
 * Tests all 6 scenarios for the V2 orchestration system
 */

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNzFhOTI4Mi00NjNiLTQyYmQtYWMyYy00MDM0Y2U5ZDk1MjQiLCJlbWFpbCI6ImxvY2FsaG9zdEBrb2RhLmNvbSIsImlhdCI6MTc2NTQ2ODAzMSwiZXhwIjoxNzY1NTU0NDMxfQ.d1M7kI4AC96jPa1ruY5PA_leuYBeG3qHi3dpj18k9O4';

const testCases = [
  {
    name: 'Analytics - Document Count',
    message: 'quantos documentos eu tenho?',
    expectedType: 'analytics'
  },
  {
    name: 'Analytics - List Documents',
    message: 'liste meus documentos',
    expectedType: 'analytics'
  },
  {
    name: 'RAG - Lone Mountain Ranch Revenue',
    message: 'qual a receita do Lone Mountain Ranch?',
    expectedType: 'doc_content'
  },
  {
    name: 'Chitchat - Greeting',
    message: 'oi, tudo bem?',
    expectedType: 'chitchat'
  },
  {
    name: 'Meta AI - What can you do',
    message: 'o que voce pode fazer?',
    expectedType: 'meta_ai'
  },
  {
    name: 'RAG - Specific Document',
    message: 'o que diz o documento analise_mezanino_guarda_moveis?',
    expectedType: 'doc_content'
  }
];

async function createConversation() {
  const response = await fetch('http://localhost:5000/api/chat/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({ title: 'RAG V2 Test' })
  });

  const data = await response.json();
  return data.id;
}

async function sendMessage(conversationId, message) {
  const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      content: message
    })
  });

  const data = await response.json();
  return data;
}

async function runTests() {
  console.log('========================================');
  console.log('   RAG V2 ORCHESTRATION TEST SUITE');
  console.log('========================================\n');

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n--- Test ${i + 1}: ${test.name} ---`);
    console.log(`Query: "${test.message}"`);
    console.log(`Expected type: ${test.expectedType}`);

    try {
      // Create a new conversation for each test
      console.log('Creating conversation...');
      const conversationId = await createConversation();
      if (!conversationId) {
        console.log('❌ Failed to create conversation');
        continue;
      }
      console.log(`Conversation ID: ${conversationId}`);

      const startTime = Date.now();
      const result = await sendMessage(conversationId, test.message);
      const elapsed = Date.now() - startTime;

      if (result.error) {
        console.log(`❌ ERROR: ${result.error}`);
        console.log('Full result:', JSON.stringify(result, null, 2));
      } else {
        console.log(`✅ Response received in ${elapsed}ms`);

        // Parse metadata if it exists
        let metadata = null;
        if (result.assistantMessage?.metadata) {
          try {
            metadata = typeof result.assistantMessage.metadata === 'string'
              ? JSON.parse(result.assistantMessage.metadata)
              : result.assistantMessage.metadata;
          } catch (e) {
            metadata = result.assistantMessage.metadata;
          }
        }

        console.log(`Answer type: ${metadata?.answerType || 'N/A'}`);
        console.log(`RAG status: ${metadata?.ragStatus || 'N/A'}`);

        const content = result.assistantMessage?.content || '';
        console.log(`Response preview: ${content.substring(0, 300)}${content.length > 300 ? '...' : ''}`);

        if (result.sources && result.sources.length > 0) {
          console.log(`Sources: ${result.sources.length} citations`);
        }
      }
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.log(err.stack);
    }

    // Wait between tests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========================================');
  console.log('   TEST SUITE COMPLETE');
  console.log('========================================');
}

runTests().catch(console.error);
