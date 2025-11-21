# Fix "Show Me This File" Context Resolution

## Problem

When user says **"show me this file"**, the system treats "this file" as a literal filename search instead of resolving it from conversation context.

**Current behavior:**
- User: "show me koda blueprint" → ✅ Works, shows file card
- User: "show me this file" → ❌ Fails with "I couldn't find a file named 'this file'"

**Expected behavior:**
- User: "show me koda blueprint" → ✅ Shows file card
- User: "show me this file" → ✅ Should show the same file (resolves "this file" from context)

---

## Root Cause

**File**: `backend/src/services/llmIntentDetector.service.ts` (Line 67-72)

The LLM intent detector extracts parameters from the query, but it **doesn't have access to conversation history** to resolve contextual references like:
- "this file"
- "that document"
- "the file I mentioned"
- "the previous file"

```typescript
// Current: Only gets the current query
async detectIntent(query: string): Promise<IntentResult> {
  // ❌ No conversation context passed
  const prompt = `Analyze the following user query...`;
}
```

---

## The Solution

Add conversation history to the intent detector so it can resolve contextual file references.

### Fix #1: Update Intent Detector to Accept Conversation History

**File**: `backend/src/services/llmIntentDetector.service.ts`

**FIND** (Line 37):
```typescript
async detectIntent(query: string): Promise<IntentResult> {
  const prompt = `You are an intent detection system for KODA, a document management AI assistant.

Analyze the following user query and determine the intent.
```

**REPLACE WITH**:
```typescript
async detectIntent(query: string, conversationHistory: Array<{role: string, content: string}> = []): Promise<IntentResult> {
  // Build conversation context for reference resolution
  let contextSection = '';
  if (conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-5); // Last 5 messages
    contextSection = `\n**Recent Conversation Context:**\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n`;
  }

  const prompt = `You are an intent detection system for KODA, a document management AI assistant.

Analyze the following user query and determine the intent.
${contextSection}
```

**THEN FIND** (Line 67-72):
```typescript
8. **show_file** - User wants to preview/see/view/open a specific file
   - Examples (EN): "show me this file", "show me document X", "show me the file with Y", "take me to file X", "open document X", "I want to see this file", "show me image 1", "let me see the file"
   - Examples (PT): "me mostra este arquivo", "me mostra o arquivo X", "mostre o documento X", "abrir arquivo X", "quero ver este arquivo", "mostre-me o arquivo X"
   - Examples (ES): "muéstrame este archivo", "muéstrame el archivo X", "mostrar documento X", "abrir archivo X", "quiero ver este archivo"
   - Examples (FR): "montre-moi ce fichier", "montre-moi le fichier X", "montrer document X", "ouvrir fichier X", "je veux voir ce fichier"
   - Extract: filename (the file name or reference)
```

**ADD THIS LINE AFTER "Extract: filename"**:
```typescript
8. **show_file** - User wants to preview/see/view/open a specific file
   - Examples (EN): "show me this file", "show me document X", "show me the file with Y", "take me to file X", "open document X", "I want to see this file", "show me image 1", "let me see the file"
   - Examples (PT): "me mostra este arquivo", "me mostra o arquivo X", "mostre o documento X", "abrir arquivo X", "quero ver este arquivo", "mostre-me o arquivo X"
   - Examples (ES): "muéstrame este archivo", "muéstrame el archivo X", "mostrar documento X", "abrir archivo X", "quiero ver este archivo"
   - Examples (FR): "montre-moi ce fichier", "montre-moi le fichier X", "montrer document X", "ouvrir fichier X", "je veux voir ce fichier"
   - Extract: filename (the file name or reference)
   - ✅ **CONTEXT RESOLUTION**: If user says "this file", "that document", "the file", or similar contextual reference, look at the conversation context above and extract the actual filename from the previous messages. Return the real filename, NOT "this file".
```

---

### Fix #2: Pass Conversation History When Detecting Intent

**File**: `backend/src/services/rag.service.ts`

**FIND** the `chat()` function where it calls `llmIntentDetector.detectIntent()`:

```bash
# Search for this pattern
grep -n "llmIntentDetector.detectIntent" backend/src/services/rag.service.ts
```

**Expected location**: Around line 200-300

**FIND**:
```typescript
const intentResult = await llmIntentDetector.detectIntent(query);
```

**REPLACE WITH**:
```typescript
// Build conversation history for context resolution
const conversationHistory = messages.slice(-10).map(msg => ({
  role: msg.role,
  content: msg.content
}));

// Detect intent with conversation context
const intentResult = await llmIntentDetector.detectIntent(query, conversationHistory);
```

---

### Fix #3: Fallback to Last Mentioned File

**File**: `backend/src/services/fileActions.service.ts`

Add a helper function to extract the last mentioned filename from conversation context.

**ADD THIS FUNCTION** after line 100 (inside the FileActionsService class):

```typescript
/**
 * Extract the last mentioned filename from conversation context
 * Used when user says "this file", "that document", etc.
 */
private extractLastMentionedFile(conversationHistory: Array<{role: string, content: string}>): string | null {
  // Search backwards through messages for file references
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];

    // Look for common file patterns in assistant responses
    const filePatterns = [
      /Here's the file:\s*\*\*(.+?)\*\*/i,           // "Here's the file: **filename**"
      /Found file:\s*\*\*(.+?)\*\*/i,                // "Found file: **filename**"
      /📄\s*(.+?)\.(?:pdf|docx|xlsx|pptx|jpg|png)/i, // "📄 filename.pdf"
      /File:\s*(.+?)\.(?:pdf|docx|xlsx|pptx|jpg|png)/i, // "File: filename.pdf"
    ];

    for (const pattern of filePatterns) {
      const match = msg.content.match(pattern);
      if (match && match[1]) {
        console.log(`🔍 [CONTEXT] Extracted filename from context: "${match[1]}"`);
        return match[1].trim();
      }
    }
  }

  return null;
}
```

**THEN UPDATE** the `showFile()` function (Line 551):

**FIND**:
```typescript
async showFile(params: ShowFileParams, query: string = ''): Promise<FileActionResult> {
  try {
    // Detect language from user query
    const lang = detectLanguage(query);
    console.log(`👁️ [SHOW_FILE] Looking for file: "${params.filename}" (Language: ${lang})`);

    // Find document by filename with fuzzy matching
    const document = await this.findDocumentWithFuzzyMatch(params.filename, params.userId);
```

**REPLACE WITH**:
```typescript
async showFile(params: ShowFileParams, query: string = '', conversationHistory: Array<{role: string, content: string}> = []): Promise<FileActionResult> {
  try {
    // Detect language from user query
    const lang = detectLanguage(query);

    let searchFilename = params.filename;

    // ✅ CONTEXT RESOLUTION: If user said "this file", "that document", etc., resolve from context
    const contextualReferences = ['this file', 'that file', 'the file', 'this document', 'that document', 'the document', 'it', 'este arquivo', 'esse arquivo', 'o arquivo'];
    if (contextualReferences.some(ref => searchFilename.toLowerCase().includes(ref))) {
      console.log(`🔍 [SHOW_FILE] Contextual reference detected: "${searchFilename}"`);
      const lastMentionedFile = this.extractLastMentionedFile(conversationHistory);

      if (lastMentionedFile) {
        searchFilename = lastMentionedFile;
        console.log(`✅ [SHOW_FILE] Resolved to: "${searchFilename}"`);
      } else {
        console.warn(`⚠️ [SHOW_FILE] Could not resolve contextual reference`);
      }
    }

    console.log(`👁️ [SHOW_FILE] Looking for file: "${searchFilename}" (Language: ${lang})`);

    // Find document by filename with fuzzy matching
    const document = await this.findDocumentWithFuzzyMatch(searchFilename, params.userId);
```

---

### Fix #4: Update RAG Service to Pass Conversation History to showFile

**File**: `backend/src/services/rag.service.ts`

**FIND** where `fileActions.showFile()` is called:

```bash
grep -n "fileActions.showFile" backend/src/services/rag.service.ts
```

**FIND**:
```typescript
const result = await fileActions.showFile(intentResult.parameters, query);
```

**REPLACE WITH**:
```typescript
// Build conversation history for context resolution
const conversationHistory = messages.slice(-10).map(msg => ({
  role: msg.role,
  content: msg.content
}));

const result = await fileActions.showFile(intentResult.parameters, query, conversationHistory);
```

---

## Testing

### Test Case 1: Direct File Reference
**Input**: "show me koda blueprint"
**Expected**: ✅ Shows Koda blueprint (1).docx file card

### Test Case 2: Contextual Reference (Same Message)
**Context**: None
**Input**: "show me this file"
**Expected**: ❌ Error (no file in context)

### Test Case 3: Contextual Reference (Previous Message)
**Context**:
- User: "do you have the koda blueprint?"
- Assistant: "Yes, here's the file: **Koda blueprint (1).docx**"

**Input**: "show me this file"
**Expected**: ✅ Shows Koda blueprint (1).docx file card

### Test Case 4: Multiple Files in Context
**Context**:
- User: "show me koda blueprint"
- Assistant: "Here's the file: **Koda blueprint (1).docx**"
- User: "show me koda checklist"
- Assistant: "Here's the file: **koda_checklist.pdf**"

**Input**: "show me this file"
**Expected**: ✅ Shows koda_checklist.pdf (last mentioned file)

### Test Case 5: Portuguese Contextual Reference
**Context**:
- User: "você tem o koda blueprint?"
- Assistant: "Sim, aqui está o arquivo: **Koda blueprint (1).docx**"

**Input**: "me mostra este arquivo"
**Expected**: ✅ Shows Koda blueprint (1).docx

---

## Expected Results

### Before Fix:
| User Input | Result |
|------------|--------|
| "show me koda blueprint" | ✅ Shows file card |
| "show me this file" | ❌ "I couldn't find a file named 'this file'" |
| "show me that document" | ❌ "I couldn't find a file named 'that document'" |

### After Fix:
| User Input | Result |
|------------|--------|
| "show me koda blueprint" | ✅ Shows file card |
| "show me this file" | ✅ Shows last mentioned file |
| "show me that document" | ✅ Shows last mentioned file |
| "open it" | ✅ Shows last mentioned file |

---

## Implementation Steps

**Time**: 20 minutes

1. **Update Intent Detector** (5 min)
   - Add conversation history parameter
   - Add context resolution instruction for show_file intent

2. **Update File Actions** (10 min)
   - Add extractLastMentionedFile helper
   - Update showFile to accept conversation history
   - Add contextual reference detection

3. **Update RAG Service** (5 min)
   - Pass conversation history to detectIntent
   - Pass conversation history to showFile

4. **Test** (5 min)
   - Test "show me koda blueprint" → Should work
   - Test "show me this file" after previous query → Should work
   - Test "show me this file" with no context → Should show error

---

## Rollback

If anything breaks:

```bash
cd /home/ubuntu/koda-webapp

git checkout backend/src/services/llmIntentDetector.service.ts
git checkout backend/src/services/fileActions.service.ts
git checkout backend/src/services/rag.service.ts

cd backend && npm run build && pm2 restart koda-backend
```

---

## Summary

The fix enables KODA to:
1. ✅ Understand contextual references like "this file", "that document"
2. ✅ Look back through conversation history to find the last mentioned filename
3. ✅ Resolve the reference and show the correct file
4. ✅ Support multiple languages (English, Portuguese, Spanish, French)

This creates a much more natural conversation flow where users can say:
- "Do you have the koda blueprint?" → "Yes, here's the file"
- "Show me this file" → ✅ Shows Koda blueprint (1).docx

Instead of requiring them to repeat the full filename every time.
