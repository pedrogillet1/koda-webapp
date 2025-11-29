/**
 * CHAT SERVICE INTEGRATION PATCH
 * 
 * Add this code to chat.service.ts in the sendMessage function
 * 
 * Location: After RAG result is received (around line 353-360)
 * Replace the section that creates assistantMessage
 */

import chatDocumentGenerationService from './chatDocumentGeneration.service';

// ... existing code ...

// ✅ FIX: Use RAG service instead of calling Gemini directly
console.log('🤖 Generating RAG response...');
const ragResult = await ragService.generateAnswer(
  userId,
  content,
  conversationId,
  params.answerLength || 'medium',
  attachedDocumentId
);

// ✅ NEW: Check if document generation was requested
if (ragResult.documentGeneration) {
  console.log(`📝 [CHAT] Document generation detected: ${ragResult.documentGeneration.type}`);
  
  // Get source content from documents
  let sourceContent = '';
  let sourceDocumentIds: string[] = [];
  
  if (ragResult.sources && ragResult.sources.length > 0) {
    sourceContent = ragResult.sources
      .map(s => `Document: ${s.filename}\n\n${s.content}`)
      .join('\n\n---\n\n');
    sourceDocumentIds = ragResult.sources.map(s => s.documentId);
  }
  
  // Generate the document
  const docResult = await chatDocumentGenerationService.generateDocument({
    userId,
    conversationId,
    messageId: userMessage.id,
    query: content,
    documentType: ragResult.documentGeneration.type,
    sourceContent,
    sourceDocumentIds,
  });
  
  // Create assistant message with chatDocument attached
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: docResult.message,
      chatDocument: {
        connect: { id: docResult.chatDocument.id }
      },
      createdAt: new Date(),
    },
    include: {
      chatDocument: true, // Include the chatDocument in response
    },
  });
  
  console.log('✅ Assistant message with document saved:', assistantMessage.id);
  
  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  
  return {
    userMessage,
    assistantMessage,
  };
}

// ✅ NEW: Check if presentation generation was requested
if (ragResult.presentationGeneration) {
  console.log(`📊 [CHAT] Presentation generation detected`);
  
  // TODO: Implement presentation generation
  // For now, return a message saying it's coming soon
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '📊 Presentation generation is coming soon! This feature will create professional slide decks from your documents.',
      createdAt: new Date(),
    },
  });
  
  return {
    userMessage,
    assistantMessage,
  };
}

// ✅ EXISTING: Regular RAG response (no document generation)
let fullResponse = ragResult.answer || 'Sorry, I could not generate a response.';

// Append document sources if available
if (ragResult.sources && ragResult.sources.length > 0) {
  console.log(`📎 Appending ${ragResult.sources.length} document sources to response`);
  const sourcesText = formatDocumentSources(ragResult.sources, attachedDocumentId);
  fullResponse += '\n\n' + sourcesText;
}

// Create assistant message
const assistantMessage = await prisma.message.create({
  data: {
    conversationId,
    role: 'assistant',
    content: fullResponse,
    createdAt: new Date(),
  },
});

// ... rest of existing code ...
