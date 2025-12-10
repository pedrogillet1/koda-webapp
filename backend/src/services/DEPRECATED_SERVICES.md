# Deprecated Services - Migration Guide

**Created:** 2024-12-10
**Status:** Services marked for deprecation after full 4-layer pipeline migration

## Overview

The new 4-layer answer pipeline (`/koda-4-layer-pipeline/`) replaces multiple older formatting services. These services should be migrated away from and eventually removed.

## Services to Deprecate

### High Priority (Replaced by 4-Layer Pipeline)

| Old Service | Replaced By | Notes |
|-------------|-------------|-------|
| `masterAnswerFormatter.service.ts` | Layer 2: `masterAnswerFormatter.ts` | UTF-8 fixes, bolding, doc names |
| `kodaOutputStructureEngine.service.ts` | Layer 1: `kodaOutputStructureEngine.ts` | Structure shaping |
| `kodaAnswerValidationEngine.service.ts` | Layer 3: `kodaAnswerValidationEngine.ts` | Quality validation |
| `kodaUnifiedPostProcessor.service.ts` | Layer 4: `kodaUnifiedPostProcessor.ts` | Artifact cleanup |
| `formatValidation.service.ts` | Layer 3: Validation | Format validation |
| `smartBoldingEnhanced.service.ts` | Layer 2: `applyConsistentBolding()` | Smart bolding |
| `structureEnforcement.service.ts` | Layer 1: Structure | Structure enforcement |

### Medium Priority (Partially Replaced)

| Old Service | Notes |
|-------------|-------|
| `answerFormatter.service.ts` | Used in ragOrchestrator - has unique {{DOC:::}} markers |
| `kodaCitationFormat.service.ts` | Citation handling - may need integration |
| `kodaFormatEngine.service.ts` | General formatting |

## Current Usage

### rag.service.ts (Original)
- Uses: masterAnswerFormatter, kodaOutputStructureEngine, kodaAnswerValidationEngine, kodaUnifiedPostProcessor
- Status: Still in production, needs migration

### ragOrchestrator.service.ts (New)
- Uses: 4-layer pipeline via `applyAnswerPipeline()`
- Also uses: answerFormatter.service.ts for {{DOC:::}} markers
- Status: Partially migrated

## Migration Steps

1. **Phase 1 (Current)**: 4-layer pipeline installed and integrated in ragOrchestrator
2. **Phase 2**: Migrate rag.service.ts to use 4-layer pipeline
3. **Phase 3**: Consolidate document marker handling
4. **Phase 4**: Remove deprecated services

## How to Migrate

### Before (using old services):
```typescript
import { formatAnswer } from './masterAnswerFormatter.service';
import { kodaOutputStructureEngine } from './kodaOutputStructureEngine.service';
import { kodaAnswerValidationEngine } from './kodaAnswerValidationEngine.service';
import { kodaUnifiedPostProcessor } from './kodaUnifiedPostProcessor.service';

// Multiple calls
const structured = kodaOutputStructureEngine.formatAnswer(text, options);
const formatted = formatAnswer(structured, options);
const validated = await kodaAnswerValidationEngine.validateAnswer(formatted, options);
const final = kodaUnifiedPostProcessor.process(validated);
```

### After (using 4-layer pipeline):
```typescript
import { kodaAnswerPipeline } from '../koda-4-layer-pipeline';

// Single call
const result = await kodaAnswerPipeline.processAnswer({
  rawAnswer: llmResponse,
  query: userQuery,
  primaryIntent: 'single_doc_factual',
  answerMode: 'direct_short',
  language: 'pt',
  sources: documentSources,
});

return result.finalAnswer;
```

## DO NOT REMOVE YET

These services are still imported by:
- `rag.service.ts` - Main RAG processing
- `masterAnswerFormatter.service.ts` - Cross-imports

Wait until Phase 2 migration is complete before removing.
