/**
 * Stress Test Queries - Real World Document Queries
 * Runs queries against stress test documents and shows exact frontend output
 */

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkNDRiMWEwYi03MDI1LTQ0YTEtYjY3Zi01NjE3ZTk2MDJlOGQiLCJlbWFpbCI6ImxvY2FsaG9zdEBrb2RhLmNvbSIsImlhdCI6MTc2NDg2MzA5MSwiZXhwIjoxNzY0OTQ5NDkxfQ.6DxG_QkQxs2z0qvnn2y8IYUXtKDBL3MUTtUsYVPjWBw";
const BASE_URL = "http://localhost:5000";

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response.json();
}

async function main() {
  console.log('='.repeat(80));
  console.log('STRESS TEST QUERIES - REAL WORLD DOCUMENT ANALYSIS');
  console.log('='.repeat(80));
  console.log('');

  // Get documents
  const docsResponse = await fetchAPI('/api/documents?limit=50');
  const documents = docsResponse.documents || [];

  // Find stress test documents
  const stressTestNames = [
    'Lone Mountain Ranch P&L 2024',
    'Budget 2024',
    'Rosewood Fund',
    'LMR Improvement Plan'
  ];

  const stressTestDocs = documents.filter(doc =>
    stressTestNames.some(name => doc.filename.includes(name)) && doc.status === 'completed'
  );

  console.log('📁 STRESS TEST DOCUMENTS FOUND:');
  stressTestDocs.forEach(doc => {
    console.log(`  • ${doc.filename} (ID: ${doc.id.slice(0,8)}...)`);
  });
  console.log('');

  // Define queries for each document type
  const queryTests = [
    // Lone Mountain Ranch P&L queries
    {
      name: 'Total Revenue Query',
      query: 'What is the total operating revenue for the year?',
      docName: 'Lone Mountain Ranch P&L 2024'
    },
    {
      name: 'Room Revenue Breakdown',
      query: 'Show me the Room Revenue breakdown by month',
      docName: 'Lone Mountain Ranch P&L 2024'
    },
    {
      name: 'Food vs Beverage Comparison',
      query: 'Compare Food Revenue vs Beverage Revenue',
      docName: 'Lone Mountain Ranch P&L 2024'
    },
    {
      name: 'Expenses Analysis',
      query: 'What are the main expense categories?',
      docName: 'Budget 2024'
    },
    // Rosewood Fund queries
    {
      name: 'Fund Properties',
      query: 'What properties are in the Rosewood Fund portfolio?',
      docName: 'Rosewood Fund'
    },
    {
      name: 'MoIC Analysis',
      query: 'What is the MoIC for each property?',
      docName: 'Rosewood Fund'
    }
  ];

  // Run each query
  for (const test of queryTests) {
    const doc = stressTestDocs.find(d => d.filename.includes(test.docName));
    if (!doc) {
      console.log(`⚠️  Skipping "${test.name}" - document not found`);
      continue;
    }

    console.log('-'.repeat(80));
    console.log(`📝 QUERY: ${test.name}`);
    console.log(`   Document: ${doc.filename}`);
    console.log(`   Question: "${test.query}"`);
    console.log('-'.repeat(80));

    try {
      const result = await fetchAPI('/api/rag/query', {
        method: 'POST',
        body: JSON.stringify({
          query: test.query,
          conversationId: 'new',
          answerLength: 'medium',
          attachedDocuments: [{ id: doc.id, name: doc.filename }]
        })
      });

      if (result.answer && result.answer.length > 0) {
        console.log('\n📤 FRONTEND OUTPUT:\n');
        console.log(result.answer);
      } else {
        console.log('\n⚠️  Empty response received');
        if (result.assistantMessage?.content) {
          console.log('Assistant content:', result.assistantMessage.content);
        }
      }

      if (result.sources && result.sources.length > 0) {
        console.log(`\n📎 Sources: ${result.sources.length} reference(s)`);
      }
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }

    console.log('\n');

    // Small delay between queries
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('='.repeat(80));
  console.log('STRESS TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
