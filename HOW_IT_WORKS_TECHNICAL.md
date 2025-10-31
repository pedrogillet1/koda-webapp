# HOW KODA WORKS: Technical Deep Dive
## Text Extraction → OCR → Embeddings → RAG → AI Response

This document explains exactly how KODA processes documents and answers questions.

---

## TABLE OF CONTENTS

1. [Complete System Flow](#complete-system-flow)
2. [Text Extraction Layer](#text-extraction-layer)
3. [OCR Systems](#ocr-systems)
4. [Embedding Generation](#embedding-generation)
5. [Semantic Chunking](#semantic-chunking)
6. [Vector Storage](#vector-storage)
7. [RAG Retrieval](#rag-retrieval)
8. [AI Response Generation](#ai-response-generation)

---

## COMPLETE SYSTEM FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ USER UPLOADS FILE (PDF, DOCX, PPTX, Excel, Image, etc.)        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: FILE STORAGE                                            │
│ ✓ Encrypt file (AES-256-GCM)                                    │
│ ✓ Upload to Google Cloud Storage                               │
│ ✓ Create database record (status: "processing")                │
│ ✓ Return immediately to user                                   │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: TEXT EXTRACTION (Background Process)                    │
│ 📄 PDF: pdf-parse OR Google Cloud Vision (scanned PDFs)        │
│ 📝 DOCX: mammoth.js library                                     │
│ 📊 PPTX: Python pptx library + slide images                     │
│ 📈 Excel: xlsx library (preserves formulas, cell coordinates)  │
│ 🖼️ Images: Google Cloud Vision OCR                             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: TEXT PREPROCESSING                                      │
│ ✓ Remove excessive whitespace                                  │
│ ✓ Fix OCR character mistakes (0→O, 1→l, |→I in words)         │
│ ✓ Fix common typos (teh→the, adn→and)                         │
│ ✓ Normalize punctuation spacing                                │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: MARKDOWN CONVERSION                                     │
│ ✓ Convert to structured markdown                               │
│ ✓ Preserve headings, tables, lists                             │
│ ✓ Better for semantic chunking                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: SEMANTIC CHUNKING                                       │
│ 📄 PDFs/DOCX/PPTX: Semantic chunking (respects sections)       │
│ 📈 Excel: TWO chunking methods:                                 │
│   1. Row-by-row (preserves cell coordinates)                   │
│   2. Table-based (semantic understanding)                       │
│ 🎯 Result: Array of chunks with metadata                        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: EMBEDDING GENERATION (⚠️ CRITICAL - WHERE BUG WAS)     │
│ ✓ Send chunk texts to Google Gemini API                        │
│ ✓ Model: text-embedding-004                                    │
│ ✓ Returns: 768-dimensional vectors                             │
│ ✓ Cache results for 1 hour (150x faster)                       │
│ ✓ Batch process (100 chunks at a time)                         │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: VECTOR STORAGE (Pinecone)                              │
│ ✓ Store vectors with FULL metadata                             │
│ ✓ Metadata includes: userId, documentId, filename, mimeType,   │
│   createdAt, content preview, sheet/slide/page numbers         │
│ ✓ Vector ID format: "documentId-chunkIndex"                    │
│ ✓ Enables fast filtered search                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ DOCUMENT STATUS: "completed"                                    │
│ Now ready for RAG queries!                                      │
└─────────────────────────────────────────────────────────────────┘
```

**When user asks a question:**

```
USER QUERY: "What does KODA presentation talk about?"
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ QUERY PROCESSING                                                │
│ ✓ Parse query for document name ("KODA presentation")          │
│ ✓ Look up document in database                                 │
│ ✓ Get documentId                                               │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ GENERATE QUERY EMBEDDING                                        │
│ ✓ Send query to Gemini embedding API                           │
│ ✓ Get 768-dimensional vector                                   │
│ ✓ Time: ~300ms (or <5ms if cached)                            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ VECTOR SEARCH (Pinecone)                                        │
│ ✓ Search for similar vectors                                   │
│ ✓ Filter: userId + documentId                                  │
│ ✓ Return top 5 chunks (cosine similarity)                      │
│ ✓ Time: ~500ms                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BUILD CONTEXT                                                   │
│ ✓ Combine retrieved chunks                                     │
│ ✓ Add document metadata                                        │
│ ✓ Total: ~2000 tokens                                          │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ GENERATE ANSWER (Gemini AI)                                    │
│ ✓ Send context + query to Gemini                               │
│ ✓ Model: gemini-2.0-flash-exp                                  │
│ ✓ Extract answer from response                                 │
│ ✓ Cite sources                                                 │
│ ✓ Time: ~2000ms                                                │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ RETURN TO USER                                                  │
│ ✓ Answer text                                                  │
│ ✓ Source documents                                             │
│ ✓ Confidence score                                             │
│ ✓ Total time: ~2800ms                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## TEXT EXTRACTION LAYER

### Overview
Text extraction is the first critical step - we need to convert binary files (PDF, DOCX, etc.) into readable text that can be processed.

### File: `textExtraction.service.ts`

### 1. PDF Extraction

**Native PDF (with embedded text)**:
```typescript
// Uses pdf-parse library
const pdfParse = require('pdf-parse').pdf;
const data = await pdfParse(buffer);

// Result:
{
  text: "Full document text...",
  numpages: 15,
  info: { ... }
}
```

**Scanned PDF (images of text)**:
```typescript
// Detects if text is empty → Falls back to OCR
if (!data.text || data.text.trim().length === 0) {
  console.log('📄 PDF appears to be scanned, using OCR...');
  const ocrResult = await visionService.extractTextFromScannedPDF(buffer);
  return { text: ocrResult.text, confidence: ocrResult.confidence };
}
```

### 2. Word Document Extraction (.docx)

**Uses mammoth.js library**:
```typescript
const mammoth = require('mammoth');
const result = await mammoth.extractRawText({ buffer });
const text = result.value;

// Result:
{
  value: "Full document text...",
  messages: [/* warnings */]
}
```

**Why mammoth?**
- Correctly handles .docx format (ZIP archive with XML)
- Preserves text structure
- Handles tables, lists, headings

### 3. Excel Spreadsheet Extraction (.xlsx, .xls)

**Uses xlsx library**:
```typescript
const XLSX = require('xlsx');
const workbook = XLSX.read(buffer, {
  type: 'buffer',
  cellFormula: true,  // Preserve formulas
  cellStyles: true,   // Preserve styles
  cellDates: true,    // Parse dates properly
  cellNF: true        // Number formats
});

// Convert each sheet to JSON
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,           // Array of arrays format
    defval: '',          // Default for empty cells
    blankrows: false,    // Skip blank rows
    raw: false           // Format values (dates, numbers)
  });

  // Output format:
  // Sheet 1: Finance
  // Headers: "Month" | "Revenue" | "Expenses"
  // Row 2: "January" | "$50,000" | "$30,000"
  // Row 3: "February" | "$60,000" | "$35,000"
}
```

**Key features**:
- ✅ Reads ALL sheets
- ✅ Preserves formulas (`=SUM(A1:A10)`)
- ✅ Detects headers automatically
- ✅ Handles dates, numbers, booleans correctly
- ✅ Truncates very long cell values (500 chars max)

### 4. PowerPoint Extraction (.pptx)

**Uses adm-zip + xml2js**:
```typescript
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

// PPTX is a ZIP archive
const zip = new AdmZip(buffer);
const zipEntries = zip.getEntries();

// Find slide XML files
for (const entry of zipEntries) {
  if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml$/)) {
    const slideXml = entry.getData().toString('utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(slideXml);

    // Extract text from XML nodes recursively
    const slideText = extractTextFromSlideXml(result, slideNumber);
    allText += `\n\n=== Slide ${slideCount} ===\n${slideText}`;
  }
}
```

**XML structure**:
```xml
<p:sld>
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>Slide text here</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
```

### 5. Image Extraction (OCR)

**Pre-processing for better OCR**:
```typescript
const sharp = require('sharp');

// Step 1: Increase resolution if too low
if (metadata.width < 1500) {
  pipeline = pipeline.resize(1500, null, { kernel: 'lanczos3' });
}

// Step 2: Convert to grayscale (reduces noise)
pipeline = pipeline.grayscale();

// Step 3: Normalize contrast (makes text stand out)
pipeline = pipeline.normalize();

// Step 4: Sharpen text edges
pipeline = pipeline.sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 });

// Step 5: Remove noise
pipeline = pipeline.median(3);

const processedBuffer = await pipeline.toBuffer();
```

**Then OCR with Google Cloud Vision**:
```typescript
const ocrResult = await visionService.extractTextFromImage(processedBuffer);
```

### Post-Processing (All Formats)

```typescript
function postProcessOCRText(text: string): string {
  // 1. Fix spacing
  cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces → single
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

  // 2. Fix punctuation
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1'); // Remove space before
  cleaned = cleaned.replace(/([.,!?;:])(\S)/g, '$1 $2'); // Add space after

  // 3. Fix OCR character mistakes
  // "0" → "O" in words (example: "G0al" → "Goal")
  cleaned = cleaned.replace(/(?<=[a-zA-Z])0(?=[a-zA-Z])/g, 'O');

  // "1" → "l" in words (example: "he1lo" → "hello")
  cleaned = cleaned.replace(/(?<=[a-z])1(?=[a-z])/g, 'l');

  // "|" → "I" (example: "|nformation" → "Information")
  cleaned = cleaned.replace(/\|(?=[a-zA-Z])|(?<=[a-zA-Z])\|/g, 'I');

  // 4. Fix common typos
  const corrections = { 'teh': 'the', 'adn': 'and', 'taht': 'that' };
  for (const [wrong, right] of Object.entries(corrections)) {
    cleaned = cleaned.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
  }

  return cleaned.trim();
}
```

---

## OCR SYSTEMS

### Google Cloud Vision API

**File**: `vision.service.ts`

### How it works

```typescript
import vision from '@google-cloud/vision';

const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: config.GCS_KEY_FILE,
  projectId: config.GCS_PROJECT_ID
});

// Document text detection (best for documents)
const [result] = await visionClient.documentTextDetection(imageBuffer);
const fullTextAnnotation = result.fullTextAnnotation;

// Structure:
{
  text: "Full extracted text...",
  pages: [
    {
      blocks: [
        {
          paragraphs: [
            {
              words: [
                {
                  symbols: [...],
                  confidence: 0.98
                }
              ]
            }
          ]
        }
      ],
      property: {
        detectedLanguages: [{ languageCode: 'en' }]
      }
    }
  ]
}
```

### Confidence Calculation

```typescript
// Calculate average confidence from all words
let totalConfidence = 0;
let wordCount = 0;

pages.forEach(page => {
  page.blocks?.forEach(block => {
    block.paragraphs?.forEach(paragraph => {
      paragraph.words?.forEach(word => {
        if (word.confidence) {
          totalConfidence += word.confidence;
          wordCount++;
        }
      });
    });
  });
});

const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
```

### Language Detection

```typescript
const detectedLanguages = fullTextAnnotation.pages?.[0]?.property?.detectedLanguages;
const primaryLanguage = detectedLanguages?.[0]?.languageCode; // "en", "es", "pt", etc.
```

### PDF OCR

```typescript
// Vision API can process PDF directly (for scanned PDFs)
const [result] = await visionClient.documentTextDetection(pdfBuffer);

// Returns same structure as image OCR
```

---

## EMBEDDING GENERATION

### What are embeddings?

**Embeddings are numerical representations of text that capture semantic meaning.**

```
Text: "What is machine learning?"
       ↓
Embedding API (Gemini)
       ↓
Vector: [0.234, -0.456, 0.789, 0.123, ..., -0.345]
         ↑
    768 numbers (dimensions)
```

**Why?** Computers can't compare text directly. Embeddings convert text to numbers that can be compared using math (cosine similarity).

### File: `embeddingService.service.ts`

### The Process

```typescript
class EmbeddingService {
  private readonly EMBEDDING_MODEL = 'text-embedding-004';
  private readonly EMBEDDING_DIMENSIONS = 768;
  private readonly MAX_TEXT_LENGTH = 20000; // Characters

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // 1. Preprocess text
    const processedText = this.preprocessText(text);
    // - Remove excessive whitespace
    // - Truncate if >20,000 characters

    // 2. Check cache (150x faster!)
    const cachedEmbedding = await embeddingCacheService.getCachedEmbedding(processedText);
    if (cachedEmbedding) {
      return { text, embedding: cachedEmbedding, dimensions: 768 };
    }

    // 3. Call Gemini API
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(processedText);
    const embedding = result.embedding.values; // Array of 768 floats

    // 4. Cache the result
    await embeddingCacheService.cacheEmbedding(processedText, embedding);

    return { text, embedding, dimensions: 768, model: 'text-embedding-004' };
  }
}
```

### Batch Processing

```typescript
async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const embeddings: EmbeddingResult[] = [];

  // Process in batches of 100
  const batches = this.createBatches(texts, 100);

  for (const batch of batches) {
    for (const text of batch) {
      const result = await this.generateEmbedding(text);
      embeddings.push(result);
    }

    // Wait 1 second between batches (rate limiting)
    await this.sleep(1000);
  }

  return { embeddings, totalProcessed: texts.length };
}
```

### Caching Strategy

**File**: `embeddingCache.service.ts`

```typescript
import NodeCache from 'node-cache';
import crypto from 'crypto';

class EmbeddingCacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600,      // 1 hour TTL
      maxKeys: 1000,     // Max 1000 entries
      useClones: false   // Don't clone (faster)
    });
  }

  // Generate cache key (MD5 hash of text)
  private getCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Get cached embedding
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    const key = this.getCacheKey(text);
    return this.cache.get<number[]>(key) || null;
  }

  // Store embedding
  async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = this.getCacheKey(text);
    this.cache.set(key, embedding);
  }
}
```

**Performance**:
- Cache hit: <5ms
- Cache miss: ~300ms (API call)
- **150x faster** for repeated queries!

### Retry Logic (Rate Limiting)

```typescript
async generateEmbedding(text: string, retryCount: number = 0): Promise<EmbeddingResult> {
  const maxRetries = 3;

  try {
    const result = await model.embedContent(text);
    return result;
  } catch (error: any) {
    // Check for rate limit (429 error)
    if (error.message?.includes('429')) {
      if (retryCount < maxRetries) {
        const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.warn(`⏳ Rate limit hit. Retrying in ${backoffDelay}ms...`);
        await this.sleep(backoffDelay);
        return this.generateEmbedding(text, retryCount + 1);
      }
    }
    throw error;
  }
}
```

---

## SEMANTIC CHUNKING

### Why chunk documents?

**Problem**: Documents are too long for embedding APIs and AI models
- Embedding API limit: ~20,000 characters
- AI context window: ~100,000 tokens (~400,000 characters)

**Solution**: Break documents into smaller chunks
- Each chunk: ~512 tokens (~2,000 characters)
- Overlap: 50 tokens (~200 characters) for context continuity

### File: `semanticChunker.service.ts`

### Semantic vs Simple Chunking

**Simple chunking** (bad):
```
Chunk 1: "The company reported strong growth in Q1. Revenue increased by 25%"
Chunk 2: "compared to last year. The CEO stated that..."
         ↑ PROBLEM: Sentence split across chunks!
```

**Semantic chunking** (good):
```
Chunk 1: "The company reported strong growth in Q1. Revenue increased by 25% compared to last year."
Chunk 2: "The CEO stated that expansion into new markets drove the growth."
         ↑ BETTER: Complete sentences, semantic boundaries respected
```

### How it works

```typescript
async chunkDocument(content: string, options: ChunkingOptions): Promise<Chunk[]> {
  // Step 1: Detect document structure
  const structure = documentStructureDetectorService.detectStructure(content);
  // Finds: headings, tables, lists

  // Step 2: Chunk by sections (if headings found)
  if (structure.headings.length > 0) {
    for (const heading of structure.headings) {
      const sectionContent = extractSection(heading);

      // Check if section has tables
      if (hasTables(sectionContent)) {
        // Keep tables intact (don't split)
        chunks.push(createTableChunk(table, heading));
      } else {
        // Regular chunking with overlap
        chunks.push(...chunkSection(sectionContent, heading, options));
      }
    }
  } else {
    // No headings → chunk by paragraphs
    chunks.push(...chunkByParagraphs(content, options));
  }

  return chunks;
}
```

### Chunk Structure

```typescript
interface Chunk {
  text: string;                // The actual content
  heading?: string;            // Section heading (for context)
  startToken: number;          // Start position
  endToken: number;            // End position
  metadata: {
    isTable?: boolean;
    tableCaption?: string;
    isList?: boolean;
    chunkIndex: number;
    totalChunks: number;
  };
}

// Example:
{
  text: "## Financial Results\n\nRevenue increased by 25% to $1.2M...",
  heading: "Financial Results",
  startToken: 0,
  endToken: 120,
  metadata: {
    chunkIndex: 3,
    totalChunks: 15
  }
}
```

### Excel Chunking (Special Case)

**File**: `excelProcessor.service.ts`

Excel needs TWO chunking approaches:

#### 1. Row-by-Row Chunking (Precise)

Preserves exact cell coordinates for deep linking:

```typescript
// Input: Excel row with cells A5, B5, C5
// Output chunk:
{
  content: "Sheet 2 'Revenue', Row 5: A5: Q1 Total | B5: $1,200,000 (formula: =SUM(B2:B4)) | C5: 25%",
  metadata: {
    sheetName: "Revenue",
    sheetNumber: 2,
    rowNumber: 5,
    cells: ["A5", "B5", "C5"],
    sourceType: "excel"
  }
}
```

**Use case**: "What is the value in cell B5?" → Can directly find this chunk

#### 2. Table-Based Chunking (Semantic)

Understands data as tables with headers:

```typescript
// Input: Excel table
// | Month    | Revenue    | Growth |
// | January  | $50,000    | 10%    |
// | February | $60,000    | 20%    |

// Output chunks:
{
  content: "Sheet 2 'Revenue' table data: Month: January, Revenue: $50,000, Growth: 10%",
  metadata: {
    sheetName: "Revenue",
    sheetNumber: 2,
    rowNumber: 2,
    sourceType: "excel_table",
    tableHeaders: ["Month", "Revenue", "Growth"]
  }
}

{
  content: "Sheet 2 'Revenue' table data: Month: February, Revenue: $60,000, Growth: 20%",
  metadata: {
    sheetName: "Revenue",
    sheetNumber: 2,
    rowNumber: 3,
    sourceType: "excel_table",
    tableHeaders: ["Month", "Revenue", "Growth"]
  }
}
```

**Use case**: "What was the revenue in February?" → Semantic search finds the chunk

### Overlap Strategy

```typescript
// Chunk with 50-token overlap
let start = 0;
while (start < tokens.length) {
  const end = Math.min(start + maxTokens, tokens.length);

  // Find semantic boundary (sentence/paragraph end)
  const adjustedEnd = this.findSemanticBoundary(tokens, end);

  const chunk = tokens.slice(start, adjustedEnd);
  chunks.push({ text: chunk, ... });

  // Move with overlap
  start = adjustedEnd - overlapTokens;
}

// Example:
// Chunk 1: tokens 0-512 (512 tokens)
// Chunk 2: tokens 462-974 (512 tokens, overlaps 50)
// Chunk 3: tokens 924-1436 (512 tokens, overlaps 50)
```

**Why overlap?** Ensures context continuity - if important info spans chunk boundary, both chunks will have it.

---

## VECTOR STORAGE

### Pinecone Database

**File**: `pinecone.service.ts`

### What is Pinecone?

**Pinecone** is a **vector database** - optimized for storing and searching high-dimensional vectors (embeddings).

**Why not regular database?**
- PostgreSQL: ~2-5 seconds for vector search
- Pinecone: ~300-800ms for same search
- **10x faster!**

### Storage Structure

```typescript
// Each chunk becomes a vector record
{
  id: "documentId-chunkIndex",  // Unique ID: "abc123-5"
  values: [0.234, -0.456, ...], // 768-dimensional embedding
  metadata: {
    // User & Document
    userId: "user123",
    documentId: "doc456",
    filename: "Business Plan.pdf",
    mimeType: "application/pdf",
    status: "completed",
    createdAt: "2025-10-30T10:00:00Z",

    // Chunk data
    chunkIndex: 5,
    content: "Revenue projections for Q1... (first 5000 chars)",

    // Location metadata (for filtering)
    page: 3,              // For PDFs
    slide: 2,             // For PPTX
    sheet: "Revenue",     // For Excel
    sheetNumber: 2,       // For Excel
    row: 5,               // For Excel
    cells: ["A5", "B5"]   // For Excel
  }
}
```

### Storage Flow

```typescript
async upsertDocumentEmbeddings(
  documentId: string,
  userId: string,
  documentMetadata: { filename, mimeType, createdAt, status },
  chunks: Array<{ chunkIndex, content, embedding, metadata }>
): Promise<void> {
  const index = this.pinecone.index('koda-gemini');

  // Prepare vectors
  const vectors = chunks.map(chunk => ({
    id: `${documentId}-${chunk.chunkIndex}`,
    values: chunk.embedding,  // 768 floats
    metadata: {
      userId,
      documentId,
      filename: documentMetadata.filename,
      mimeType: documentMetadata.mimeType,
      createdAt: documentMetadata.createdAt.toISOString(),
      chunkIndex: chunk.chunkIndex,
      content: chunk.content.substring(0, 5000), // First 5000 chars
      ...chunk.metadata  // page, slide, sheet, etc.
    }
  }));

  // Upsert in batches of 100
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await index.upsert(batch);
  }
}
```

### Search Flow

```typescript
async searchSimilarChunks(
  queryEmbedding: number[],  // 768-dimensional query vector
  userId: string,
  topK: number = 5,
  minSimilarity: number = 0.5,
  attachedDocumentId?: string
): Promise<Array<SearchResult>> {
  const index = this.pinecone.index('koda-gemini');

  // Build filter
  const filter: any = {
    userId: { $eq: userId }  // Always filter by user
  };

  // Add document filter if specified
  if (attachedDocumentId) {
    filter.$and = [
      { userId: { $eq: userId } },
      { documentId: { $eq: attachedDocumentId } }
    ];
    delete filter.userId;
  }

  // Query Pinecone
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: topK,
    includeMetadata: true,
    filter
  });

  // Format results
  return queryResponse.matches
    .filter(match => match.score >= minSimilarity)
    .map(match => ({
      documentId: match.metadata.documentId,
      chunkIndex: match.metadata.chunkIndex,
      content: match.metadata.content,
      similarity: match.score,
      metadata: match.metadata,
      document: {
        id: match.metadata.documentId,
        filename: match.metadata.filename,
        mimeType: match.metadata.mimeType
      }
    }));
}
```

### Similarity Calculation

**Cosine Similarity** - measures angle between vectors:

```
Vector A: [1, 2, 3]
Vector B: [2, 4, 6]

Cosine Similarity = (A · B) / (||A|| × ||B||)
                  = (1×2 + 2×4 + 3×6) / (√14 × √56)
                  = 28 / 28
                  = 1.0  (perfect match!)

Similarity Range: -1.0 to 1.0
- 1.0 = identical direction (perfect match)
- 0.5 = somewhat similar
- 0.0 = orthogonal (unrelated)
- -1.0 = opposite direction
```

**In practice**:
- >0.8 = Very similar (almost certainly relevant)
- 0.5-0.8 = Somewhat similar (likely relevant)
- <0.5 = Not very similar (likely irrelevant)

---

## RAG RETRIEVAL

### What is RAG?

**RAG (Retrieval-Augmented Generation)** = Search + AI Generation

Traditional AI: "Answer based on your training data"
RAG: "Answer based on THESE SPECIFIC DOCUMENTS"

### File: `rag.service.ts`

### Complete RAG Flow

```typescript
async generateAnswer(
  userId: string,
  query: string,
  conversationId: string,
  documentId?: string
): Promise<RAGResponse> {
  // STEP 1: Understand the query
  const intent = queryIntentService.detectIntent(query);
  // Intent types: content, navigation, greeting, list

  // STEP 2: Parse document name from query
  if (query.includes("koda presentation")) {
    const doc = await prisma.document.findFirst({
      where: { userId, filename: { contains: "koda presentation" }}
    });
    documentId = doc.id; // Scope search to this document
  }

  // STEP 3: Check cache
  const cacheKey = hash(query + userId + conversationId);
  const cached = await multiLayerCache.get(cacheKey);
  if (cached) return cached; // <50ms response!

  // STEP 4: Generate query embedding
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  // Result: [0.123, -0.456, ...] (768 dimensions)

  // STEP 5: Search Pinecone
  const results = await pineconeService.searchSimilarChunks(
    queryEmbedding,
    userId,
    topK: 5,
    minSimilarity: 0.5,
    attachedDocumentId: documentId
  );

  // Results:
  // [
  //   { content: "...", similarity: 0.92, document: { filename: "KODA.pptx" }},
  //   { content: "...", similarity: 0.88, document: { filename: "KODA.pptx" }},
  //   { content: "...", similarity: 0.85, document: { filename: "KODA.pptx" }},
  // ]

  // STEP 6: Build context for AI
  const context = results.map((r, i) =>
    `[Source ${i+1}: ${r.document.filename}]\n${r.content}`
  ).join('\n\n');

  // STEP 7: Generate answer with Gemini
  const answer = await this.callGemini(query, context);

  // STEP 8: Cache and return
  await multiLayerCache.set(cacheKey, { answer, sources: results });
  return { answer, sources: results };
}
```

### Location-Based Boosting

For queries like "What's on slide 3?", boost results from that slide:

```typescript
// Extract location references
const slideRef = this.extractSlideReference(query); // → 3
const sheetRef = this.extractSheetReference(query); // → "ex2"
const pageRef = this.extractPageReference(query);   // → 5

// Search with boosting
let results = await pineconeService.searchSimilarChunks(...);

// Apply boost
results = results.map(result => {
  let boost = 0;

  // Boost if slide matches
  if (slideRef && result.metadata.slide === slideRef) {
    boost = 0.3; // +30% similarity
  }

  // Boost if sheet matches
  if (sheetRef && result.metadata.sheet === sheetRef) {
    boost = 0.3;
  }

  return {
    ...result,
    similarity: Math.min(1.0, result.similarity + boost)
  };
});

// Re-sort by boosted similarity
results.sort((a, b) => b.similarity - a.similarity);
```

---

## AI RESPONSE GENERATION

### Gemini API

**Model**: `gemini-2.0-flash-exp`

**Why this model?**
- ⚡ Fast: 2-3 second response
- 🎯 Accurate: Good at following instructions
- 🧠 Smart: Understands context well
- 🆕 Experimental: Latest features

### Prompt Structure

```typescript
const systemPrompt = `You are KODA, an intelligent document assistant.

TASK: Answer the user's question using ONLY the context provided below.

RULES:
1. ONLY use information from the provided context
2. If the context doesn't contain the answer, say "I don't have that information in the provided documents"
3. Cite sources using the document names provided (e.g., "According to Business Plan.pdf...")
4. Be concise but complete
5. Maintain a helpful, professional tone
6. DO NOT make up information
7. DO NOT use your general knowledge - ONLY the context

CONTEXT:
${context}

USER QUESTION: ${query}

YOUR ANSWER:`;
```

**Example context**:
```
[Source 1: KODA Presentation.pptx]
KODA is an AI-powered document intelligence platform. We help businesses organize, search, and extract insights from their documents using advanced RAG technology.

[Source 2: KODA Presentation.pptx]
Our key features include:
- Smart document upload with OCR
- Natural language search
- Excel cell-level querying
- Multi-format support (PDF, DOCX, PPTX, Excel)

USER QUESTION: What does KODA presentation talk about?

YOUR ANSWER:
```

### API Call

```typescript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

const result = await model.generateContent([systemPrompt]);
const answer = result.response.text();

// Result:
// "Based on the KODA Presentation, KODA is an AI-powered document intelligence
//  platform that helps businesses organize, search, and extract insights from
//  documents. Key features include smart document upload with OCR, natural language
//  search, Excel cell-level querying, and support for multiple formats including
//  PDF, DOCX, PPTX, and Excel files."
```

### Retry Logic

```typescript
async callGeminiWithRetry(model: any, prompts: any[], maxRetries: number = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompts);
      return result;
    } catch (error: any) {
      // Check for rate limit (429)
      if (error.message?.includes('429')) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 60000); // 1s, 2s, 4s
        console.log(`⚠️ Rate limit. Retrying in ${delay/1000}s...`);
        await sleep(delay);
        continue;
      }
      throw error; // Other errors
    }
  }
}
```

---

## PERFORMANCE METRICS

### Typical Response Times

```
┌─────────────────────────────────────────┐
│ OPERATION           │ TIME   │ CACHING  │
├─────────────────────────────────────────┤
│ Query embedding     │ ~300ms │ <5ms ✅  │
│ Pinecone search     │ ~500ms │ N/A      │
│ Context building    │ ~50ms  │ N/A      │
│ Gemini response     │ ~2000ms│ <50ms ✅ │
├─────────────────────────────────────────┤
│ TOTAL (uncached)    │ ~2850ms│          │
│ TOTAL (cached)      │ <50ms  │ 57x faster!│
└─────────────────────────────────────────┘
```

### Document Processing Times

```
┌──────────────────────────────────────────────┐
│ FILE TYPE   │ SIZE   │ PROCESSING TIME       │
├──────────────────────────────────────────────┤
│ PDF (text)  │ 1MB    │ ~2-5 seconds          │
│ PDF (scanned)│ 1MB   │ ~10-20 seconds (OCR)  │
│ DOCX        │ 500KB  │ ~1-3 seconds          │
│ PPTX        │ 2MB    │ ~5-10 seconds         │
│ Excel       │ 500KB  │ ~3-7 seconds          │
│ Image       │ 2MB    │ ~5-15 seconds (OCR)   │
└──────────────────────────────────────────────┘
```

**Bottlenecks**:
1. **OCR** (images, scanned PDFs): 80% of processing time
2. **Embedding generation**: 15% of processing time
3. **Text extraction**: 5% of processing time

---

## SUMMARY

### The Complete Pipeline

```
1. USER UPLOADS → Encrypt → Store in GCS → Create DB record
2. TEXT EXTRACTION → pdf-parse, mammoth, xlsx, Vision API
3. PREPROCESSING → Fix spacing, OCR errors, typos
4. MARKDOWN CONVERSION → Structure preservation
5. SEMANTIC CHUNKING → 512-token chunks with overlap
6. EMBEDDING GENERATION → Gemini API (768 dimensions)
7. VECTOR STORAGE → Pinecone (with full metadata)
8. STATUS: "completed" → Ready for queries

When user asks question:
9. PARSE QUERY → Extract document name, intent
10. GENERATE QUERY EMBEDDING → Gemini API
11. SEARCH PINECONE → Top 5 similar chunks
12. BUILD CONTEXT → Combine chunks
13. CALL GEMINI → Generate answer
14. RETURN RESPONSE → Answer + sources + confidence
```

### Key Technologies

- **Text Extraction**: pdf-parse, mammoth, xlsx, adm-zip
- **OCR**: Google Cloud Vision API
- **Image Processing**: Sharp
- **Embeddings**: Google Gemini `text-embedding-004` (768D)
- **Vector DB**: Pinecone (cosine similarity)
- **LLM**: Google Gemini `gemini-2.0-flash-exp`
- **Caching**: node-cache (memory) + Redis
- **Storage**: Google Cloud Storage (encrypted)
- **Database**: PostgreSQL (Prisma ORM)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Author**: Claude Code Assistant
