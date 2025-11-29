/**
 * DOCUMENT GENERATION INTEGRATION PATCH
 * 
 * Add this code to rag.service.ts at line 2037 (BEFORE the "STEP 1: Meta-Queries" section)
 * 
 * Location: After line 2036 "console.log('🔎 Attached document ID:', attachedDocumentId);"
 * Before: "// STEP 1: Meta-Queries - FIRST"
 */

// ────────────────────────────────────────────────────────────────────────────
// STEP 0.5: Document Generation Detection - BEFORE RAG
// ────────────────────────────────────────────────────────────────────────────
// REASON: "create a summary report" should generate a document, not answer
// WHY: User wants a downloadable document, not a chat response
// IMPACT: Enables Manus-style document generation in chat
const documentGenerationDetection = await import('./documentGenerationDetection.service');
const docIntent = documentGenerationDetection.detectDocumentGenerationIntent(query);

if (docIntent.isDocumentGeneration && docIntent.type === 'document') {
  console.log(`📝 [DOC GEN] Detected ${docIntent.documentType} generation request (confidence: ${docIntent.confidence})`);
  // Return special marker that chat.service.ts will detect
  if (onChunk) {
    onChunk('__DOCUMENT_GENERATION_REQUESTED__');
  }
  return { 
    sources: [], 
    documentGeneration: { 
      type: docIntent.documentType,
      query: query 
    } 
  };
}

if (docIntent.isDocumentGeneration && docIntent.type === 'presentation') {
  console.log(`📊 [PRESENTATION] Detected presentation generation request (confidence: ${docIntent.confidence})`);
  // Return special marker that chat.service.ts will detect
  if (onChunk) {
    onChunk('__PRESENTATION_GENERATION_REQUESTED__');
  }
  return { 
    sources: [], 
    presentationGeneration: { 
      query: query 
    } 
  };
}
