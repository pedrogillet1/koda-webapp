const fs = require('fs');
const path = 'src/services/core/kodaIntentEngineV2.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Find and replace the detectDomain method
const oldPattern = /private detectDomain\(query: string\): QueryDomain \{[\s\S]*?\/\/ Default\s*\n\s*return 'doc_content';\s*\n\s*\}/;

const newCode = `private detectDomain(query: string): QueryDomain {
    const lowerQuery = query.toLowerCase();

    // If query mentions specific document/file, it's doc_content (takes priority)
    if (/no arquivo|in the file|in file|no documento|from the document/i.test(query)) {
      return 'doc_content';
    }

    // Category 14: META_AI (check early)
    if (this.hasKeywords(query, META_AI_KEYWORDS)) {
      return 'meta_ai';
    }

    // Category 13: CHITCHAT
    if (this.hasKeywords(query, CHITCHAT_KEYWORDS)) {
      return 'chitchat';
    }

    // Category 2: DOC_ANALYTICS - only for actual analytics about document collection
    const analyticsPatterns = [
      /quantos (documentos|arquivos|pdfs)/i,
      /how many (documents|files|pdfs)/i,
      /cuántos (documentos|archivos)/i,
      /liste (meus |os |todos )?(documentos|arquivos)/i,
      /list (my |all |the )?(documents|files)/i,
      /meus documentos/i,
      /my documents/i,
    ];
    if (analyticsPatterns.some(p => p.test(lowerQuery))) {
      return 'analytics';
    }

    // Category 1: DOC_QA (default)
    return 'doc_content';
  }`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(path, content);
  console.log('File updated successfully');
} else {
  console.log('Pattern not found - checking current content...');
  // Show what we have
  const match = content.match(/private detectDomain[\s\S]{0,500}/);
  console.log(match ? match[0] : 'Method not found');
}
