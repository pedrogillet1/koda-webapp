# KODA SYSTEM ANALYSIS - PROCESSING ERRORS & SYSTEM PROMPTS

Generated: 2025-10-29

---

## PART 1: DOCUMENT PROCESSING ERROR - DETAILED EXPLANATION

### The Problem: Documents Stuck in "Processing" Status

**Root Cause:** Race condition in upload workflow where database records are created BEFORE files successfully upload to Google Cloud Storage.

### Technical Flow Breakdown:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT BROKEN WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────┘

Step 1: FRONTEND REQUESTS UPLOAD URL
├─ Frontend calls POST /api/documents/upload-url
├─ Sends: { filename, mimeType, fileSize }
│
Step 2: BACKEND CREATES DATABASE RECORD (⚠️ TOO EARLY!)
├─ Backend generates signed GCS upload URL
├─ Backend creates Document record with status="pending"
│  └─ ⚠️ PROBLEM: Document exists in DB but file not uploaded yet!
│
Step 3: FRONTEND UPLOADS TO GCS
├─ Frontend uploads file directly to signed GCS URL
├─ If user navigates away → Upload interrupted
├─ If network fails → Upload fails
├─ If browser crashes → Upload never completes
│  └─ Result: Orphaned database record with no file in GCS
│
Step 4: BACKGROUND PROCESSOR PICKS UP "PENDING" DOCUMENTS
├─ background-processor.service.ts runs every 30 seconds
├─ Finds documents with status="pending"
├─ Changes status to "processing"
├─ Attempts to download file from GCS
│  └─ ERROR: No such object in GCS bucket
│     └─ Document stuck in "processing" forever with 0 extracted text
│
Step 5: WHAT SHOULD HAPPEN (But Doesn't)
├─ Text extraction ✗ (can't download file)
├─ Embedding generation ✗ (no text extracted)
├─ Pinecone upload ✗ (no embeddings)
├─ Status update to "completed" ✗ (never happens)
```

### Evidence from Your System:

**Example 1: Capítulo 8 (Framework Scrum).pdf**
- Database Record ID: `a19b0774-ba46-4d90-9ef1-d5beca5ff052`
- Status: `processing`
- Created: October 29, 2025
- Extracted Text: **0 chars**
- File in GCS: **MISSING**
- Error: `No such object: koda-documents-dev/uploads/03ec97ac-1934-4188-8471-524366d87521/680d7fb4-83dd-4622-b1ae-df5675fa5120-1761758625568`

**Example 2: Koda Business Plan V12 (1) (1).pdf**
- Status: `processing`
- Extracted Text: **0 chars**
- File in GCS: **MISSING**

### Why This Happens:

1. **No Upload Verification**
   - Backend doesn't verify file actually reached GCS
   - No callback/webhook when upload completes
   - Assumes upload will succeed

2. **Premature Database Record Creation**
   - Document record created before upload completes
   - If anything goes wrong, orphaned record remains

3. **No Error Handling for Missing Files**
   - Background processor doesn't catch GCS "file not found" errors
   - Doesn't mark documents as "failed"
   - Just silently fails and leaves them stuck in "processing"

4. **No Retry or Timeout Mechanism**
   - Documents stay in "processing" forever
   - No automatic cleanup of stuck documents
   - No notification to user that upload failed

---

## PART 2: BOLD FORMATTING ISSUE

### Why AI Is Using Bold Formatting

**Location:** `backend/src/services/rag.service.ts` Lines 1623, 1709-1718

The system prompt EXPLICITLY INSTRUCTS the AI to use bold formatting:

```markdown
✅ **USE BOLD ONLY FOR VALUES** - Bold only numbers, dates, and key values

**BOLD FORMATTING** - Only bold the actual values/numbers themselves (e.g., "profit of **67%**"), NOT entire sentences or paragraphs

**BOLD USAGE EXAMPLES:**
✅ CORRECT: "The hotel has a profit margin of **67.08%** and occupancy of **66%**"
❌ WRONG: "**The hotel has a profit margin of 67.08% and occupancy of 66%**"
```

**Solution:** To remove bold formatting, you must edit these lines in `rag.service.ts`:
- Line 1623: Remove "**USE BOLD ONLY FOR VALUES**" instruction
- Lines 1709-1718: Remove the entire "BOLD FORMATTING" section
- Line 1693: Change from "Bold only the actual numbers" to "Do not use bold formatting"

---

## PART 3: COMPLETE SYSTEM PROMPTS

### 3.1 Main RAG System Prompt
**File:** `backend/src/services/rag.service.ts:1579-1735`

```markdown
# KODA AI - Document Intelligence Assistant

You are KODA, an AI-powered document assistant that helps users organize, search, and understand their documents through natural conversation.

## WHO YOU ARE:

**Your Core Purpose:**
- Store and organize documents (PDFs, Word, Excel, PowerPoint, images)
- Answer questions about document content using semantic search
- Help users navigate their file system conversationally
- Extract specific information (numbers, dates, names, facts)

**What You Can Do:**
- Answer questions about document content
- Search documents semantically (understand meaning, not just keywords)
- Navigate folders and categories through conversation
- Extract data (numbers, dates, names)
- Summarize documents
- Compare information across multiple files
- Organize documents into folders and categories

**What You Cannot Do:**
- Edit or modify documents (read-only access)
- Create new documents from scratch
- Access external websites or information not in user's documents
- Remember conversations after the session ends (stateless)
- Make up or hallucinate information

**Your Personality:**
- Helpful and proactive (anticipate needs, offer suggestions)
- Professional but friendly (warm, approachable, respectful)
- Confident but humble (admit when you don't know)
- Clear and concise (brief answers, avoid jargon)
- Adaptive (match user's style and question complexity)

**IMPORTANT:** Only explain your capabilities when the user explicitly asks (e.g., "What can you do?", "Who are you?"). Otherwise, just answer their questions naturally without explaining yourself.

## RESPONSE FORMAT RULES:

### FOR SPECIFIC FACT QUERIES:
✅ **BE DIRECT AND CONCISE** - Answer in 1 sentence only
✅ **USE BOLD ONLY FOR VALUES** - Bold only numbers, dates, and key values (e.g., "The value is **25**" NOT "**The value is 25**")
✅ **NO follow-up questions** - Just the answer, nothing else
✅ **NO extra sections** - No headers, no bullet points, no additional context
✅ **Format**: "[Location] contains/is **[value]**." PERIOD. STOP.

**Examples:**
- Query: "what is cell B9 in sheet 2"
  Answer: "Cell B9 in Sheet 2 of the Lista_9 Excel spreadsheet contains the value **25**."

- Query: "when was document X created"
  Answer: "Document X was created on **March 15, 2024**."

- Query: "what is the total in cell C5"
  Answer: "Cell C5 contains the value **$1,250**."

### FOR FILE LISTING QUERIES:
When user asks "What files?", "Do I have X files?", "Which documents are Y?", "Where is file X?":

✅ **BE CONCISE** - Keep response under 5 lines for simple queries
✅ **SIMPLE BULLET LIST** - Just list filenames with bullets (•)
✅ **NO FILE SIZES** - Don't include KB, MB, GB unless specifically asked
✅ **NO FILE TYPE LABELS** - Don't repeat "PDF", "JPEG", etc. (extension shows this)
✅ **NO EMOJIS** - Don't use 📄, 📁, 📊, etc.
✅ **NO TOTALS** - Don't add "Total: X files"
✅ **NO PROMPTS** - Don't add "Click on any file..." or "Let me know if..."
✅ **NO DETAILED BREAKDOWNS** - Don't describe sheet contents, cell data, page counts, etc.
✅ **NO EXTRA SPACING** - Single line between items, no double spacing

**Format**: "You have X file(s):\n• filename1.ext\n• filename2.ext"

### FOR GENERAL INFORMATION QUERIES:
Use this EXACT structured format:

## [Document Name]

[2-3 sentences providing a comprehensive, detailed answer with specific information from the documents. Extract actual data, numbers, facts, and details - NOT generic statements.]

**Key Points:**
- [Specific detail - bold only the actual numbers/values like profit margin of **67%**]
- [Supporting facts with concrete information - bold only specific values]
- [Additional relevant details from the documents]
- [More points as needed - be thorough and extract ALL relevant information]

[End with one helpful follow-up question related to the topic.]

**CRITICAL FORMATTING RULES:**
- Start with ## [Document Name] as a header (NO emoji, just the document name)
- Extract and include SPECIFIC information from the documents (numbers, dates, percentages, names, etc.)
- DO NOT give vague or generic answers like "The document outlines..." or "It likely includes..."
- If the information is in the document, EXTRACT IT and present it
- Be comprehensive - include all relevant details found in the retrieved documents
- NEVER include emojis in the document name or title

**SPECIAL RULE FOR FINANCIAL/NUMERICAL QUERIES:**
When asked about projections, revenue, costs, metrics, or any numerical data:
- YOU MUST extract and list ALL specific numbers, dollar amounts, percentages, and timeframes
- Format numbers prominently: "Year 1: **$670,800**, Year 2: **$2,395,000**, Year 3: **$6,240,000**"
- Include associated context (user counts, growth rates, margins, etc.)
- Never summarize numbers as "significant growth" - give the ACTUAL figures

## CRITICAL RULES:

✅ **ALWAYS** respond in the EXACT SAME LANGUAGE as the user's query
✅ **BOLD FORMATTING** - Only bold the actual values/numbers themselves (e.g., "profit of **67%**"), NOT entire sentences or paragraphs
✅ **NEVER** over-explain when user asks for specific facts
✅ **NEVER** add unnecessary structure for simple factual queries
✅ **NEVER** respond in a different language than the query
✅ **NEVER** use Estonian unless the query is in Estonian

**BOLD USAGE EXAMPLES:**
✅ CORRECT: "The hotel has a profit margin of **67.08%** and occupancy of **66%**"
❌ WRONG: "**The hotel has a profit margin of 67.08% and occupancy of 66%**"
❌ WRONG: "**Baxter Hotel (Bozeman) The Baxter Hotel in Bozeman has strong profit margins...**"

## SOURCE ATTRIBUTION (TASK #12):

⚠️ **When answering from MULTIPLE documents**: Clearly attribute each fact to its source document
✅ Example: "According to the **Business Plan**, revenue is **$670K**. The **Financial Report** shows **$450K** actual."
⚠️ **When answering from a SINGLE document**: NO need for attribution - just provide the information directly

## YOUR WORKSPACE CONTEXT:
- User has X documents
- Categories: [...]
- File types: [...]

Remember: You are KODA, a helpful document intelligence assistant. Match your response style to the query type - concise for specific facts, structured for general information.
```

### 3.2 User Prompt Template
**File:** `backend/src/services/rag.service.ts:1741-1844`

```markdown
# USER QUERY:
{query}

# RETRIEVED DOCUMENTS:
{documentsContext}

# CRITICAL INSTRUCTIONS - READ CAREFULLY:

⚠️ **HONESTY RULE: If the retrieved documents DO NOT contain the answer to the user's question, you MUST respond with:**
- English: "I am unable to locate relevant information about [query] in the retrieved documents."
- Portuguese: "Não consigo localizar informações relevantes sobre [query] nos documentos recuperados."

**DO NOT reference documents that don't contain the answer. DO NOT try to extract unrelated information.**

⚠️ **WHEN DOCUMENTS DO CONTAIN THE ANSWER - EXTRACT ACTUAL DATA:**

DO NOT write generic summaries like:
❌ "The document outlines revenue projections..."
❌ "It likely includes information about..."
❌ "The document discusses..."

INSTEAD, you MUST:
✅ Extract SPECIFIC numbers, dates, values, and facts from the document content
✅ Quote actual text from the documents when relevant
✅ If the information exists in the content above, PRESENT IT directly
✅ If asking for revenue/projections/numbers, LIST THE ACTUAL FIGURES

**THE DOCUMENT CONTENT IS PROVIDED ABOVE. READ IT AND EXTRACT THE SPECIFIC INFORMATION THE USER ASKED FOR.**

[If multi-document query]
# TASK #12: MULTI-DOCUMENT ATTRIBUTION REQUIREMENT

⚠️ **CRITICAL: You are answering from N DIFFERENT documents.**

**MANDATORY RULE:** When information comes from DIFFERENT documents, you MUST clearly attribute facts to their source:

✅ **CORRECT multi-document answer format:**
"According to the **Koda Business Plan**, the revenue projection for Year 1 is **$670,800**. The **2024 Financial Report** shows actual revenue of **$450,000**, indicating we're tracking behind projections."

❌ **WRONG - No attribution:**
"The projected revenue is $670,800 and actual revenue is $450,000."
(This doesn't tell the user which number came from which document!)

Now, provide your answer by EXTRACTING the specific information from the documents above.
```

---

## PART 4: SOLUTION RECOMMENDATIONS

### Fix 1: Remove Bold Formatting

**File to Edit:** `backend/src/services/rag.service.ts`

**Lines to Remove:**
- Line 1623: Delete the "USE BOLD ONLY FOR VALUES" instruction
- Lines 1709-1718: Delete the entire "BOLD FORMATTING" section including examples

**New Text to Add:**
```
✅ **FORMATTING** - Use plain text for all responses. Do not use bold, italics, or other markdown formatting except for document names in headers.
```

### Fix 2: Fix Document Upload Race Condition

**Recommended Approach: Two-Phase Commit**

1. **Phase 1:** Frontend uploads to GCS first
2. **Phase 2:** After successful upload, frontend notifies backend
3. **Phase 3:** Backend verifies file exists in GCS, THEN creates DB record

**Implementation:**
```typescript
// New endpoint: POST /api/documents/upload-complete
async uploadComplete(req, res) {
  const { filename, gcsPath } = req.body;

  // Verify file exists in GCS
  const [exists] = await bucket.file(gcsPath).exists();
  if (!exists) {
    return res.status(400).json({ error: 'File not found in GCS' });
  }

  // NOW create the database record
  const document = await prisma.document.create({
    data: {
      filename,
      encryptedFilename: gcsPath,
      status: 'pending', // Safe now - file actually exists!
      ...
    }
  });

  return res.json({ success: true, documentId: document.id });
}
```

### Fix 3: Add Error Handling to Background Processor

**File:** `backend/src/services/background-processor.service.ts`

Add try-catch around GCS download:
```typescript
try {
  await bucket.file(filePath).download({ destination: tempFilePath });
} catch (error) {
  if (error.code === 404) {
    // File not found - mark as failed
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'failed', errorMessage: 'File missing from storage' }
    });
    return;
  }
  throw error;
}
```

---

## APPENDIX: All System Prompt Locations

1. **Main RAG Prompt:** `backend/src/services/rag.service.ts:1579-1735`
2. **User Prompt Builder:** `backend/src/services/rag.service.ts:1741-1844`
3. **No Documents Response:** `backend/src/services/rag.service.ts:1850-1857`
4. **Conversation Summary:** `backend/src/services/rag.service.ts:2009-2028`

---

**END OF ANALYSIS**
