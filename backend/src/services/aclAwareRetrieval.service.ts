/**
 * ACL-Aware Retrieval Service
 * Integrates access control checks into retrieval pipeline
 * Ensures users only see documents they're authorized to access
 * Prevents information leakage across workspaces and users
 */

import aclService from './acl.service';
import enhancedRetrievalService from './enhancedRetrieval.service';
import multilingualRetrievalService from './multilingualRetrieval.service';

interface ACLAwareRetrievalOptions {
  userId: string;
  workspaceId?: string;
  topK?: number;
  requirePermission?: 'read' | 'write' | 'admin';
  enableMultilingual?: boolean;
  retrievalOptions?: any;
}

interface ACLAwareRetrievalResult {
  documents: any[];
  filteredCount: number;
  securityReport: {
    totalCandidates: number;
    authorized: number;
    unauthorized: number;
    filterRate: number;
  };
}

class ACLAwareRetrievalService {
  /**
   * Retrieve documents with ACL filtering
   *
   * Pipeline:
   * 1. Perform retrieval (enhanced or multilingual)
   * 2. Filter by workspace (if specified)
   * 3. Check ACL for each document
   * 4. Return only authorized documents
   */
  async retrieve(
    query: string,
    options: ACLAwareRetrievalOptions
  ): Promise<ACLAwareRetrievalResult> {
    const {
      userId,
      workspaceId,
      topK = 5,
      requirePermission = 'read',
      enableMultilingual = true,
      retrievalOptions = {}
    } = options;

    console.log('🔐 ACL-Aware Retrieval');
    console.log(`   User: ${userId}`);
    console.log(`   Workspace: ${workspaceId || 'All'}`);
    console.log(`   Required permission: ${requirePermission}`);

    // Step 1: Perform retrieval
    let candidates: any[] = [];

    if (enableMultilingual) {
      console.log('   Using multilingual retrieval...');
      const result = await multilingualRetrievalService.retrieve(query, {
        userId,
        topK: topK * 3, // Get more candidates for ACL filtering
        ...retrievalOptions
      });
      candidates = result.documents;
    } else {
      console.log('   Using enhanced retrieval...');
      candidates = await enhancedRetrievalService.retrieve(query, userId, {
        topK: topK * 3,
        ...retrievalOptions
      });
    }

    const totalCandidates = candidates.length;
    console.log(`   Retrieved ${totalCandidates} candidates`);

    // Step 2: Filter by workspace (if specified)
    if (workspaceId) {
      candidates = candidates.filter(doc => doc.workspaceId === workspaceId);
      console.log(`   After workspace filter: ${candidates.length} documents`);
    }

    // Step 3: Apply ACL filtering
    console.log('   Applying ACL checks...');

    const documentIds = candidates.map(doc => doc.id || doc.documentId).filter(Boolean);

    const authorizedIds = await aclService.filterAccessibleDocuments(
      userId,
      documentIds,
      requirePermission
    );

    const authorizedSet = new Set(authorizedIds);

    const authorizedDocuments = candidates
      .filter(doc => {
        const docId = doc.id || doc.documentId;
        return docId && authorizedSet.has(docId);
      })
      .slice(0, topK);

    // Calculate security metrics
    const unauthorized = totalCandidates - authorizedDocuments.length;
    const filterRate = totalCandidates > 0
      ? (unauthorized / totalCandidates) * 100
      : 0;

    console.log(`   ✅ Authorized: ${authorizedDocuments.length}`);
    console.log(`   ❌ Unauthorized: ${unauthorized}`);
    console.log(`   Filter rate: ${filterRate.toFixed(1)}%`);

    // Log access attempts (for audit)
    for (const doc of authorizedDocuments) {
      await aclService.logAccessAttempt(
        userId,
        doc.id || doc.documentId,
        'read',
        true,
        'Retrieved in search results'
      );
    }

    return {
      documents: authorizedDocuments,
      filteredCount: unauthorized,
      securityReport: {
        totalCandidates,
        authorized: authorizedDocuments.length,
        unauthorized,
        filterRate
      }
    };
  }

  /**
   * Retrieve with workspace isolation
   * Only returns documents from specified workspace
   */
  async retrieveInWorkspace(
    query: string,
    userId: string,
    workspaceId: string,
    topK: number = 5
  ): Promise<ACLAwareRetrievalResult> {
    console.log(`🏢 Workspace-isolated retrieval: ${workspaceId}`);

    // Verify user has workspace access
    const workspaceAccess = await aclService.canAccessDocument(userId, workspaceId, 'read');

    if (!workspaceAccess.allowed) {
      console.log('   ❌ User does not have workspace access');
      return {
        documents: [],
        filteredCount: 0,
        securityReport: {
          totalCandidates: 0,
          authorized: 0,
          unauthorized: 0,
          filterRate: 0
        }
      };
    }

    return await this.retrieve(query, {
      userId,
      workspaceId,
      topK,
      requirePermission: 'read'
    });
  }

  /**
   * Retrieve documents user owns
   */
  async retrieveOwnDocuments(
    query: string,
    userId: string,
    topK: number = 5
  ): Promise<any[]> {
    console.log(`👤 Retrieving user's own documents`);

    const result = await this.retrieve(query, {
      userId,
      topK: topK * 2,
      requirePermission: 'admin' // Only owned documents
    });

    // Further filter to ensure ownership
    const ownedDocuments = result.documents.filter(
      doc => doc.userId === userId || doc.ownerId === userId
    );

    return ownedDocuments.slice(0, topK);
  }

  /**
   * Retrieve with permission level
   * Only returns documents user can write to (for editing)
   */
  async retrieveWritableDocuments(
    query: string,
    userId: string,
    topK: number = 5
  ): Promise<any[]> {
    console.log(`✏️ Retrieving writable documents`);

    const result = await this.retrieve(query, {
      userId,
      topK,
      requirePermission: 'write'
    });

    return result.documents;
  }

  /**
   * Batch ACL check for multiple queries
   * Useful for multi-turn conversations
   */
  async batchRetrieve(
    queries: string[],
    userId: string,
    topKPerQuery: number = 3
  ): Promise<Map<string, any[]>> {
    console.log(`📦 Batch ACL-aware retrieval (${queries.length} queries)`);

    const results = new Map<string, any[]>();

    for (const query of queries) {
      const result = await this.retrieve(query, {
        userId,
        topK: topKPerQuery
      });

      results.set(query, result.documents);
    }

    return results;
  }

  /**
   * Generate security report
   */
  generateSecurityReport(result: ACLAwareRetrievalResult): string {
    const filterStatus =
      result.securityReport.filterRate === 0
        ? '✅ No filtering needed'
        : result.securityReport.filterRate < 20
          ? '✅ Low filtering'
          : result.securityReport.filterRate < 50
            ? '⚠️ Moderate filtering'
            : '❌ High filtering (potential permission issues)';

    return `
═══════════════════════════════════════════════════════
ACL-AWARE RETRIEVAL SECURITY REPORT
═══════════════════════════════════════════════════════
Total Candidates: ${result.securityReport.totalCandidates}
Authorized: ${result.securityReport.authorized}
Unauthorized: ${result.securityReport.unauthorized}
Filter Rate: ${result.securityReport.filterRate.toFixed(1)}%

Status: ${filterStatus}

Returned Documents: ${result.documents.length}
Filtered Out: ${result.filteredCount}
═══════════════════════════════════════════════════════
    `.trim();
  }

  /**
   * Test ACL-aware retrieval
   */
  async testACLRetrieval(
    testUserId: string,
    testWorkspaceId: string
  ): Promise<void> {
    console.log('🧪 Testing ACL-aware retrieval...\n');

    const testCases = [
      {
        name: 'Workspace-scoped retrieval',
        query: 'company strategy',
        options: { userId: testUserId, workspaceId: testWorkspaceId, topK: 5 }
      },
      {
        name: 'Cross-workspace retrieval',
        query: 'company strategy',
        options: { userId: testUserId, topK: 5 } // No workspace filter
      },
      {
        name: 'Writable documents only',
        query: 'company strategy',
        options: { userId: testUserId, topK: 5, requirePermission: 'write' as const }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\nTest: ${testCase.name}`);
      console.log(`Query: "${testCase.query}"`);
      console.log('---');

      try {
        const result = await this.retrieve(testCase.query, testCase.options);

        console.log(this.generateSecurityReport(result));

        console.log('\nTop 3 results:');
        result.documents.slice(0, 3).forEach((doc, i) => {
          console.log(`  ${i + 1}. ${doc.name || 'Untitled'}`);
          console.log(`     Workspace: ${doc.workspaceId || 'None'}`);
          console.log(`     Owner: ${doc.userId || 'Unknown'}`);
        });

        console.log('\n✅ Test completed\n');
        console.log('═══════════════════════════════════════════════════════\n');
      } catch (error) {
        console.error('❌ Test failed:', error);
      }
    }
  }
}

export default new ACLAwareRetrievalService();
export { ACLAwareRetrievalService, ACLAwareRetrievalResult, ACLAwareRetrievalOptions };
