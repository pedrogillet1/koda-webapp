const fs = require('fs');
const path = 'C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/backend/src/services/rag.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Check if already updated
if (content.includes('enhanceQuerySimple(resolvedQuery)')) {
  console.log('ℹ️ Query enhancement already uses resolvedQuery');
  process.exit(0);
}

// Update query enhancement to use resolvedQuery
const oldLine = `let enhancedQueryText = queryEnhancementService.enhanceQuerySimple(query);`;
const newLine = `// 🧠 Use resolvedQuery (with pronoun resolution) for document retrieval
  let enhancedQueryText = queryEnhancementService.enhanceQuerySimple(resolvedQuery);`;

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  console.log('✅ Updated enhanceQuerySimple to use resolvedQuery');
} else {
  console.log('❌ Could not find enhanceQuerySimple line');
  process.exit(1);
}

// Update the console.log as well
const oldLog = 'console.log(`🔍 [QUERY ENHANCE] Enhanced: "${query}"';
const newLog = 'console.log(`🔍 [QUERY ENHANCE] Enhanced: "${resolvedQuery}"';

if (content.includes(oldLog)) {
  content = content.replace(oldLog, newLog);
  console.log('✅ Updated QUERY ENHANCE log');
}

fs.writeFileSync(path, content);
console.log('✅ Query enhancement update complete');
