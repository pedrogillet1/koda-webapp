const fs = require('fs');
const path = 'C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/backend/src/services/rag.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Check if already added
if (content.includes('multiTurnContextSummary')) {
  console.log('ℹ️ Multi-turn context summary already added');
  process.exit(0);
}

// Find the exact line
const targetLine = '    // Append causal context, formula context, and implications to document context if available';
const insertPoint = content.indexOf(targetLine);

if (insertPoint === -1) {
  console.log('❌ Could not find Append causal context line');
  // Try to find the contextWithIntelligence line directly
  const altTarget = '    let contextWithIntelligence = finalDocumentContext;';
  const altPoint = content.indexOf(altTarget);
  if (altPoint !== -1) {
    console.log('Found alternative at position:', altPoint);
  }
  process.exit(1);
}

// New code to insert before the target
const newCode = `    // 🧠 Build multi-turn context summary for enhanced LLM understanding
    let multiTurnContextSummary = '';
    if (multiTurnContext && (multiTurnContext.entities.length > 0 || multiTurnContext.keyFindings.length > 0)) {
      multiTurnContextSummary = conversationContextService.buildContextSummary(multiTurnContext);
      console.log(\`🧠 [CONTEXT] Built context summary for LLM (\${multiTurnContextSummary.length} chars)\`);
    }

`;

// Insert before the target
content = content.slice(0, insertPoint) + newCode + content.slice(insertPoint);

// Now find and update the contextWithIntelligence assignment to include multi-turn context
const oldAssignment = `    let contextWithIntelligence = finalDocumentContext;
    if (causalContext) {
      contextWithIntelligence += causalContext;
    }
    if (formulaContext) {
      contextWithIntelligence += formulaContext;
    }
    if (implicationsContext) {
      contextWithIntelligence += implicationsContext;
    }`;

const newAssignment = `    let contextWithIntelligence = finalDocumentContext;

    // 🧠 Add multi-turn context summary at the beginning for better understanding
    if (multiTurnContextSummary) {
      contextWithIntelligence = multiTurnContextSummary + '\\n\\n' + contextWithIntelligence;
    }

    if (causalContext) {
      contextWithIntelligence += causalContext;
    }
    if (formulaContext) {
      contextWithIntelligence += formulaContext;
    }
    if (implicationsContext) {
      contextWithIntelligence += implicationsContext;
    }`;

if (content.includes(oldAssignment)) {
  content = content.replace(oldAssignment, newAssignment);
  console.log('✅ Updated contextWithIntelligence to include multi-turn context');
} else {
  console.log('⚠️ Could not find contextWithIntelligence block to update');
}

fs.writeFileSync(path, content);
console.log('✅ Added multi-turn context summary');
