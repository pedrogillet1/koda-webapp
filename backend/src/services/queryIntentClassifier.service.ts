/**
 * Query Intent Classifier Service
 * Determines if a query needs document context, general knowledge, or both
 * Enhanced to distinguish between document requests (user wants the file) vs information requests (user wants info about the file)
 */

export interface QueryIntent {
  intent: 'general' | 'document' | 'hybrid' | 'document_request' | 'capability' | 'ambiguous';
  confidence: number;
  reasoning: string;
  needsContext: boolean;
  retrievalCount?: number;
  questionType?: 'definition' | 'overview' | 'specific' | 'request' | 'capability' | 'other';
  isDocumentRequest?: boolean; // ⚡ NEW: True if user wants the actual document (not just info about it)
}

class QueryIntentClassifier {
  /**
   * Classify the intent of a user query
   */
  classify(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase().trim();

    // ⚡ STEP 0: Detect question sub-type FIRST (capability vs request vs definition vs overview vs specific)

    // ⚡ NEW: Detect capability questions (user asking about Koda itself)
    const capabilityPatterns = [
      /^what can you do/i,
      /^what do you do/i,
      /^how do you work/i,
      /^what are you/i,
      /^who are you/i,
      /^your capabilities/i,
      /^your features/i,
      /^help me understand koda/i,
      /^what is koda/i,
      /^tell me about yourself/i,
      /^what are your abilities/i,
    ];

    const isCapabilityQuestion = capabilityPatterns.some(p => p.test(lowerQuery));

    // ⚡ NEW: Detect document request patterns (user wants the actual file/document)
    const documentRequestPatterns = [
      /^(give|send|show|get|fetch|provide|share) (me )?(.+)/i,  // "give me X", "show me Y", "send X"
      /^i (want|need) (.+)/i,  // "I want X", "I need Y"
      /^(download|open|access) (.+)/i,  // "download X", "open Y"
      /^can you (give|send|show|get|provide) (me )?(.+)/i,  // "can you give me X"
      /^could you (give|send|show|get|provide) (me )?(.+)/i,  // "could you send me Y"
    ];

    const isDocumentRequest = documentRequestPatterns.some(p => p.test(lowerQuery));

    const definitionPatterns = [
      /^what is (a |an |the )?(\w+)(\s+\w+)?$/i,  // "what is RAG", "what is a neural network"
      /^what are (\w+)(\s+\w+)?$/i,  // "what are embeddings"
      /^define (\w+)/i,  // "define RAG"
      /^what does (\w+) mean/i,  // "what does RAG mean"
    ];

    const overviewPatterns = [
      /^tell me about (the |my |this )?(.+)(plan|document|file|blueprint|presentation)/i,  // "tell me about koda business plan"
      /^(what|tell me about|explain|describe) (is |are )?(the |my )?(.*)(plan|document|file|blueprint|presentation)$/i,  // "what is the koda business plan"
      /^overview of/i,  // "overview of X"
      /^summarize (the |my )?(.+)/i,  // "summarize the business plan"
    ];

    const isDefinitionQuestion = definitionPatterns.some(p => p.test(lowerQuery));
    const isOverviewQuestion = overviewPatterns.some(p => p.test(lowerQuery));

    // 1. Detect general knowledge questions (no documents needed)
    const generalKnowledgePatterns = [
      // Definitional questions
      /^what is (a |an |the )?(\w+)/i,
      /^what are (\w+)/i,
      /^define (\w+)/i,
      /^explain (what|how) (\w+)/i,

      // How-to questions (general)
      /^how (do|does|can|to) (i |you |we )?(\w+)/i,
      /^how does (\w+) work/i,

      // Math/calculations
      /calculate|solve|compute|math|equation/i,
      /what is \d+\s*[\+\-\*\/]/i, // Math expressions

      // General assistance
      /^help (me )?(with|solve|understand|learn)/i,
      /^can you (help|explain|teach)/i,

      // Greetings and small talk
      /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
      /^(how are you|what's up|wassup)/i,
    ];

    const isGeneral = generalKnowledgePatterns.some((pattern) =>
      pattern.test(lowerQuery)
    );

    // 2. Detect document-specific questions
    const documentPatterns = [
      // Location/navigation
      /where (is|can i find|are)/i,
      /location of/i,
      /which (folder|directory|file)/i,

      // Specific data retrieval
      /show me (the|my)/i,
      /find (the|my)/i,
      /list (all|my)/i,
      /get (the|my)/i,

      // Content queries with "my" or "the"
      /(in|from) (my|the|this) (document|file|folder)/i,
      /according to (my|the) (document|file)/i,

      // References to uploaded content
      /(my|our) (document|file|folder|project|code)/i,

      // ✅ EXCEL CELL QUERIES: "what is cell A7", "cell B4 in sheet 2", etc.
      /cell\s+[a-z]+\d+/i,  // "cell A7", "cell B4"
      /what (is|are) (the )?cell/i,  // "what is cell A7", "what are cells A1:B5"
      /(in|from) (sheet|row|column)\s+\d+/i,  // "in sheet 2", "from row 5"

      // ✅ MAC FIX: Detect queries about specific documents/plans/files
      /latest version (of|in)/i,  // "latest version of koda business plan"
      /version of (.*) (plan|document|file|pdf)/i,  // "version of X plan"
      /koda.*plan/i,  // "koda business plan" (specific to KODA docs)
      /business.*plan/i,  // "business plan"
      /(what|tell me about) (is )?(the |my )?(.*)(plan|document|file|report|presentation)/i,  // "what is the business plan"
      /information (about|on|in) (the |my )?(.*)(plan|document|file)/i,  // "information about the plan"
    ];

    const isDocument = documentPatterns.some((pattern) =>
      pattern.test(lowerQuery)
    );

    // 3. Detect hybrid questions (need both general + document knowledge)
    const hybridPatterns = [
      // Explanations referencing documents
      /explain.*?(my|the|this) (document|file|code)/i,
      /how does (my|the|this) (document|file|code)/i,
      /what does (my|the|this) (document|file|code)/i,

      // Comparisons
      /compare.*?(my|the|this)/i,
      /difference between.*?(my|the)/i,

      // Analysis requests
      /analyze (my|the|this)/i,
      /summarize (my|the|this)/i,
      /review (my|the|this)/i,

      // Apply concepts to documents
      /(apply|use).*?(to|in|with) (my|the|this)/i,
    ];

    const isHybrid = hybridPatterns.some((pattern) =>
      pattern.test(lowerQuery)
    );

    // 4. Decision logic with priority handling

    // ⚡ PRIORITY 0: Capability questions (user asking about Koda itself)
    if (isCapabilityQuestion) {
      return {
        intent: 'capability',
        confidence: 0.98,
        reasoning: 'User asking about Koda\'s capabilities and features',
        needsContext: false,
        questionType: 'capability',
      };
    }

    // ⚡ PRIORITY 1: Document requests (user wants the actual file)
    if (isDocumentRequest) {
      return {
        intent: 'document_request',
        confidence: 0.95,
        reasoning: 'User requesting access to document file',
        needsContext: true,
        retrievalCount: 5,
        questionType: 'request',
        isDocumentRequest: true,
      };
    }

    // ⚡ PRIORITY 2: Definition questions are ALWAYS general knowledge (unless explicitly about "my/the document")
    if (isDefinitionQuestion && !isDocument) {
      return {
        intent: 'general',
        confidence: 0.95,
        reasoning: 'Simple definition question - using general knowledge',
        needsContext: false,
        questionType: 'definition',
      };
    }

    // ⚡ PRIORITY 2: Overview questions about documents need comprehensive retrieval
    if (isOverviewQuestion && isDocument) {
      return {
        intent: 'document',
        confidence: 0.95,
        reasoning: 'Document overview question - retrieving comprehensive context',
        needsContext: true,
        retrievalCount: 15,  // ⚡ Retrieve MORE chunks for overview questions
        questionType: 'overview',
      };
    }

    // PRIORITY 3: Hybrid questions
    if (isHybrid) {
      return {
        intent: 'hybrid',
        confidence: 0.8,
        reasoning: 'Query requires both general knowledge and document-specific context',
        needsContext: true,
        retrievalCount: 5,
        questionType: 'other',
      };
    }

    // PRIORITY 4: General knowledge
    if (isGeneral && !isDocument) {
      return {
        intent: 'general',
        confidence: 0.9,
        reasoning: 'Query asks for general knowledge or concepts',
        needsContext: false,
        questionType: 'other',
      };
    }

    // PRIORITY 5: Document-specific questions
    if (isDocument || (!isGeneral && !isDocument)) {
      return {
        intent: 'document',
        confidence: 0.85,
        reasoning: 'Query appears to reference specific documents or content',
        needsContext: true,
        retrievalCount: 5,  // Standard retrieval for specific questions
        questionType: 'specific',
      };
    }

    // Fallback: document search
    return {
      intent: 'document',
      confidence: 0.6,
      reasoning: 'Unclear intent, defaulting to document search',
      needsContext: true,
      retrievalCount: 3,
      questionType: 'other',
    };
  }

  /**
   * Get retrieval count based on intent
   */
  getRetrievalCount(intent: QueryIntent): number {
    return intent.retrievalCount || 3;
  }

  /**
   * Check if query needs context retrieval
   */
  needsContextRetrieval(intent: QueryIntent): boolean {
    return intent.needsContext;
  }
}

export default new QueryIntentClassifier();
