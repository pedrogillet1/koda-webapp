import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import prisma from '../config/database';
import fileActionsService from './fileActions.service';
import { actionHistoryService } from './actionHistory.service';

// ════════════════════════════════════════════════════════════════════════════════
// DELETED DOCUMENT FILTER
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Filter out deleted documents from Pinecone results
 */
async function filterDeletedDocuments(matches: any[], userId: string): Promise<any[]> {
  if (!matches || matches.length === 0) return [];

  // Get unique document IDs
  const documentIds = [...new Set(matches.map(m => m.metadata?.documentId).filter(Boolean))];

  if (documentIds.length === 0) return matches;

  // Query database for valid (non-deleted) documents
  const validDocuments = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      userId: userId,
      status: { not: 'deleted' },
    },
    select: { id: true },
  });

  const validDocumentIds = new Set(validDocuments.map(d => d.id));

  // Filter matches to only include valid documents
  const filtered = matches.filter(m => validDocumentIds.has(m.metadata?.documentId));

  if (filtered.length < matches.length) {
    console.log(`🗑️ [FILTER] Removed deleted documents: ${matches.length} → ${filtered.length}`);
  }

  return filtered;
}

// ════════════════════════════════════════════════════════════════════════════════
// HYBRID RAG SERVICE - Simple, Reliable, 95%+ Success Rate
// ════════════════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE:
// 1. File Actions - Natural detection (create/rename/delete/move folder/file)
// 2. Comparisons - GUARANTEE multi-document retrieval
// 3. Document Counting - Count documents by type (how many PDFs, etc.)
// 4. Document Types - Show file types breakdown
// 5. Document Listing - List all user files
// 6. Meta-Queries - Answer from knowledge, don't search
// 7. Regular Queries - Standard RAG pipeline
//
// KEY FEATURES:
// - Real streaming (not fake word-by-word)
// - Fuzzy document matching (60% word match, no-spaces comparison)
// - Post-processing (remove emojis, fix "Next steps:", limit blank lines)
// - KODA persona (professional, friendly, bullet points, no emojis, bold)
//
// ════════════════════════════════════════════════════════════════════════════════

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

// Initialize Pinecone
async function initializePinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });
    pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME || 'koda-gemini');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION UTILITY
// ════════════════════════════════════════════════════════════════════════════════

function detectLanguage(query: string): 'pt' | 'es' | 'fr' | 'en' {
  const lower = query.toLowerCase();

  // Portuguese indicators
  const ptWords = ['quantos', 'quantas', 'quais', 'que', 'tenho', 'salvei', 'salvo',
                   'documento', 'documentos', 'arquivo', 'arquivos', 'pasta', 'cria', 'criar'];
  const ptCount = ptWords.filter(word => lower.includes(word)).length;

  // Spanish indicators
  const esWords = ['cuántos', 'cuántas', 'cuáles', 'qué', 'tengo', 'documento',
                   'documentos', 'archivo', 'archivos', 'carpeta', 'crear'];
  const esCount = esWords.filter(word => lower.includes(word)).length;

  // French indicators
  const frWords = ['combien', 'quels', 'quelles', 'quel', 'ai', 'j\'ai',
                   'document', 'documents', 'fichier', 'fichiers', 'dossier', 'créer'];
  const frCount = frWords.filter(word => lower.includes(word)).length;

  // Return language with most matches
  if (ptCount > esCount && ptCount > frCount && ptCount > 0) return 'pt';
  if (esCount > ptCount && esCount > frCount && esCount > 0) return 'es';
  if (frCount > ptCount && frCount > esCount && frCount > 0) return 'fr';

  return 'en'; // Default to English
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT - Streaming Answer Generation
// ════════════════════════════════════════════════════════════════════════════════

export async function generateAnswerStream(
  userId: string,
  query: string,
  conversationId: string,
  onChunk: (chunk: string) => void,
  attachedDocumentId?: string
): Promise<{ sources: any[] }> {
  console.log('🚀 [DEBUG] generateAnswerStream called');
  console.log('🚀 [DEBUG] onChunk is function:', typeof onChunk === 'function');

  await initializePinecone();

  console.log('\n🎯 [HYBRID RAG] Processing query:', query);
  console.log('📎 Attached document ID:', attachedDocumentId);

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 1: File Actions - Natural Detection AND EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────
  const fileAction = await detectFileAction(query);
  if (fileAction) {
    console.log('📁 [FILE ACTION] Detected:', fileAction);
    await handleFileAction(userId, query, fileAction, onChunk);
    return { sources: [] }; // File actions don't have sources
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 2: Comparisons - GUARANTEE Multi-Document Retrieval
  // ──────────────────────────────────────────────────────────────────────────────
  const comparison = await detectComparison(userId, query);
  if (comparison) {
    console.log('🔄 [COMPARISON] Detected:', comparison.documents);
    return await handleComparison(userId, query, comparison, onChunk);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 3: Document Counting - Count Documents by Type
  // ──────────────────────────────────────────────────────────────────────────────
  const countingCheck = isDocumentCountingQuery(query);
  if (countingCheck.isCounting) {
    console.log('🔢 [DOCUMENT COUNTING] Detected');
    return await handleDocumentCounting(userId, query, countingCheck.fileType, onChunk);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 4: Document Types - Show File Types
  // ──────────────────────────────────────────────────────────────────────────────
  if (isDocumentTypesQuery(query)) {
    console.log('📊 [DOCUMENT TYPES] Detected');
    return await handleDocumentTypes(userId, query, onChunk);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 5: Document Listing - List All Files
  // ──────────────────────────────────────────────────────────────────────────────
  if (isDocumentListingQuery(query)) {
    console.log('📋 [DOCUMENT LISTING] Detected');
    return await handleDocumentListing(userId, query, onChunk);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 6: Meta-Queries - Answer from Knowledge
  // ──────────────────────────────────────────────────────────────────────────────
  if (isMetaQuery(query)) {
    console.log('💭 [META-QUERY] Detected');
    await handleMetaQuery(query, onChunk);
    return { sources: [] }; // Meta queries don't have sources
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 7: Regular Queries - Standard RAG
  // ──────────────────────────────────────────────────────────────────────────────
  console.log('📚 [REGULAR QUERY] Processing');
  return await handleRegularQuery(userId, query, conversationId, onChunk, attachedDocumentId);
}

// ════════════════════════════════════════════════════════════════════════════════
// FILE ACTION DETECTION
// ════════════════════════════════════════════════════════════════════════════════

async function detectFileAction(query: string): Promise<string | null> {
  const lower = query.toLowerCase().trim();

  // ──────────────────────────────────────────────────────────────────────────────
  // STAGE 1: Regex Pattern Matching (Fast Path) - MULTILINGUAL
  // ──────────────────────────────────────────────────────────────────────────────

  // Folder operations (multilingual)
  if (/(create|make|new|add|cria|criar|nueva|nuevo|créer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'createFolder';
  }
  if (/(rename|change.*name|renomear|renombrar|renommer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'renameFolder';
  }
  if (/(delete|remove|deletar|apagar|eliminar|supprimer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'deleteFolder';
  }
  if (/(move|relocate|mover|déplacer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'moveFolder';
  }

  // File operations (multilingual)
  if (/(create|make|new|add|cria|criar|nueva|nuevo|créer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'createFile';
  }
  if (/(rename|change.*name|renomear|renombrar|renommer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'renameFile';
  }
  if (/(delete|remove|deletar|apagar|eliminar|supprimer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'deleteFile';
  }
  if (/(move|relocate|mover|déplacer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'moveFile';
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // STAGE 2: LLM Intent Detection (Fallback for natural queries)
  // ──────────────────────────────────────────────────────────────────────────────

  try {
    console.log('🤖 [FILE ACTION] No strict match, trying LLM intent detection...');

    // Dynamic import to avoid circular dependency
    const { llmIntentDetectorService } = await import('./llmIntentDetector.service');

    const intentResult = await llmIntentDetectorService.detectIntent(query);
    console.log('🤖 [FILE ACTION] LLM intent:', intentResult);

    // Map LLM intents to file actions
    const fileActionIntents: Record<string, string> = {
      'create_folder': 'createFolder',
      'move_files': 'moveFile',
      'rename_file': 'renameFile',
      'delete_file': 'deleteFile'
    };

    if (fileActionIntents[intentResult.intent] && intentResult.confidence > 0.7) {
      const action = fileActionIntents[intentResult.intent];
      console.log(`✅ [FILE ACTION] LLM detected: ${action}`);
      return action;
    }

    console.log('❌ [FILE ACTION] LLM confidence too low or not a file action');
  } catch (error) {
    console.error('❌ [FILE ACTION] LLM intent detection failed:', error);
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// FILE ACTION EXECUTION - ACTUALLY EXECUTE ACTIONS
// ════════════════════════════════════════════════════════════════════════════════

async function handleFileAction(
  userId: string,
  query: string,
  actionType: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  console.log(`🔧 [FILE ACTION] Executing: ${actionType}`);

  // Detect language
  const lang = detectLanguage(query);

  try {
    // ✅ FIX: Use fileActionsService.executeAction which handles name→ID lookup
    const result = await fileActionsService.executeAction(query, userId);

    // Stream the result to the user with language translation
    if (result.success) {
      // Translate success message to detected language
      let translatedMessage = result.message;

      // Translate common success patterns
      if (lang === 'pt') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Pasta "$1" criada com sucesso')
          .replace(/File "(.+?)" moved successfully/i, 'Arquivo "$1" movido com sucesso')
          .replace(/File "(.+?)" renamed successfully/i, 'Arquivo "$1" renomeado com sucesso')
          .replace(/File "(.+?)" deleted successfully/i, 'Arquivo "$1" deletado com sucesso')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Pasta "$1" renomeada com sucesso')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Pasta "$1" deletada com sucesso');
      } else if (lang === 'es') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Carpeta "$1" creada exitosamente')
          .replace(/File "(.+?)" moved successfully/i, 'Archivo "$1" movido exitosamente')
          .replace(/File "(.+?)" renamed successfully/i, 'Archivo "$1" renombrado exitosamente')
          .replace(/File "(.+?)" deleted successfully/i, 'Archivo "$1" eliminado exitosamente')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Carpeta "$1" renombrada exitosamente')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Carpeta "$1" eliminada exitosamente');
      } else if (lang === 'fr') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Dossier "$1" créé avec succès')
          .replace(/File "(.+?)" moved successfully/i, 'Fichier "$1" déplacé avec succès')
          .replace(/File "(.+?)" renamed successfully/i, 'Fichier "$1" renommé avec succès')
          .replace(/File "(.+?)" deleted successfully/i, 'Fichier "$1" supprimé avec succès')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Dossier "$1" renommé avec succès')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Dossier "$1" supprimé avec succès');
      }

      onChunk(translatedMessage);

      // TODO: Record action for undo (needs refactoring)
      // The executeAction doesn't return document/folder IDs needed for undo
    } else {
      const sorry = lang === 'pt' ? 'Desculpe, não consegui completar essa ação:' :
                    lang === 'es' ? 'Lo siento, no pude completar esa acción:' :
                    lang === 'fr' ? 'Désolé, je n\'ai pas pu compléter cette action:' :
                    'Sorry, I couldn\'t complete that action:';
      onChunk(`${sorry} ${result.error || result.message}`);
    }

  } catch (error: any) {
    console.error('❌ [FILE ACTION] Error:', error);
    const sorry = lang === 'pt' ? 'Desculpe, ocorreu um erro ao tentar executar essa ação:' :
                  lang === 'es' ? 'Lo siento, ocurrió un error al intentar ejecutar esa acción:' :
                  lang === 'fr' ? 'Désolé, une erreur s\'est produite lors de l\'exécution de cette action:' :
                  'Sorry, an error occurred while trying to execute that action:';
    onChunk(`${sorry} ${error.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPARISON DETECTION - FUZZY MATCHING
// ════════════════════════════════════════════════════════════════════════════════

async function detectComparison(userId: string, query: string): Promise<{
  documents: string[];
  aspect?: string;
} | null> {
  const lower = query.toLowerCase();

  // Check for comparison keywords
  const comparisonPatterns = [
    /\bcompare\b/,
    /\bdifference(s)?\b/,
    /\bvs\b/,
    /\bversus\b/,
    /\band\b.*\band\b/,  // "doc1 and doc2"
  ];

  const hasComparisonKeyword = comparisonPatterns.some(pattern => pattern.test(lower));

  if (!hasComparisonKeyword) {
    return null;
  }

  // Extract document mentions with fuzzy matching
  const mentions = await extractDocumentMentions(userId, query);

  if (mentions.length >= 2) {
    console.log('✅ [COMPARISON] Found documents:', mentions);
    return { documents: mentions };
  }

  console.log('❌ [COMPARISON] Not enough documents found');
  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// FUZZY DOCUMENT MATCHING
// ════════════════════════════════════════════════════════════════════════════════

async function extractDocumentMentions(userId: string, query: string): Promise<string[]> {
  const queryLower = query.toLowerCase();

  // Get all user's documents
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { id: true, filename: true },
  });

  console.log(`📄 [FUZZY MATCH] Checking ${documents.length} documents`);

  const matches: string[] = [];

  for (const doc of documents) {
    if (isDocumentMentioned(queryLower, doc.filename)) {
      console.log(`✅ [FUZZY MATCH] Found: ${doc.filename}`);
      matches.push(doc.id);
    }
  }

  return matches;
}

function isDocumentMentioned(queryLower: string, documentName: string): boolean {
  const docNameLower = documentName.toLowerCase();

  // Remove file extensions for matching
  const docNameNoExt = docNameLower.replace(/\.(pdf|docx?|txt|xlsx?|pptx?|csv)$/i, '');

  // Split into words
  const docWords = docNameNoExt.split(/\s+/).filter(w => w.length > 0);

  // Check if 60% of words are present
  const threshold = Math.ceil(docWords.length * 0.6);
  let matchCount = 0;

  for (const word of docWords) {
    // Remove spaces and special chars for flexible matching
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    const cleanQuery = queryLower.replace(/[^a-z0-9\s]/g, '');

    if (cleanQuery.includes(cleanWord)) {
      matchCount++;
    }
  }

  const matched = matchCount >= threshold;

  if (matched) {
    console.log(`  ✓ "${documentName}" matched: ${matchCount}/${docWords.length} words (threshold: ${threshold})`);
  }

  return matched;
}

/**
 * Extract potential document names from query
 * Examples:
 * - "what is pedro1 about" → ["pedro1"]
 * - "compare pedro1 and pedro2" → ["pedro1", "pedro2"]
 * - "tell me about the marketing report" → ["marketing", "report"]
 */
function extractDocumentNames(query: string): string[] {
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2);  // Ignore short words like "is", "me"

  console.log('🔍 [EXTRACT] All words:', words);

  // Remove common question words AND file extensions
  const stopWords = new Set([
    'what', 'tell', 'about', 'the', 'and', 'compare', 'between',
    'show', 'find', 'get', 'give', 'how', 'why', 'when', 'where',
    'can', 'you', 'please', 'summary', 'summarize', 'does', 'talk',
    'pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'pptx', 'ppt', 'csv'
  ]);

  const result = words.filter(w => !stopWords.has(w));
  console.log('🔍 [EXTRACT] After filtering stop words:', result);
  return result;
}

/**
 * Find documents matching potential names using fuzzy matching
 */
async function findDocumentsByName(
  userId: string,
  potentialNames: string[]
): Promise<string[]> {
  if (potentialNames.length === 0) return [];

  console.log('🔍 [DOC SEARCH] Looking for documents matching:', potentialNames);

  try {
    // Get all user's documents from database
    const allDocs = await prisma.document.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true, filename: true },
    });

    console.log(`📄 [DOC SEARCH] Checking ${allDocs.length} documents`);

    // Fuzzy match against potential names
    const matchedDocIds: string[] = [];

    for (const doc of allDocs) {
      const docLower = doc.filename.toLowerCase();
      const docWithoutExt = docLower.replace(/\.(pdf|docx?|txt|xlsx?|pptx?|csv)$/i, '');

      console.log(`📄 [DOC SEARCH] Checking document: "${doc.filename}" (lower: "${docLower}", without ext: "${docWithoutExt}")`);

      for (const potentialName of potentialNames) {
        const match1 = docLower.includes(potentialName);
        const match2 = potentialName.includes(docWithoutExt);
        const match3 = docWithoutExt.includes(potentialName);

        console.log(`  🔍 Testing "${potentialName}": docLower.includes="${match1}", potentialName.includes(docWithoutExt)="${match2}", docWithoutExt.includes="${match3}"`);

        // Check if document name contains the potential name OR vice versa
        if (match1 || match2 || match3) {
          matchedDocIds.push(doc.id);
          console.log(`  ✅ [DOC SEARCH] MATCHED "${potentialName}" → "${doc.filename}"`);
          break;
        }
      }
    }

    return matchedDocIds;

  } catch (error) {
    console.error('❌ [DOC SEARCH] Error:', error);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPARISON HANDLER - GUARANTEE Multi-Document Retrieval
// ════════════════════════════════════════════════════════════════════════════════

async function handleComparison(
  userId: string,
  query: string,
  comparison: { documents: string[] },
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('🔄 [COMPARISON] Retrieving content for documents:', comparison.documents);

  // GUARANTEE: Search each document separately
  const allChunks: any[] = [];

  for (const docId of comparison.documents) {
    console.log(`  📄 Searching document: ${docId}`);

    // Generate embedding for query
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;

    // Search this specific document
    const rawResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 5,
      filter: { documentId: docId },
      includeMetadata: true,
    });

    // Filter out deleted documents
    const filteredMatches = await filterDeletedDocuments(rawResults.matches || [], userId);

    console.log(`  ✅ Found ${filteredMatches.length} chunks for ${docId}`);

    if (filteredMatches.length > 0) {
      allChunks.push(...filteredMatches);
    }
  }

  console.log(`✅ [COMPARISON] Total chunks retrieved: ${allChunks.length}`);

  // Build context from all chunks
  const context = allChunks
    .map((match: any) => {
      const meta = match.metadata || {};
      // ✅ FIX: Use correct field names from Pinecone (content, filename, page)
      return `[Document: ${meta.filename || 'Unknown'}, Page: ${meta.page || 'N/A'}]\n${meta.content || ''}`;
    })
    .join('\n\n---\n\n');

  // Build sources array - GUARANTEE all compared documents appear
  // First, get unique documents from chunks
  const chunksMap = new Map<string, any>();
  allChunks.forEach((match: any) => {
    const docName = match.metadata?.filename || 'Unknown';
    if (!chunksMap.has(docName)) {
      chunksMap.set(docName, match);
    }
  });

  // Then, ensure ALL comparison documents are in sources (even if no chunks)
  const sources: any[] = [];

  // Add documents that had chunks
  for (const [docName, match] of chunksMap.entries()) {
    sources.push({
      documentName: docName,
      pageNumber: match.metadata?.page || 0,
      score: match.score || 0
    });
  }

  // Add any missing documents from the comparison list
  for (const docId of comparison.documents) {
    // Get document info from database
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { filename: true }
    });

    if (doc && !sources.find(s => s.documentName === doc.filename)) {
      sources.push({
        documentName: doc.filename,
        pageNumber: 0,
        score: 0
      });
    }
  }

  // Generate comparison answer
  const systemPrompt = `You are KODA, a professional AI assistant helping users understand their documents.

The user wants to compare multiple documents. Here's the relevant content from each:

${context}

LANGUAGE DETECTION (CRITICAL):
- ALWAYS respond in the SAME LANGUAGE as the user's query
- Portuguese query → Portuguese response
- English query → English response
- Spanish query → Spanish response
- Detect the language automatically and match it exactly

CROSS-DOCUMENT SYNTHESIS (Critical):
- Don't just summarize each document independently
- Merge insights into a unified conceptual framework
- Build conceptual bridges between documents
- Identify: Where do they overlap? Where do they diverge?
- Reveal patterns only visible when viewed together
- Synthesize insights from comparison, not just side-by-side summaries

INFERENTIAL REASONING:
- Explain HOW concepts in different documents relate to each other
- Connect ideas causally across documents
- Infer implicit relationships and dependencies
- Example: If Doc A discusses "value" and Doc B discusses "trust", explain how value creation depends on trust

CRITICAL RULE - NO IMPLICATIONS SECTION:
- NEVER add an "Implications:" section or heading
- NEVER use the word "Implications" as a section header
- Integrate insights naturally as you compare
- Explain what the comparison MEANS and why it matters within your main comparison
- ONLY if the user explicitly asks "what are the implications" or "what does this mean", add 1-2 sentences at the end
- Keep all insights embedded in the main comparison content, not separated

FORMATTING INSTRUCTIONS (CRITICAL - FOLLOW EXACTLY):
- Between bullet points: Use SINGLE newline only (no blank lines)
- Before "Next step:" section: Use ONE blank line
- Compare the documents clearly and objectively
- Bold key differences with **text**
- DO NOT include inline citations (no parentheses with document names/pages in the text)
- Be thorough but concise
- NO emojis
- End with ONE "**Next step:**" bullet only (always bold)

User query: "${query}"`;

  await streamLLMResponse(systemPrompt, '', onChunk);
  return { sources };
}

// ════════════════════════════════════════════════════════════════════════════════
// DOCUMENT COUNTING DETECTION & HANDLER
// ════════════════════════════════════════════════════════════════════════════════

function isDocumentCountingQuery(query: string): { isCounting: boolean; fileType?: string } {
  const lower = query.toLowerCase().trim();

  // Check for counting keywords (multilingual)
  const hasCountKeyword = lower.includes('how many') || lower.includes('count') ||
                         lower.includes('quantos') || lower.includes('quantas') || // Portuguese
                         lower.includes('cuántos') || lower.includes('cuántas') || // Spanish
                         lower.includes('combien') || // French
                         lower.includes('contar');

  const hasDocKeyword = lower.includes('document') || lower.includes('file') ||
                        lower.includes('documento') || lower.includes('arquivo') || // Portuguese
                        lower.includes('fichier') || // French
                        lower.includes('pdf') || lower.includes('excel') ||
                        lower.includes('xlsx') || lower.includes('docx') ||
                        lower.includes('pptx') || lower.includes('image') ||
                        lower.includes('imagem') || // Portuguese
                        lower.includes('png') || lower.includes('jpg');

  if (!hasCountKeyword || !hasDocKeyword) {
    return { isCounting: false };
  }

  // Extract file type if specified
  let fileType: string | undefined;
  if (lower.includes('pdf')) fileType = '.pdf';
  else if (lower.includes('excel') || lower.includes('xlsx')) fileType = '.xlsx';
  else if (lower.includes('word') || lower.includes('docx')) fileType = '.docx';
  else if (lower.includes('powerpoint') || lower.includes('pptx')) fileType = '.pptx';
  else if (lower.includes('image') || lower.includes('png')) fileType = '.png';
  else if (lower.includes('jpg') || lower.includes('jpeg')) fileType = '.jpg';

  return { isCounting: true, fileType };
}

async function handleDocumentCounting(
  userId: string,
  query: string,
  fileType: string | undefined,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log(`🔢 [DOCUMENT COUNTING] Counting documents${fileType ? ` of type ${fileType}` : ''}`);

  // Detect language
  const lang = detectLanguage(query);

  const whereClause: any = {
    userId,
    status: { not: 'deleted' },
  };

  if (fileType) {
    whereClause.filename = { endsWith: fileType };
  }

  const count = await prisma.document.count({ where: whereClause });
  const documents = await prisma.document.findMany({
    where: whereClause,
    select: { filename: true },
  });

  // Build multilingual response
  let response = '';

  if (fileType) {
    const typeName = fileType.replace('.', '').toUpperCase();
    const fileWord = count === 1 ?
      (lang === 'pt' ? 'arquivo' : lang === 'es' ? 'archivo' : lang === 'fr' ? 'fichier' : 'file') :
      (lang === 'pt' ? 'arquivos' : lang === 'es' ? 'archivos' : lang === 'fr' ? 'fichiers' : 'files');

    const youHave = lang === 'pt' ? 'Você tem' : lang === 'es' ? 'Tienes' : lang === 'fr' ? 'Vous avez' : 'You have';
    response = `${youHave} **${count}** ${fileWord} ${typeName}.`;

    if (count > 0) {
      response += '\n\n';
      documents.forEach(doc => {
        response += `• ${doc.filename}\n`;
      });
    }
  } else {
    const docWord = count === 1 ?
      (lang === 'pt' ? 'documento' : lang === 'es' ? 'documento' : lang === 'fr' ? 'document' : 'document') :
      (lang === 'pt' ? 'documentos' : lang === 'es' ? 'documentos' : lang === 'fr' ? 'documents' : 'documents');

    const youHave = lang === 'pt' ? 'Você tem' : lang === 'es' ? 'Tienes' : lang === 'fr' ? 'Vous avez' : 'You have';
    const inTotal = lang === 'pt' ? 'no total' : lang === 'es' ? 'en total' : lang === 'fr' ? 'au total' : 'in total';
    response = `${youHave} **${count}** ${docWord} ${inTotal}.`;
  }

  const nextStep = lang === 'pt' ? '**Próximo passo:**' : lang === 'es' ? '**Próximo paso:**' : lang === 'fr' ? '**Prochaine étape:**' : '**Next step:**';
  const question = lang === 'pt' ? 'O que você gostaria de saber sobre esses documentos?' :
                   lang === 'es' ? '¿Qué te gustaría saber sobre estos documentos?' :
                   lang === 'fr' ? 'Que souhaitez-vous savoir sur ces documents?' :
                   'What would you like to know about these documents?';

  response += `\n\n${nextStep}\n${question}`;

  onChunk(response);

  const sources = documents.map(doc => ({
    documentName: doc.filename,
    pageNumber: 0,
    score: 1.0,
  }));

  return { sources };
}

// ════════════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPES DETECTION & HANDLER
// ════════════════════════════════════════════════════════════════════════════════

function isDocumentTypesQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  const hasTypeKeyword = lower.includes('what type') || lower.includes('what kind') ||
                         lower.includes('which type') || lower.includes('file type') ||
                         lower.includes('que tipo') || lower.includes('quais tipos') || // Portuguese
                         lower.includes('qué tipo') || lower.includes('cuáles tipos') || // Spanish
                         lower.includes('quel type') || lower.includes('quels types'); // French

  const hasDocKeyword = lower.includes('document') || lower.includes('file') ||
                        lower.includes('documento') || lower.includes('arquivo') || // Portuguese
                        lower.includes('fichier'); // French

  const hasHaveKeyword = lower.includes('have') || lower.includes('got') || lower.includes('own') ||
                         lower.includes('tenho') || lower.includes('salvei') || // Portuguese
                         lower.includes('salvo') || lower.includes('guardado') || // Portuguese
                         lower.includes('tengo') || // Spanish
                         lower.includes('ai') || lower.includes('j\'ai'); // French

  return hasTypeKeyword && hasDocKeyword && hasHaveKeyword;
}

async function handleDocumentTypes(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('📊 [DOCUMENT TYPES] Fetching document types from database');

  // Detect language
  const lang = detectLanguage(query);

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
    },
    select: { filename: true },
  });

  const typeMap = new Map<string, string[]>();
  documents.forEach(doc => {
    const ext = doc.filename.substring(doc.filename.lastIndexOf('.')).toLowerCase();
    if (!typeMap.has(ext)) {
      typeMap.set(ext, []);
    }
    typeMap.get(ext)!.push(doc.filename);
  });

  // Build multilingual response
  let response = '';

  const basedOn = lang === 'pt' ? 'Com base nos arquivos que você enviou, você tem os seguintes tipos de arquivos:' :
                  lang === 'es' ? 'Según los archivos que subiste, tienes los siguientes tipos de archivos:' :
                  lang === 'fr' ? 'En fonction des fichiers que vous avez téléchargés, vous avez les types de fichiers suivants:' :
                  'Based on the files you uploaded, you have the following types of files:';

  if (typeMap.size === 0) {
    const noDocsYet = lang === 'pt' ? 'Você ainda não tem documentos enviados.' :
                      lang === 'es' ? 'Aún no tienes documentos subidos.' :
                      lang === 'fr' ? 'Vous n\'avez pas encore de documents téléchargés.' :
                      "You don't have any documents uploaded yet.";

    const nextStep = lang === 'pt' ? '**Próximo passo:**' : lang === 'es' ? '**Próximo paso:**' : lang === 'fr' ? '**Prochaine étape:**' : '**Next step:**';
    const uploadSome = lang === 'pt' ? 'Envie alguns documentos para começar!' :
                       lang === 'es' ? '¡Sube algunos documentos para comenzar!' :
                       lang === 'fr' ? 'Téléchargez des documents pour commencer!' :
                       'Upload some documents to get started!';

    response = `${noDocsYet}\n\n${nextStep}\n${uploadSome}`;
  } else {
    response = `${basedOn}\n\n`;

    // Sort by count (descending)
    const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => b[1].length - a[1].length);

    sortedTypes.forEach(([ext, files]) => {
      const typeName = ext.replace('.', '').toUpperCase();
      const fileWord = files.length === 1 ?
        (lang === 'pt' ? 'arquivo' : lang === 'es' ? 'archivo' : lang === 'fr' ? 'fichier' : 'file') :
        (lang === 'pt' ? 'arquivos' : lang === 'es' ? 'archivos' : lang === 'fr' ? 'fichiers' : 'files');

      response += `• **${typeName}** (${files.length} ${fileWord}): `;
      response += files.map(f => f).join(', ');
      response += '\n';
    });

    const nextStep = lang === 'pt' ? '**Próximo passo:**' : lang === 'es' ? '**Próximo paso:**' : lang === 'fr' ? '**Prochaine étape:**' : '**Next step:**';
    const question = lang === 'pt' ? 'O que você gostaria de saber sobre esses documentos?' :
                     lang === 'es' ? '¿Qué te gustaría saber sobre estos documentos?' :
                     lang === 'fr' ? 'Que souhaitez-vous savoir sur ces documents?' :
                     'What would you like to know about these documents?';

    response += `\n${nextStep}\n${question}`;
  }

  onChunk(response);

  const sources = documents.map(doc => ({
    documentName: doc.filename,
    pageNumber: 0,
    score: 1.0,
  }));

  return { sources };
}

// ════════════════════════════════════════════════════════════════════════════════
// DOCUMENT LISTING DETECTION & HANDLER
// ════════════════════════════════════════════════════════════════════════════════

function isDocumentListingQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Flexible keyword-based detection (multilingual)
  const hasListKeyword = lower.includes('which') || lower.includes('what') ||
                         lower.includes('show') || lower.includes('list') ||
                         lower.includes('quais') || lower.includes('que') || // Portuguese
                         lower.includes('mostrar') || lower.includes('listar') || // Portuguese
                         lower.includes('cuáles') || lower.includes('qué') || // Spanish
                         lower.includes('quels') || lower.includes('quelles'); // French

  const hasDocKeyword = lower.includes('document') || lower.includes('file') ||
                        lower.includes('documento') || lower.includes('arquivo') || // Portuguese
                        lower.includes('fichier'); // French

  const hasHaveKeyword = lower.includes('have') || lower.includes('upload') ||
                         lower.includes('got') || lower.includes('own') ||
                         lower.includes('tenho') || lower.includes('salvei') || // Portuguese
                         lower.includes('salvo') || lower.includes('guardado') || // Portuguese
                         lower.includes('tengo') || // Spanish
                         lower.includes('ai') || lower.includes('j\'ai'); // French

  return hasListKeyword && hasDocKeyword && hasHaveKeyword;
}

async function handleDocumentListing(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('📋 [DOCUMENT LISTING] Fetching all user documents from database');

  // Detect language
  const lang = detectLanguage(query);

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
    },
    select: { filename: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Build multilingual response
  let response = '';

  const basedOn = lang === 'pt' ? 'Com base nos arquivos que você enviou, você tem os seguintes documentos:' :
                  lang === 'es' ? 'Según los archivos que subiste, tienes los siguientes documentos:' :
                  lang === 'fr' ? 'En fonction des fichiers que vous avez téléchargés, vous avez les documents suivants:' :
                  'Based on the files you uploaded, you have the following documents:';

  if (documents.length === 0) {
    const noDocsYet = lang === 'pt' ? 'Você ainda não tem documentos enviados.' :
                      lang === 'es' ? 'Aún no tienes documentos subidos.' :
                      lang === 'fr' ? 'Vous n\'avez pas encore de documents téléchargés.' :
                      "You don't have any documents uploaded yet.";

    const nextStep = lang === 'pt' ? '**Próximo passo:**' : lang === 'es' ? '**Próximo paso:**' : lang === 'fr' ? '**Prochaine étape:**' : '**Next step:**';
    const uploadSome = lang === 'pt' ? 'Envie alguns documentos para começar!' :
                       lang === 'es' ? '¡Sube algunos documentos para comenzar!' :
                       lang === 'fr' ? 'Téléchargez des documents pour commencer!' :
                       'Upload some documents to get started!';

    response = `${noDocsYet}\n\n${nextStep}\n${uploadSome}`;
  } else {
    response = `${basedOn}\n\n`;
    documents.forEach(doc => {
      response += `• ${doc.filename}\n`;
    });

    const nextStep = lang === 'pt' ? '**Próximo passo:**' : lang === 'es' ? '**Próximo paso:**' : lang === 'fr' ? '**Prochaine étape:**' : '**Next step:**';
    const question = lang === 'pt' ? 'O que você gostaria de saber sobre esses documentos?' :
                     lang === 'es' ? '¿Qué te gustaría saber sobre estos documentos?' :
                     lang === 'fr' ? 'Que souhaitez-vous savoir sur ces documents?' :
                     'What would you like to know about these documents?';

    response += `\n${nextStep}\n${question}`;
  }

  onChunk(response);

  const sources = documents.map(doc => ({
    documentName: doc.filename,
    pageNumber: 0,
    score: 1.0,
  }));

  return { sources };
}

// ════════════════════════════════════════════════════════════════════════════════
// META-QUERY DETECTION
// ════════════════════════════════════════════════════════════════════════════════

function isMetaQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  const metaPatterns = [
    /^(hi|hey|hello|greetings)/,
    /what (can|do) you (do|help)/,
    /who are you/,
    /what are you/,
    /how (do|can) (i|you)/,
    /tell me about (yourself|koda)/,
  ];

  return metaPatterns.some(pattern => pattern.test(lower));
}

// ════════════════════════════════════════════════════════════════════════════════
// META-QUERY HANDLER
// ════════════════════════════════════════════════════════════════════════════════

async function handleMetaQuery(query: string, onChunk: (chunk: string) => void): Promise<void> {
  const prompt = `You are KODA, a professional AI document assistant.

LANGUAGE DETECTION (CRITICAL):
- ALWAYS respond in the SAME LANGUAGE as the user's query
- Portuguese query → Portuguese response
- English query → English response
- Spanish query → Spanish response
- Detect the language automatically and match it exactly

WHAT YOU CAN DO:
- Answer questions about uploaded documents
- Compare multiple documents
- Search across all documents
- Summarize content
- Extract specific information
- Help with document organization (create/rename/delete folders and files)

FORMATTING INSTRUCTIONS (CRITICAL - FOLLOW EXACTLY):
- Between bullet points: Use SINGLE newline only (no blank lines)
- Before "Next step:" section: Use ONE blank line
- Professional, friendly tone
- Bold key features with **text**
- NO emojis
- End with ONE "**Next step:**" bullet only (always bold)

User query: "${query}"

Respond naturally and helpfully.`;

  return streamLLMResponse(prompt, '', onChunk);
}

// ════════════════════════════════════════════════════════════════════════════════
// REGULAR QUERY HANDLER
// ════════════════════════════════════════════════════════════════════════════════

async function handleRegularQuery(
  userId: string,
  query: string,
  conversationId: string,
  onChunk: (chunk: string) => void,
  attachedDocumentId?: string
): Promise<void> {
  console.log('📚 [REGULAR QUERY] Starting RAG pipeline');

  // ✅ PSYCHOLOGICAL LAYER AUTO-ACTIVATION
  // Check if query contains psychology-relevant keywords
  const psychologyTriggers = ['perception', 'experience', 'motivation', 'trust', 'behavior',
                               'value', 'satisfaction', 'loyalty', 'emotion', 'feeling',
                               'customer', 'engagement', 'brand', 'relationship'];
  const needsPsychology = psychologyTriggers.some(trigger =>
    query.toLowerCase().includes(trigger)
  );

  if (needsPsychology) {
    console.log('🧠 [PSYCHOLOGY LAYER] Detected psychology-relevant query, enriching context');
  }

  // Generate query embedding
  const embeddingResult = await embeddingModel.embedContent(query);
  const queryEmbedding = embeddingResult.embedding.values;

  // Build search filter
  const filter: any = { userId };

  // ✅ NEW: Try to detect document names in query
  let searchResults;

  if (attachedDocumentId) {
    // Use attached document if provided
    filter.documentId = attachedDocumentId;
    console.log('📎 [REGULAR QUERY] Filtering by attached document:', attachedDocumentId);

    const rawResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 20,
      filter,
      includeMetadata: true,
    });

    const filteredMatches = await filterDeletedDocuments(rawResults.matches || [], userId);
    searchResults = { matches: filteredMatches };
  } else {
    // ✅ NEW: Try to find documents by name
    const potentialNames = extractDocumentNames(query);
    const matchedDocs = await findDocumentsByName(userId, potentialNames);

    if (matchedDocs.length > 0) {
      console.log(`✅ [REGULAR QUERY] Found ${matchedDocs.length} documents by name`);

      // Search within matched documents
      const allResults = [];

      for (const docId of matchedDocs) {
        const docFilter = { userId, documentId: docId };
        const rawResults = await pineconeIndex.query({
          vector: queryEmbedding,
          topK: 5,
          filter: docFilter,
          includeMetadata: true,
        });

        const filteredMatches = await filterDeletedDocuments(rawResults.matches || [], userId);
        allResults.push(...filteredMatches);
      }

      searchResults = { matches: allResults };
    } else {
      // Fall back to regular vector search
      console.log('📊 [REGULAR QUERY] No document names detected, using vector search');
      const rawResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 20,
        filter,
        includeMetadata: true,
      });

      const filteredMatches = await filterDeletedDocuments(rawResults.matches || [], userId);
      searchResults = { matches: filteredMatches };
    }
  }

  console.log(`✅ [REGULAR QUERY] Found ${searchResults.matches?.length || 0} relevant chunks`);

  // 🐛 DEBUG: Log first chunk to see what Pinecone is returning
  if (searchResults.matches && searchResults.matches.length > 0) {
    console.log('🐛 [DEBUG] First chunk sample:', JSON.stringify(searchResults.matches[0], null, 2));
  }

  // ✅ PSYCHOLOGICAL LAYER ENRICHMENT
  // If psychology-relevant, search for PSYCOLOGY.pdf concepts
  if (needsPsychology) {
    try {
      // Find PSYCOLOGY.pdf document
      const psychDoc = await prisma.document.findFirst({
        where: {
          userId,
          filename: { contains: 'PSYCOLOGY', mode: 'insensitive' },
          status: { not: 'deleted' }
        },
        select: { id: true, filename: true }
      });

      if (psychDoc) {
        console.log('🧠 [PSYCHOLOGY LAYER] Found PSYCOLOGY.pdf, enriching context');

        // Query relevant psychological concepts
        const psychFilter = { userId, documentId: psychDoc.id };
        const psychResults = await pineconeIndex.query({
          vector: queryEmbedding,
          topK: 3, // Get top 3 relevant psychology chunks
          filter: psychFilter,
          includeMetadata: true,
        });

        // Add psychology chunks to search results
        if (psychResults.matches && psychResults.matches.length > 0) {
          const filteredPsychMatches = await filterDeletedDocuments(psychResults.matches, userId);
          searchResults.matches = [...(searchResults.matches || []), ...filteredPsychMatches];
          console.log(`🧠 [PSYCHOLOGY LAYER] Added ${filteredPsychMatches.length} psychological concepts to context`);
        }
      }
    } catch (error) {
      console.error('⚠️ [PSYCHOLOGY LAYER] Error enriching with psychology:', error);
      // Continue without psychological enrichment if error occurs
    }
  }

  // Build context
  const context = searchResults.matches
    ?.map((match: any) => {
      const meta = match.metadata || {};
      // ✅ FIX: Use correct field names from Pinecone (content, filename, page)
      return `[Source: ${meta.filename || 'Unknown'}, Page: ${meta.page || 'N/A'}]\n${meta.content || ''}`;
    })
    .join('\n\n---\n\n') || '';

  console.log(`📝 [CONTEXT] Length: ${context.length} chars`);
  console.log(`📝 [CONTEXT] Preview: ${context.substring(0, 200)}...`);
  console.log(`🐛 [DEBUG] Full context (first 500 chars): ${context.substring(0, 500)}`);

  // Build sources array from search results
  const sources = searchResults.matches?.map((match: any) => ({
    documentName: match.metadata?.filename || 'Unknown',
    pageNumber: match.metadata?.page || 0,
    score: match.score || 0
  })) || [];

  // System prompt
  const systemPrompt = `You are KODA, a professional AI assistant helping users understand their documents.

RELEVANT CONTENT FROM USER'S DOCUMENTS:
${context}

LANGUAGE DETECTION (CRITICAL):
- ALWAYS respond in the SAME LANGUAGE as the user's query
- Portuguese query → Portuguese response
- English query → English response
- Spanish query → Spanish response
- Detect the language automatically and match it exactly

RESPONSE RULES:
- Start with a brief intro (MAX 2 sentences)
- Answer based on the provided content from the user's uploaded documents
- Bold key information with **text**
- DO NOT include inline citations (no parentheses with document names/pages in the text)
- If the content doesn't contain the specific information requested, say: "I couldn't find information about [topic] in your uploaded documents."
- NEVER ask the user to upload documents - they already have documents uploaded
- NEVER say "please upload" or "provide documents" - instead say "I don't have that information in your current documents"

INFERENTIAL REASONING (Critical):
- Don't just list facts - explain HOW concepts relate to each other
- Connect ideas causally (e.g., "X leads to Y because...")
- Infer implicit relationships between concepts
- Example: When discussing "trust", connect it to "security and emotional attachment"
- Synthesize information across multiple sources to reveal deeper patterns
- Explain the practical implications and "why this matters"

CRITICAL RULE - NO IMPLICATIONS SECTION:
- NEVER add an "Implications:" section or heading
- NEVER use the word "Implications" as a section header
- Integrate insights naturally INTO your answer as you explain concepts
- Explain what things MEAN and why they matter as part of your main explanation
- ONLY if the user explicitly asks "what are the implications" or "what does this mean", add 1-2 sentences at the end
- Keep all insights embedded in the main content, not separated

FORMATTING INSTRUCTIONS (CRITICAL - FOLLOW EXACTLY):
- Between bullet points: Use SINGLE newline only (no blank lines)
- Before "Next step:" section: Use ONE blank line
- NO emojis
- End with ONE "**Next step:**" bullet only (always bold)

User query: "${query}"`;

  await streamLLMResponse(systemPrompt, '', onChunk);
  return { sources };
}

// ════════════════════════════════════════════════════════════════════════════════
// REAL STREAMING - Gemini generateContentStream
// ════════════════════════════════════════════════════════════════════════════════

async function streamLLMResponse(
  systemPrompt: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  console.log('🌊 [STREAMING] Starting real stream');

  const fullPrompt = context ? `${systemPrompt}\n\nContext:\n${context}` : systemPrompt;

  let fullAnswer = '';

  try {
    const result = await model.generateContentStream(fullPrompt);

    // ✅ REAL STREAMING: Stream chunks in real-time with spacing fixes
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullAnswer += text;

      // Apply precise spacing rules for clean, readable output
      const processedChunk = text
        // ✅ CRITICAL: Remove inline citations like (filename.pdf, Page: N/A)
        .replace(/\([^)]*\.(pdf|xlsx|docx|pptx|png|jpg|jpeg),?\s*Page:\s*[^)]*\)/gi, '')
        // Ensure one blank line (double newline) after headers before bullet lists
        .replace(/(:)\n([•\-\*])/g, '$1\n\n$2')
        // Remove extra blank lines between bullets (keep them tight)
        .replace(/\n\s*\n\s*([•\-\*])/g, '\n$1')
        // Ensure one blank line (double newline) after the last bullet before next sections
        .replace(/([•\-\*].+)\n(?=[A-Z][a-z]+|Next step:|How can I help|I'?m ready)/g, '$1\n\n')
        // Collapse 3+ newlines into one blank line (2 \n)
        .replace(/\n{3,}/g, '\n\n')
        // Fix quadruple asterisks
        .replace(/\*\*\*\*/g, '**')
        // Remove emojis and symbols
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[❌✅🔍📁📊📄🎯⚠️💡🚨]/g, '')
        // ✅ "Next step:" formatting - make bold and remove gaps
        .replace(/Next step:\s*\n\s*\n/g, '\n**Next step:**\n')  // Make bold and remove gaps
        .replace(/Next step:/g, '**Next step:**')  // Make any remaining bold
        .replace(/Próximo passo:\s*\n\s*\n/g, '\n**Próximo passo:**\n')  // Portuguese
        .replace(/Próximo passo:/g, '**Próximo passo:**')
        .replace(/Próximo paso:\s*\n\s*\n/g, '\n**Próximo paso:**\n')  // Spanish
        .replace(/Próximo paso:/g, '**Próximo paso:**')
        .replace(/Prochaine étape:\s*\n\s*\n/g, '\n**Prochaine étape:**\n')  // French
        .replace(/Prochaine étape:/g, '**Prochaine étape:**')
        .replace(/\*\*\*\*Next step:\*\*\*\*/g, '**Next step:**')  // Fix double-bolding
        .replace(/\*\*\*\*Próximo passo:\*\*\*\*/g, '**Próximo passo:**')
        .replace(/\*\*\*\*Próximo paso:\*\*\*\*/g, '**Próximo paso:**')
        .replace(/\*\*\*\*Prochaine étape:\*\*\*\*/g, '**Prochaine étape:**');

      onChunk(processedChunk);
    }

    console.log('✅ [STREAMING] Complete. Total chars:', fullAnswer.length);

  } catch (error: any) {
    console.error('❌ [STREAMING] Error:', error);
    onChunk('I apologize, but I encountered an error generating the response. Please try again.');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// POST-PROCESSING
// ════════════════════════════════════════════════════════════════════════════════

function postProcessAnswer(answer: string): string {
  let processed = answer;

  // Remove emojis
  processed = processed.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  processed = processed.replace(/[❌✅🔍📁📊📄🎯⚠️💡🚨]/g, '');

  // Fix excessive blank lines - CRITICAL: Use \n\n\n+ to preserve paragraph breaks!
  // Replace 3+ newlines (2+ blank lines) with 2 newlines (1 blank line)
  processed = processed.replace(/\n\n\n+/g, '\n\n');

  // Fix quadruple asterisks
  processed = processed.replace(/\*\*\*\*/g, '**');

  // Fix "Next steps:" or "Next step:" to bold "**Next step:**"
  processed = processed.replace(/Next steps?:/gi, '**Next step:**');

  // Trim
  processed = processed.trim();

  return processed;
}

// ════════════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - Non-streaming version (fallback)
// ════════════════════════════════════════════════════════════════════════════════

export async function generateAnswer(
  userId: string,
  query: string,
  conversationId: string,
  attachedDocumentId?: string
): Promise<{ answer: string; sources: any[] }> {
  console.log('⚠️  [LEGACY] Using non-streaming method (deprecated)');

  let fullAnswer = '';
  const sources: any[] = [];

  await generateAnswerStream(
    userId,
    query,
    conversationId,
    (chunk) => {
      fullAnswer += chunk;
    },
    attachedDocumentId
  );

  return {
    answer: fullAnswer,
    sources, // TODO: Extract sources from context
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// BACKWARDS COMPATIBILITY WRAPPER
// ════════════════════════════════════════════════════════════════════════════════
// Old signature: (userId, query, conversationId, answerLength, documentId, onChunk)
// Returns: { answer: string, sources: any[] }
// New signature: (userId, query, conversationId, onChunk, attachedDocumentId)
// Returns: void (streams only)
export async function generateAnswerStreaming(
  userId: string,
  query: string,
  conversationId: string,
  answerLength: 'short' | 'medium' | 'summary' | 'long',
  documentId: string | null | undefined,
  onChunk: (chunk: string) => void
): Promise<{ answer: string; sources: any[] }> {
  // Accumulate chunks to build final answer
  let fullAnswer = '';

  // Wrap the onChunk callback to accumulate chunks
  const accumulatingCallback = (chunk: string) => {
    fullAnswer += chunk;
    onChunk(chunk); // Still call the original callback for streaming
  };

  // Call the new hybrid RAG function
  await generateAnswerStream(
    userId,
    query,
    conversationId,
    accumulatingCallback,
    documentId || undefined
  );

  // Return result object for backwards compatibility
  return {
    answer: fullAnswer,
    sources: [], // Hybrid RAG doesn't provide sources yet
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT (for backward compatibility with default imports)
// ════════════════════════════════════════════════════════════════════════════════
export default {
  generateAnswer,
  generateAnswerStream,
  generateAnswerStreaming,
};


