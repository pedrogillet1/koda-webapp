# Robotic Response Detection Report

**Generated:** 2025-12-03T15:59:42.785Z

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 32 |
| MEDIUM | 7 |
| LOW | 2 |
| **TOTAL** | **41** |

## Findings by Category

### Robotic Citation (3 found)

- **services\adaptiveAnswerGeneration.service.ts:429**
  `'According to the document',`

- **services\adaptiveAnswerGeneration.service.ts:430**
  `'Based on the file',`

- **services\adaptiveAnswerGeneration.service.ts:432**
  `'The document states',`

### Hardcoded Pagination (2 found)

- **services\chat.service.ts:1363**
  `message += '\n_Showing first 50 files. Narrow your search by specifying a file type or folder._';`

- **services\fileActions.service.ts:2064**
  `response += `\n*Showing first 100 files. Use filters to narrow results.*`;`

### Hardcoded Greeting (29 found)

- **services\contextEngineering.service.ts:79**
  `"Hi! What would you like to know about your documents?",`

- **services\contextEngineering.service.ts:80**
  `"Hello! How can I help you with your files today?",`

- **services\contextEngineering.service.ts:82**
  `"Hi! I'm ready to help you analyze your documents.",`

- **services\contextEngineering.service.ts:83**
  `"Hello! What questions do you have about your files?",`

- **services\contextEngineering.service.ts:86**
  `"Hi! Upload a document and I'll help you understand it.",`

  _... and 24 more_

### Template File Listing (1 found)

- **services\crossDocumentSynthesis.service.ts:666**
  `return `You have **${totalDocuments}** documents in your library. While I couldn't identify specific methodologies, I ca...`

### Generic Help Phrase (2 found)

- **services\dynamicResponseSystem.service.ts:94**
  `- "Hello! How can I help you today?" (too generic)`

- **services\languageDetection.service.ts:146**
  `en: 'Hello! I\'m KODA, your intelligent document assistant. How can I help you today?',`

### Generic Error (1 found)

- **services\dynamicResponseSystem.service.ts:219**
  `- NO generic "Something went wrong" messages`

### Formal Labels (3 found)

- **services\rag.service.ts:3940**
  `const nextStep = lang === 'pt' ? '\n\n**Próximo passo:**' : lang === 'es' ? '\n\n**Próximo paso:**' : lang === 'fr' ? '\...`

- **services\responsePostProcessor.service.ts:75**
  `// ✅ Match "Next steps:", "Next actions:", "Next step:", etc.`

- **services\responsePostProcessor.service.ts:86**
  `// Keep one blank line before "Next step:" for proper spacing`

## Recommendations

### HIGH PRIORITY (32 issues)

1. **Replace hardcoded greetings** with `dynamicResponseSystem.generateDynamicGreeting()`
2. **Replace hardcoded capabilities** with `dynamicResponseSystem.generateDynamicCapabilities()`
3. **Remove robotic citation phrases** - state facts directly

### MEDIUM PRIORITY (7 issues)

1. **Remove formal labels** (Next step:, Tip:, etc.)
2. **Replace generic error messages** with context-aware errors
3. **Make file/folder listings conversational**

### LOW PRIORITY (2 issues)

1. **Make pagination messages conversational**
2. **Vary response structures** to prevent repetition

