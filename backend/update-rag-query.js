const fs = require('fs');
const path = 'C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/backend/src/services/rag.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Update query enhancement to use resolvedQuery
const oldEnhance = `let enhancedQueryText = queryEnhancementService.enhanceQuerySimple(query);
  console.log(\`🔍 [QUERY ENHANCE] Enhanced: "\${query}" → "\${enhancedQueryText}"\`);`;

const newEnhance = `// 🧠 Use resolvedQuery (with pronoun resolution) for document retrieval
  let enhancedQueryText = queryEnhancementService.enhanceQuerySimple(resolvedQuery);
  console.log(\`🔍 [QUERY ENHANCE] Enhanced: "\${resolvedQuery}" → "\${enhancedQueryText}"\`);`;

if (content.includes(oldEnhance)) {
  content = content.replace(oldEnhance, newEnhance);
  console.log('✅ Updated query enhancement to use resolvedQuery');
} else {
  console.log('⚠️ Query enhancement pattern not found or already updated');
}

// 2. Update formula query detection to use resolvedQuery
const oldFormula = `const formulaQueryInfo = isFormulaQuery(query);`;
const newFormula = `const formulaQueryInfo = isFormulaQuery(resolvedQuery);`;

if (content.includes(oldFormula)) {
  content = content.replace(oldFormula, newFormula);
  console.log('✅ Updated formula query detection to use resolvedQuery');
} else {
  console.log('⚠️ Formula query detection already updated');
}

// 3. Update entity query detection to use resolvedQuery
const oldEntity = `const entityQueryInfo = isEntityQuery(query);`;
const newEntity = `const entityQueryInfo = isEntityQuery(resolvedQuery);`;

if (content.includes(oldEntity)) {
  content = content.replace(oldEntity, newEntity);
  console.log('✅ Updated entity query detection to use resolvedQuery');
} else {
  console.log('⚠️ Entity query detection already updated');
}

fs.writeFileSync(path, content);
console.log('✅ All query resolution updates complete');
