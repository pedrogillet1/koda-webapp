# QA Gate Integration - Manual Step

Due to file encoding issues, the QA gate needs to be manually added to `rag.service.ts`.

## Location
File: `backend/src/services/rag.service.ts`
Line: After line 9073 (right after the `generateStreamingWithCache` call completes)

## Code to Insert

Add the following code block after line 9073:

```typescript
    // ============================================================
    // QUALITY ASSURANCE GATE
    // ============================================================
    console.log('[QA-GATE] Running quality assurance checks...');
    const qaStartTime = Date.now();

    try {
      const qaResult = await runQualityAssurance(
        fullAnswer,
        sortedChunks.slice(0, 5), // Top 5 chunks used for context
        userMessage,
        {
          enableGrounding: true,
          enableCitations: true,
          enableCompleteness: true,
          enableFormatting: true,
          strictMode: false
        }
      );

      console.log('[QA-GATE] Quality scores:', {
        overall: qaResult.score.overall.toFixed(2),
        grounding: qaResult.score.grounding.toFixed(2),
        citations: qaResult.score.citations.toFixed(2),
        completeness: qaResult.score.completeness.toFixed(2),
        formatting: qaResult.score.formatting.toFixed(2)
      });

      if (qaResult.issues.length > 0) {
        console.log('[QA-GATE] Issues detected:', qaResult.issues);
      }

      // Handle QA result
      if (qaResult.action === 'fail') {
        console.log('[QA-GATE] FAILED - Critical quality issues');
        fullAnswer = "Desculpe, não consegui gerar uma resposta confiável com base nos documentos disponíveis. Por favor, reformule sua pergunta ou forneça mais contexto.";
      } else if (qaResult.action === 'regenerate') {
        console.log('[QA-GATE] REGENERATE - Quality below threshold');
        // For now, we'll pass through with a warning
        // In future, implement regeneration logic here
        console.warn('[QA-GATE] Regeneration not yet implemented, passing through with warning');
      } else {
        console.log('[QA-GATE] PASSED - Quality checks successful');
      }

      console.log(`[QA-GATE] Completed in ${Date.now() - qaStartTime}ms`);

    } catch (qaError) {
      console.error('[QA-GATE] Error during quality assurance:', qaError);
      // On error, pass through (don't block user)
    }

    // ============================================================
    // END QUALITY ASSURANCE GATE
    // ============================================================
```

## Context
This code should be inserted between:
- Line 9073: `});` (end of generateStreamingWithCache call)
- Line 9075: `// 🔧 FIX: Apply table cell fix...`

## What This Does
1. Runs quality assurance checks on the generated answer
2. Checks grounding, citations, completeness, and formatting
3. Logs quality scores for monitoring
4. Replaces answer with fallback if quality is too low
5. Passes through with warning if regeneration is needed

## Verification
After adding, look for these log messages when testing:
- `[QA-GATE] Running quality assurance checks...`
- `[QA-GATE] Quality scores: {...}`
- `[QA-GATE] PASSED - Quality checks successful`
