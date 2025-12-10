# Koda Skill System Documentation

## Overview

The Koda Skill System is a modular architecture for routing queries to specialized skills with optimized RAG (Retrieval-Augmented Generation) configurations. It replaces the previous monolithic intent detection with a structured, testable, and extensible system.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              skillSystemIntegration.service.ts                  │
│                    (Entry Point)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┴──────────────────┐
           ▼                                     ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│ skillAndIntentRouter    │       │   speedProfileManager       │
│   - Rule-based match    │       │   - RAG pipeline config     │
│   - LLM fallback        │       │   - Skill-specific overrides│
└─────────────────────────┘       └─────────────────────────────┘
           │                                     │
           ▼                                     ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│ kodaSkillTaxonomy       │       │   RAGPipelineConfig         │
│ Extended                │       │   - useBM25, usePinecone    │
│   - 16 skills           │       │   - topK, reranking         │
│   - Patterns & configs  │       │   - temperature, tokens     │
└─────────────────────────┘       └─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SkillMapping                                │
│  { skillId, domain, mode, complexity, speedProfile, ... }      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. kodaPersonaConfig.ts
**Location:** `backend/src/config/kodaPersonaConfig.ts`

Defines Koda's identity, tone, and behavior:
- System prompt template
- Identity normalization rules (replaces "ChatGPT" → "Koda")
- No-document behavior configuration

```typescript
import { getKodaSystemPrompt, getIdentityNormalizationRules } from '../config/kodaPersonaConfig';
```

### 2. kodaSkillTaxonomyExtended.ts
**Location:** `backend/src/services/kodaSkillTaxonomyExtended.ts`

Skill registry with 16 skills across 3 domains:

| Domain | Skills |
|--------|--------|
| **GENERAL** | LIST_DOCUMENTS, SUMMARIZE_DOCUMENT, EXPLAIN_SECTION, FIND_WHERE_IT_SAYS_X |
| **LEGAL** | EXPLAIN_CLAUSE, SCAN_FOR_RISKS, CHECK_COMPLETENESS, CHECK_LGPD_COMPLIANCE |
| **FINANCIAL** | CHECK_CALCULATIONS, SCENARIO_ANALYSIS, EXPLAIN_MODEL, CHECK_SANITY_NUMBERS |
| **META** | GREETING, HELP, UNKNOWN |

Each skill has:
- Regex patterns for detection
- Speed profile (ULTRA_FAST, FAST, NORMAL, DEEP)
- Default complexity
- Output format rules

### 3. skillAndIntentRouter.service.ts
**Location:** `backend/src/services/skillAndIntentRouter.service.ts`

Routes queries to skills using:
1. **Rule-based classification** (fast, 0ms) - regex pattern matching
2. **LLM fallback** (100-200ms) - Gemini Flash for ambiguous queries

```typescript
import { skillAndIntentRouter, type SkillMapping } from './skillAndIntentRouter.service';

const context: RouterContext = { query, userDocumentCount };
const skillMapping = await skillAndIntentRouter.routeQueryToSkill(context, genAI);
```

### 4. speedProfileManager.service.ts
**Location:** `backend/src/services/speedProfileManager.service.ts`

Returns RAG pipeline configurations based on speed profile:

| Profile | RAG Features |
|---------|--------------|
| **ULTRA_FAST** | No RAG, no reranking, minimal tokens |
| **FAST** | BM25 only, topK=5, no reranking |
| **NORMAL** | Hybrid (BM25 + Pinecone), reranking |
| **DEEP** | Full analysis, numeric extraction, scenarios |

```typescript
const config = speedProfileManager.getRAGPipelineConfig(SpeedProfile.NORMAL);
```

### 5. answerPostProcessor.service.ts
**Location:** `backend/src/services/answerPostProcessor.service.ts`

Post-processing for generated answers:
- Remove duplicate paragraphs
- Clean empty bullets
- Normalize identity (remove "I'm an AI" mentions)
- Basic markdown sanity fixes
- Richness check for DEEP skills

### 6. skillSystemIntegration.service.ts
**Location:** `backend/src/services/skillSystemIntegration.service.ts`

Bridge between skill system and existing RAG modes:
- Maps SpeedProfile → RAGMode
- Provides utility functions
- Entry point for integration

## Usage in rag.service.ts

The skill system is integrated at the beginning of `generateAnswerStream`:

```typescript
// STEP -1.8: SKILL-BASED ROUTING
let skillRoutingResult: SkillIntegrationResult | null = null;
try {
  const userDocCount = await prisma.document.count({ where: { userId } });

  skillRoutingResult = await integrateSkillRouting(
    query,
    userId,
    userDocCount,
    conversationHistory
  );

  console.log(`[SKILL ROUTING] ${skillRoutingResult.skillMapping.skillId}`);
  console.log(`Mode: ${skillRoutingResult.ragMode} | Bypass: ${skillRoutingResult.shouldBypassRAG}`);
} catch (error) {
  console.error('[SKILL ROUTING] Error, falling back to existing logic:', error);
}
```

## Speed Profile to RAG Mode Mapping

| SpeedProfile | RAGMode |
|--------------|---------|
| ULTRA_FAST | ULTRA_FAST_META |
| FAST | FAST_FACT_RAG |
| NORMAL | NORMAL_RAG |
| DEEP | DEEP_ANALYSIS |

## Testing

Run the test suite:

```bash
cd backend
npx ts-node --transpile-only src/tests/test_skill_system.ts
```

The test suite covers:
- Koda persona config
- Skill routing (all 14 skills)
- Complexity adjustment
- Speed profile configurations
- Answer post-processing

## Adding a New Skill

1. Add skill config to `EXTENDED_SKILL_REGISTRY` in `kodaSkillTaxonomyExtended.ts`:

```typescript
'DOMAIN.NEW_SKILL': {
  skillId: 'DOMAIN.NEW_SKILL',
  skillName: 'My New Skill',
  domain: SkillDomain.GENERAL,
  mode: SkillMode.DOC_ANALYSIS,
  depthDefault: SkillComplexity.NORMAL,
  speedProfile: SpeedProfile.NORMAL,
  outputFormat: OutputFormat.EXPLANATION,

  patterns: [
    /\b(pattern1|pattern2)\b.*\b(keyword)\b/i,
  ],
  examples: [
    'Example query 1',
    'Example query 2',
  ],

  retrievalStrategy: 'hybrid',
  requiresMultiDoc: false,
  requiresCalculation: false,
  topKDefault: 15,

  defaultSections: ['Section 1', 'Section 2'],
  useBullets: true,
  useHeadings: true,
  highlightRules: ['important terms'],
  tokenBudget: TokenBudget.MEDIUM,

  promptTemplateId: 'new_skill_template',
},
```

2. Add test case to `test_skill_system.ts`
3. Run tests to verify

## File Summary

| File | Purpose |
|------|---------|
| `kodaPersonaConfig.ts` | Koda's identity and behavior |
| `kodaSkillTaxonomyExtended.ts` | Skill registry (16 skills) |
| `skillAndIntentRouter.service.ts` | Query → Skill routing |
| `speedProfileManager.service.ts` | Speed → RAG config |
| `answerPostProcessor.service.ts` | Answer cleanup |
| `skillAwareContext.service.ts` | Prompt building |
| `skillAwareAnswerGeneration.service.ts` | LLM generation |
| `skillSystemIntegration.service.ts` | Bridge to existing system |
| `test_skill_system.ts` | Test suite (29 tests) |
