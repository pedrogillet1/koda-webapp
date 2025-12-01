import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

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
