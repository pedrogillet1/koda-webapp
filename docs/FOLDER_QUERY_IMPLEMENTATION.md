# Folder Query Implementation Guide

## Overview
This document outlines how the folder-scoped query system works in KODA. The implementation allows users to ask queries like "What's in folder EOY F3?" and get accurate, folder-scoped results.

## Architecture

### 1. Database Schema (✅ Complete)
**File**: `prisma/schema.prisma`

Added context tracking to Conversation model:
- `contextType`: String ("folder" | "category" | "document")
- `contextId`: String (ID of the folder/category/document)
- `contextName`: String (Display name for UI)
- `contextMeta`: Json (Additional metadata)
- Index on `[contextType, contextId]` for performance

### 2. Query Parser Service (✅ Complete)
**File**: `src/services/queryParser.service.ts`

**Purpose**: Detects user intent from natural language queries

**Key Functions**:
- `parse(query)`: Returns ParsedQuery with intent + extracted entities
- Supports 5 query intents:
  - `FOLDER_LIST`: "What's in folder X?"
  - `FOLDER_SEARCH`: "Find Y in folder X"
  - `FOLDER_SUMMARY`: "Summarize folder X"
  - `DOCUMENT_QUERY`: "What does doc X say?"
  - `GENERAL_SEARCH`: General queries (default)

**Pattern Matching**: Uses regex to extract folder names and search terms

### 3. Folder Resolver Service (✅ Complete)
**File**: `src/services/folderResolver.service.ts`

**Purpose**: Finds folders by name with fuzzy matching (handles typos)

**Matching Strategy** (in order):
1. Exact match
2. Case-insensitive match
3. Partial match (contains)
4. Fuzzy match (Levenshtein distance > 0.7)
5. Suggestions if not found

**Key Functions**:
- `resolveFolder(folderName, userId)`: Returns FolderResolution
- `levenshteinDistance()`: Calculates edit distance
- `suggestAlternatives()`: Provides helpful suggestions

### 4. Conversation Context Service (✅ Complete)
**File**: `src/services/conversationContext.service.ts`

**Purpose**: Manages folder/category scope across conversation

**Key Functions**:
- `saveContext(conversationId, context)`: Save folder scope
- `getContext(conversationId)`: Retrieve current context
- `clearContext(conversationId)`: Remove context
- `validateContext(conversationId)`: Check if folder still exists
- `getContextDisplay(conversationId)`: UI-friendly string

**Use Case**: After user asks "What's in folder EOY F3?", subsequent questions in that conversation remain folder-scoped until context is cleared.

### 5. Enhanced Retrieval Service (✅ Complete)
**File**: `src/services/enhancedRetrieval.service.ts`

**Updates**:
- Added `folderId` option to `EnhancedRetrievalOptions` interface
- Pass `folderId` to `pineconeService.searchSimilarChunks()`
- Logging shows "Folder-Scoped" when folderId is provided

### 6. Pinecone Service (✅ Complete)
**File**: `src/services/pinecone.service.ts`

**Updates**:
- Added `folderId` parameter to `searchSimilarChunks()`
- Filter logic:
  ```typescript
  if (folderId) {
    filter.$and = [
      { userId: { $eq: userId } },
      { folderId: { $eq: folderId } }
    ];
  }
  ```
- Database-level filtering for 10-100x performance improvement

**Note**: Pinecone metadata already includes `folderId`, `folderName`, and `folderPath` from document upload.

### 7. Prompt Builder Service (✅ Complete)
**File**: `src/services/promptBuilder.service.ts`

**Purpose**: Constructs context-aware AI prompts

**Key Functions**:
- `buildSystemPrompt(context)`: Creates system prompt with folder instructions
- `buildUserPrompt(query, context)`: Formats query based on intent
- `buildFolderListPrompt()`: For "What's in folder X?"
- `buildFolderSearchPrompt()`: For "Find Y in folder X"
- `buildFolderSummaryPrompt()`: For "Summarize folder X"
- `buildGeneralSearchPrompt()`: For general queries

**Example System Prompt**:
```
You are KODA, an intelligent document assistant.

FOLDER SCOPE:
You are currently helping with folder "EOY F3".
- ONLY use information from documents in this folder
- If asked about other folders, politely clarify that you're focused on "EOY F3"
- All retrieved documents are from this folder
```

### 8. RAG Service Integration (⚠️ Requires Manual Integration)
**File**: `src/services/rag.service.ts`

**Required Changes** (to be implemented):

```typescript
// Add imports at top
import queryParserService, { QueryIntent } from './queryParser.service';
import folderResolverService from './folderResolver.service';
import conversationContextService from './conversationContext.service';
import promptBuilderService from './promptBuilder.service';

// In generateAnswer() method:
async generateAnswer(
  userId: string,
  query: string,
  conversationId: string,
  researchMode: boolean,
  conversationHistory: any[]
) {
  // STEP 1: Parse query intent
  const parsedQuery = queryParserService.parse(query);
  console.log(`📋 Query Intent: ${parsedQuery.intent}`);

  // STEP 2: Check for existing context or resolve folder
  let context = await conversationContextService.getContext(conversationId);
  let folderId: string | undefined;
  let folderName: string | undefined;

  if (parsedQuery.folderName) {
    // User mentioned a folder - resolve it
    const resolution = await folderResolverService.resolveFolder(
      parsedQuery.folderName,
      userId
    );

    if (resolution.folder) {
      folderId = resolution.folder.id;
      folderName = resolution.folder.name;

      // Save context for future messages
      await conversationContextService.saveContext(conversationId, {
        type: 'folder',
        id: folderId,
        name: folderName,
        meta: null
      });
    } else {
      // Folder not found - return helpful message
      return {
        answer: `${resolution.error}\n\nDid you mean: ${resolution.suggestions?.join(', ') || 'N/A'}?`,
        sources: [],
        expandedQuery: query,
        contextId: null,
        actions: []
      };
    }
  } else if (context && context.type === 'folder') {
    // Use existing folder context
    folderId = context.id!;
    folderName = context.name!;
    console.log(`📁 Using existing folder context: ${folderName}`);
  }

  // STEP 3: Retrieve documents with folder filtering
  const retrievedChunks = await enhancedRetrievalService.retrieve(
    query,
    userId,
    {
      topK: researchMode ? 10 : 5,
      enableReranking: true,
      enableMMR: true,
      queryType: parsedQuery.intent,
      folderId: folderId // 🎯 KEY: Pass folderId to filter results
    }
  );

  // STEP 4: Build context-aware prompts
  const prompts = promptBuilderService.buildCompletePrompt(query, {
    intent: parsedQuery.intent,
    folderName: folderName,
    searchTerm: parsedQuery.searchTerm,
    retrievedChunks: retrievedChunks
  });

  // STEP 5: Generate AI response (existing OpenAI/Gemini logic)
  // Use prompts.systemPrompt and prompts.userPrompt
  // ... rest of existing generateAnswer logic ...
}
```

## Query Flow Example

### User Query: "What's in folder EOY F3?"

1. **QueryParser** detects `FOLDER_LIST` intent, extracts "EOY F3"
2. **FolderResolver** finds folder (handles "EOY F3" vs "eoy-f3" vs "EOY F 3")
3. **ConversationContext** saves folder scope to conversation
4. **Pinecone** searches with `{ userId: X, folderId: Y }` filter
5. **PromptBuilder** creates folder-specific system prompt
6. **AI** generates response using ONLY documents from that folder

### Follow-up Query: "Tell me about revenue"

1. **QueryParser** detects `GENERAL_SEARCH` intent
2. **ConversationContext** retrieves folder="EOY F3" from previous message
3. **Pinecone** searches with folder filter (still scoped!)
4. **PromptBuilder** maintains folder instructions
5. **AI** responds with revenue info from EOY F3 only

## Benefits

1. **Accurate Folder Scoping**: Database-level filtering ensures correct results
2. **Typo Tolerance**: Fuzzy matching handles user errors
3. **Conversation Persistence**: Context maintained across messages
4. **Clear AI Instructions**: Explicit prompts prevent AI confusion
5. **Performance**: Pinecone filtering faster than post-retrieval filtering

## Testing

After integration in rag.service.ts, test with:
- "What's in folder EOY F3?"
- "Show me folder financial-reports"
- "Find revenue in folder EOY F3"
- "Summarize folder contracts"
- Follow-up questions without mentioning folder name

## Status

- ✅ Database schema
- ✅ QueryParser service
- ✅ FolderResolver service
- ✅ ConversationContext service
- ✅ EnhancedRetrieval updates
- ✅ Pinecone filtering
- ✅ PromptBuilder service
- ⚠️ RAG service integration (manual step required)
- ⏳ End-to-end testing

## Next Steps

1. Manually integrate the 5 steps above into `rag.service.ts`
2. Test with various folder queries
3. Monitor logs for folder filtering confirmation
4. Add UI indicators for folder context
5. Consider adding "Clear context" button in UI
