const fs = require('fs');
const path = 'C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/backend/src/services/rag.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Check if context loading already exists
if (content.includes('multiTurnContext = await conversationContextService.getContext')) {
  console.log('ℹ️ Context loading already exists');
  process.exit(0);
}

// New code to add - will be inserted before FAST PATH section
const contextCode = `
  // ============================================================================
  // 🧠 CONVERSATION CONTEXT - Load and resolve references for multi-turn support
  // ============================================================================
  // REASON: Multi-turn conversations need context from previous messages
  // WHY: Pronouns like "it", "that", "this" refer to previous entities
  // HOW: Load saved context, resolve references, inject into prompt
  // IMPACT: Enables ChatGPT-like conversation continuity

  perfTimer.mark('conversationContextLoad');
  let multiTurnContext = null;
  let resolvedQuery = query; // Default to original query

  try {
    // Load conversation context (previous entities, topics, findings)
    multiTurnContext = await conversationContextService.getContext(conversationId);

    if (multiTurnContext && (multiTurnContext.entities.length > 0 || multiTurnContext.keyFindings.length > 0)) {
      console.log(\`🧠 [CONTEXT] Loaded context: \${multiTurnContext.entities.length} entities, \${multiTurnContext.keyFindings.length} findings\`);

      // Resolve pronouns in the query ("it", "that", "this" → actual entities)
      resolvedQuery = conversationContextService.resolveReferences(query, multiTurnContext);

      if (resolvedQuery !== query) {
        console.log(\`🔄 [CONTEXT] Resolved query: "\${query}" → "\${resolvedQuery}"\`);
      }
    } else {
      console.log('🧠 [CONTEXT] No prior context found (first message or empty context)');
    }
  } catch (contextError) {
    console.error('❌ [CONTEXT] Error loading conversation context:', contextError);
    // Continue with original query if context loading fails
  }

  perfTimer.measure('Conversation Context Load', 'conversationContextLoad');

`;

// Find after the CACHE MISS log
const targetMarker = 'console.log(`❌ [CACHE MISS] Query result for "${query.substring(0, 50)}..."`);';

const insertPoint = content.indexOf(targetMarker);

if (insertPoint === -1) {
  console.log('❌ Could not find CACHE MISS log');
  // Try alternative pattern
  const altMarker = 'CACHE MISS';
  const altPoint = content.indexOf(altMarker);
  console.log('Alternative marker at:', altPoint);
  process.exit(1);
}

// Find the end of the line
const lineEnd = content.indexOf('\n', insertPoint);

// Insert the context code after the CACHE MISS log
content = content.slice(0, lineEnd + 1) + contextCode + content.slice(lineEnd + 1);

fs.writeFileSync(path, content);
console.log('✅ Added conversation context loading to handleRegularQuery');
