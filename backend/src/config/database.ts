import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ═══════════════════════════════════════════════════════════════════════════════
// INFINITE CONVERSATION MEMORY: Post-message-save chunking trigger
// ═══════════════════════════════════════════════════════════════════════════════
// PURPOSE: Trigger conversation chunking after messages are saved
// WHY: This enables infinite conversation memory (Manus-style)
// HOW: Export a helper that can be called after message creation
// NOTE: Prisma v6 removed $use() middleware, so we use a different approach
// ═══════════════════════════════════════════════════════════════════════════════

// Flag to enable/disable infinite memory (can be set via env var)
const INFINITE_MEMORY_ENABLED = process.env.INFINITE_MEMORY_ENABLED !== 'false';

// Import chunking trigger lazily to avoid circular dependencies
let chunkingTrigger: any = null;
const getChunkingTrigger = async () => {
  if (!chunkingTrigger) {
    try {
      const module = await import('../services/conversationChunkingTrigger.service');
      chunkingTrigger = module.default;
    } catch (error) {
      console.warn('♾️ [DATABASE] Could not load chunking trigger:', error);
    }
  }
  return chunkingTrigger;
};

/**
 * Trigger infinite memory chunking after a message is saved
 * Call this after any prisma.message.create() call
 */
export async function triggerInfiniteMemoryChunking(conversationId: string, userId?: string): Promise<void> {
  if (!INFINITE_MEMORY_ENABLED) return;

  try {
    // Get userId from conversation if not provided
    let finalUserId = userId;
    if (!finalUserId) {
      const conversation = await basePrisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true }
      });
      finalUserId = conversation?.userId;
    }

    if (finalUserId) {
      // Trigger chunking asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          const trigger = await getChunkingTrigger();
          if (trigger) {
            await trigger.triggerAfterMessage(conversationId, finalUserId);
          }
        } catch (error) {
          console.debug('♾️ [DATABASE] Chunking trigger error (non-blocking):', error);
        }
      });
    }
  } catch (error) {
    // Silent fail - chunking errors shouldn't break message saving
    console.debug('♾️ [DATABASE] Trigger error (non-blocking):', error);
  }
}

// ✅ COMPATIBILITY LAYER: Create plural aliases for Prisma model accessors
// The generated Prisma client uses singular names (prisma.user), but our codebase uses plural (prisma.users)
// This creates aliases to maintain backward compatibility
const prisma = Object.assign(basePrisma, {
  // Plural aliases mapping to singular Prisma accessors
  users: basePrisma.user,
  sessions: basePrisma.session,
  documents: basePrisma.document,
  folders: basePrisma.folder,
  tags: basePrisma.tag,
  conversations: basePrisma.conversation,
  messages: basePrisma.message,
  reminders: basePrisma.reminder,
  notifications: basePrisma.notification,
  categories: basePrisma.category,

  // Document-related plurals
  document_metadata: basePrisma.documentMetadata,
  document_tags: basePrisma.documentTag,
  document_categories: basePrisma.documentCategory,
  document_summaries: basePrisma.documentSummary,
  document_embeddings: basePrisma.documentEmbedding,
  document_entities: basePrisma.documentEntity,
  document_keywords: basePrisma.documentKeyword,
  document_shares: basePrisma.documentShare,

  // Auth-related plurals
  two_factor_auth: basePrisma.twoFactorAuth,
  verification_codes: basePrisma.verificationCode,
  pending_users: basePrisma.pendingUser,

  // Chat-related plurals
  chat_documents: basePrisma.chatDocument,
  chat_contexts: basePrisma.chatContext,
  message_attachments: basePrisma.messageAttachment,

  // Other plurals
  cloud_integrations: basePrisma.cloudIntegration,
  audit_logs: basePrisma.auditLog,
  user_preferences: basePrisma.userPreferences,
  terminology_maps: basePrisma.terminologyMap,
  api_usage: basePrisma.aPIUsage,
  api_keys: basePrisma.aPIKey,

  // RBAC plurals
  roles: basePrisma.role,
  permissions: basePrisma.permission,
  role_permissions: basePrisma.rolePermission,
  user_roles: basePrisma.userRole,
  role_hierarchy: basePrisma.roleHierarchy,

  // Generated documents
  generated_documents: basePrisma.generatedDocument,
  document_templates: basePrisma.documentTemplate,
  document_edit_history: basePrisma.documentEditHistory,

  // Excel
  excel_sheets: basePrisma.excelSheet,
  excel_cells: basePrisma.excelCell,

  // Analysis sessions
  analysis_sessions: basePrisma.analysisSession,
  session_documents: basePrisma.sessionDocument,

  // Action history
  action_history: basePrisma.actionHistory,

  // Memory system
  user_profiles: basePrisma.userProfile,
  user_preferences_memory: basePrisma.userPreference,
  conversation_topics: basePrisma.conversationTopic,
  user_insights: basePrisma.userInsight,
  conversation_summaries: basePrisma.conversationSummary,
  interaction_metadata: basePrisma.interactionMetadata,
  memories: basePrisma.memory,

  // Knowledge system
  methodology_knowledge: basePrisma.methodologyKnowledge,
  domain_knowledge: basePrisma.domainKnowledge,
  concept_relationships: basePrisma.conceptRelationship,
  causal_relationships: basePrisma.causalRelationship,
  comparative_data: basePrisma.comparativeData,
  practical_recommendations: basePrisma.practicalRecommendation,
  trend_patterns: basePrisma.trendPattern,
  knowledge_entries: basePrisma.knowledgeEntry,
  folder_summaries: basePrisma.folderSummary,

  // Presentations
  presentations: basePrisma.presentation,
  slides: basePrisma.slide,
});

// Configure connection pool timeout and retry logic
const connectWithRetry = async (retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, error);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to database after all retries');
        throw error;
      }
    }
  }
};

// Connect with retry on startup
connectWithRetry().catch(console.error);

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
