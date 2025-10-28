import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Query classification types based on complexity and routing strategy
 */
export enum QueryType {
  SIMPLE_GREETING = 'SIMPLE_GREETING',           // "Hello", "Hi", "How are you?"
  SIMPLE_METADATA = 'SIMPLE_METADATA',           // "What files?", "How many documents?"
  SIMPLE_CONVERSATION = 'SIMPLE_CONVERSATION',   // "Thanks", "Got it"
  COMPLEX_RAG = 'COMPLEX_RAG'                    // Everything else requiring RAG
}

/**
 * Classification result with confidence and metadata
 */
export interface QueryClassification {
  type: QueryType;
  confidence: number;
  metadata?: {
    categoryName?: string;
    mimeType?: string;
    filename?: string;
  };
}

class QueryClassifier {
  /**
   * Main classification method - determines query type and routing
   */
  async classify(query: string, userId: string): Promise<QueryClassification> {
    const normalized = query.toLowerCase().trim();

    // 1. Check for simple greetings
    const greetingResult = this.isGreeting(normalized);
    if (greetingResult.isMatch) {
      return {
        type: QueryType.SIMPLE_GREETING,
        confidence: greetingResult.confidence
      };
    }

    // 2. Check for simple conversational responses
    const conversationResult = this.isSimpleConversation(normalized);
    if (conversationResult.isMatch) {
      return {
        type: QueryType.SIMPLE_CONVERSATION,
        confidence: conversationResult.confidence
      };
    }

    // 3. Check for simple metadata queries
    const metadataResult = await this.isMetadataQuery(normalized, userId);
    if (metadataResult.isMatch) {
      return {
        type: QueryType.SIMPLE_METADATA,
        confidence: metadataResult.confidence,
        metadata: metadataResult.metadata
      };
    }

    // 4. Default to complex RAG query
    return {
      type: QueryType.COMPLEX_RAG,
      confidence: 1.0
    };
  }

  /**
   * Detect greeting patterns
   */
  private isGreeting(query: string): { isMatch: boolean; confidence: number } {
    const greetingPatterns = [
      /^hi$/i,
      /^hello$/i,
      /^hey$/i,
      /^good (morning|afternoon|evening)$/i,
      /^how are you(\?)?$/i,
      /^what's up(\?)?$/i,
      /^howdy$/i,
      /^greetings$/i,
      /^hi there$/i,
      /^hello there$/i
    ];

    for (const pattern of greetingPatterns) {
      if (pattern.test(query)) {
        return { isMatch: true, confidence: 0.95 };
      }
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect simple conversational responses
   */
  private isSimpleConversation(query: string): { isMatch: boolean; confidence: number } {
    const conversationPatterns = [
      /^thanks?$/i,
      /^thank you$/i,
      /^ok$/i,
      /^okay$/i,
      /^got it$/i,
      /^understood$/i,
      /^cool$/i,
      /^great$/i,
      /^perfect$/i,
      /^awesome$/i,
      /^bye$/i,
      /^goodbye$/i,
      /^see you$/i,
      /^no$/i,
      /^yes$/i,
      /^yeah$/i,
      /^yep$/i,
      /^nope$/i
    ];

    for (const pattern of conversationPatterns) {
      if (pattern.test(query)) {
        return { isMatch: true, confidence: 0.9 };
      }
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect metadata queries that can be answered without RAG
   */
  private async isMetadataQuery(query: string, userId: string): Promise<{
    isMatch: boolean;
    confidence: number;
    metadata?: any;
  }> {
    // Pattern 1: "What files?" / "What documents?"
    if (
      /^what (files|documents)(\?)?$/i.test(query) ||
      /^list (files|documents)$/i.test(query) ||
      /^show (me )?(my )?(files|documents)$/i.test(query)
    ) {
      return { isMatch: true, confidence: 0.9 };
    }

    // Pattern 2: "How many files/documents?"
    if (
      /^how many (files|documents)(\?)?$/i.test(query) ||
      /^(file|document) count$/i.test(query)
    ) {
      return { isMatch: true, confidence: 0.9 };
    }

    // Pattern 3: "Do I have X files?" (specific file types)
    const fileTypeMatch = query.match(/do i have (any )?(\w+) (files|documents)(\?)?$/i);
    if (fileTypeMatch) {
      const fileType = fileTypeMatch[2].toLowerCase();
      const mimeType = this.getMimeTypeFromString(fileType);

      return {
        isMatch: true,
        confidence: 0.85,
        metadata: { mimeType }
      };
    }

    // Pattern 4: "Which documents are PDFs/Excel/etc?"
    const whichTypeMatch = query.match(/which (files|documents) are (\w+)(\?)?$/i);
    if (whichTypeMatch) {
      const fileType = whichTypeMatch[2].toLowerCase();
      const mimeType = this.getMimeTypeFromString(fileType);

      return {
        isMatch: true,
        confidence: 0.85,
        metadata: { mimeType }
      };
    }

    // Pattern 5: "Where is [filename]?"
    const whereIsMatch = query.match(/where is (the )?(.+?)(\?)?$/i);
    if (whereIsMatch) {
      const filename = whereIsMatch[2].trim();

      // Check if file exists
      const fileExists = await this.checkFileExists(filename, userId);
      if (fileExists) {
        return {
          isMatch: true,
          confidence: 0.8,
          metadata: { filename }
        };
      }
    }

    // Pattern 6: Category queries
    const categoryMatch = query.match(/files in (the )?(.+?) (category|folder)(\?)?$/i);
    if (categoryMatch) {
      const categoryName = categoryMatch[2].trim();

      return {
        isMatch: true,
        confidence: 0.8,
        metadata: { categoryName }
      };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Convert file type string to MIME type
   */
  private getMimeTypeFromString(fileType: string): string | undefined {
    const mimeTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'pdfs': 'application/pdf',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'powerpoint': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt': 'application/vnd.ms-powerpoint',
      'image': 'image/',
      'images': 'image/',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'text': 'text/plain',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };

    return mimeTypeMap[fileType.toLowerCase()];
  }

  /**
   * Check if a file exists for the user
   */
  private async checkFileExists(filename: string, userId: string): Promise<boolean> {
    try {
      // Get all documents for the user and do case-insensitive matching in memory
      // (SQLite doesn't support mode: 'insensitive' in Prisma Client)
      const documents = await prisma.document.findMany({
        where: { userId },
        select: { filename: true }
      });

      const filenameLower = filename.toLowerCase();
      const match = documents.find(doc =>
        doc.filename.toLowerCase().includes(filenameLower)
      );

      return !!match;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }
}

export default new QueryClassifier();
