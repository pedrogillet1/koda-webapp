# KODA FORMAT ENFORCEMENT - COMPREHENSIVE IMPLEMENTATION GUIDE

## Executive Summary

This guide documents the **3-Layer Format Enforcement System** implemented to ensure 100% compliance with Koda's response formatting rules. The system works by:

1. **Layer 1**: Enhanced system prompts with explicit templates and mandatory rules
2. **Layer 2**: Structure enforcement (title, sections, source, follow-up)
3. **Layer 3**: Format enforcement (bullets, bolding, spacing, tables)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Architecture](#2-solution-architecture)
3. [Implementation Details](#3-implementation-details)
4. [File Locations & Code References](#4-file-locations--code-references)
5. [Format Rules Enforced](#5-format-rules-enforced)
6. [Testing & Verification](#6-testing--verification)
7. [Troubleshooting](#7-troubleshooting)
8. [Maintenance Guide](#8-maintenance-guide)

---

## 1. Problem Statement

### Before Implementation

Koda responses were failing format compliance with a score of **48.8% (Grade F)**:

| Issue | Compliance |
|-------|-----------|
| Missing `## Title` headers | 0% |
| Missing `### Section` headers | 0% |
| Using `-` instead of `•` bullets | 0% |
| Missing `### Source` section | 0% |
| Missing follow-up questions | 0% |
| No auto-bolded numbers | Low |

### Root Cause

1. System prompts were not explicit enough about format requirements
2. `FormatEnforcementService` existed but was **never called** in the RAG pipeline
3. No post-processing to fix LLM format violations

---

## 2. Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3-LAYER ENFORCEMENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: SYSTEM PROMPT (Prevention)                                 │   │
│  │ Location: systemPrompts.service.ts                                  │   │
│  │ Purpose: Tell LLM exactly what format to use                        │   │
│  │ Contains: Explicit template, examples, warnings                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: STRUCTURE ENFORCEMENT (Post-Processing)                    │   │
│  │ Location: structureEnforcement.service.ts                           │   │
│  │ Purpose: Add missing structure elements                             │   │
│  │ Fixes: Title, sections, source, follow-up                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 3: FORMAT ENFORCEMENT (Post-Processing)                       │   │
│  │ Location: formatEnforcement.service.ts                              │   │
│  │ Purpose: Fix micro-formatting issues                                │   │
│  │ Fixes: Bullets, bolding, spacing, citations, emojis                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│                           FINAL RESPONSE                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Details

### 3.1 Layer 1: System Prompt Enhancement

**File**: `src/services/systemPrompts.service.ts`

**Changes Made**:
- Added explicit `KODA FORMAT RULES (MANDATORY)` section
- Included exact template with placeholders
- Added DO/DON'T examples
- Warned about violations being automatically fixed

**Key Code Section** (around line 127):

```typescript
**KODA FORMAT RULES (MANDATORY - ZERO TOLERANCE FOR VIOLATIONS):**

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: YOU MUST USE THIS EXACT TEMPLATE FOR EVERY RESPONSE
═══════════════════════════════════════════════════════════════════════════════

## [2-4 Word Title]

[1-2 sentence intro - max 60 words]

### [Section Name 1]

• **[Key point]**: [Details with **bolded** numbers]
• **[Key point]**: [Additional details]

### [Section Name 2]

• **[Data point]**: **$X,XXX** or **XX%**
• **[Data point]**: More information

### Source

• **[DocumentName.xlsx]** (Page X)

[Follow-up question ending with ?]
```

### 3.2 Layer 2: Structure Enforcement Service

**File**: `src/services/structureEnforcement.service.ts`

**Purpose**: Add missing structural elements to responses

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `enforceStructure()` | Main entry point - orchestrates all checks |
| `checkTitle()` / `addTitle()` | Ensures `## Title` exists |
| `checkSections()` / `addSections()` | Ensures 2-5 `### Section` headers |
| `checkSource()` / `addSourceSection()` | Adds `### Source` with document references |
| `checkFollowUp()` / `addFollowUp()` | Adds context-aware follow-up question |
| `cleanSpacing()` | Removes excess newlines |

**Configuration Options**:

```typescript
interface StructureEnforcementConfig {
  forceTitle: boolean;      // default: true
  forceSections: boolean;   // default: true
  forceSource: boolean;     // default: true
  forceFollowUp: boolean;   // default: true
  maxIntroWords: number;    // default: 60
  enableLogging: boolean;   // default: true
}
```

### 3.3 Layer 3: Format Enforcement Service

**File**: `src/services/formatEnforcement.service.ts` (pre-existing, 1485 lines)

**Purpose**: Fix micro-formatting issues

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `enforceFormat()` | Main entry point |
| `normalizeBullets()` | Convert `-`, `*`, `→` to `•` |
| `autoBoldNumbers()` | Bold numbers, currencies, percentages |
| `autoBoldDates()` | Bold years, quarters, months |
| `autoBoldFilenames()` | Bold `.xlsx`, `.pdf`, `.csv` files |
| `removeEmojis()` | Strip all emojis |
| `removeCitations()` | Remove `[1]`, `[Source]` citations |
| `cleanSpacing()` | Fix excessive whitespace |
| `formatTables()` | Ensure proper table alignment |

### 3.4 RAG Service Integration

**File**: `src/services/rag.service.ts`

**Location**: After line ~7448 (after citation removal, before source extraction)

**Added Code**:

```typescript
// ============================================================================
// FORMAT ENFORCEMENT - Ensure 100% compliance with Koda format rules
// ============================================================================
perfTimer.mark('formatEnforcement');
console.log(`🎨 [FORMAT] Enforcing structure and formatting...`);

// Step 1: Structure Enforcement (title, sections, source, follow-up)
const structureResult = structureEnforcementService.enforceStructure(fullResponse, {
  query,
  sources: useFullDocuments && fullDocuments.length > 0
    ? fullDocuments.map(doc => ({ documentName: doc.filename, pageNumber: null }))
    : rerankedChunks.map(chunk => ({
        documentName: chunk.metadata?.filename || 'Unknown',
        pageNumber: chunk.metadata?.page || null
      })),
  isComparison: isComparisonQuery
});

fullResponse = structureResult.text;

if (structureResult.violations.length > 0) {
  console.log(`📋 [FORMAT] Structure violations fixed: ${structureResult.violations.map(v => v.type).join(', ')}`);
}

// Step 2: Format Enforcement (bullets, bolding, spacing, etc.)
const formatResult = formatEnforcementService.enforceFormat(fullResponse, {
  autoBoldNumbers: true,
  autoBoldDates: true,
  autoBoldFilenames: true,
  normalizeBullets: true,
  removeEmojis: true,
  cleanSpacing: true
});

fullResponse = formatResult.text;

console.log(`✅ [FORMAT] Enforcement complete - Stats: Title=${structureResult.stats.hasTitle}, Sections=${structureResult.stats.sectionCount}, Source=${structureResult.stats.hasSource}, FollowUp=${structureResult.stats.hasFollowUp}`);
perfTimer.measure('formatEnforcement');
```

---

## 4. File Locations & Code References

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/services/systemPrompts.service.ts` | Layer 1 - System prompts | ~127-200 |
| `src/services/structureEnforcement.service.ts` | Layer 2 - Structure fixes | **NEW FILE** |
| `src/services/formatEnforcement.service.ts` | Layer 3 - Format fixes | Entire file |
| `src/services/rag.service.ts` | Integration point | ~7448-7495 |

### Import Statements Added to rag.service.ts

```typescript
import { formatEnforcementService } from './formatEnforcement.service';
import { structureEnforcementService } from './structureEnforcement.service';
```

---

## 5. Format Rules Enforced

### Structure Rules (Layer 2)

| Rule | Description | Auto-Fixed |
|------|-------------|------------|
| TITLE_1 | Response must start with `## Title` | Yes |
| TITLE_2 | Title must be 2-4 words | Yes |
| SECTIONS_1 | Must have 2-5 `### Section` headers | Yes |
| SOURCE_1 | Must include `### Source` when docs used | Yes |
| FOLLOWUP_1 | Must end with follow-up question (`?`) | Yes |
| INTRO_1 | Max 2 lines / 60 words before first section | Logged |

### Format Rules (Layer 3)

| Rule | Description | Auto-Fixed |
|------|-------------|------------|
| BULLET_1 | Use `•` only (not `-`, `*`, `→`) | Yes |
| BULLET_2 | Max 7 bullets per section | Logged |
| BOLD_1 | Auto-bold numbers (`**$1,234**`) | Yes |
| BOLD_2 | Auto-bold dates (`**2024**`, `**Q3**`) | Yes |
| BOLD_3 | Auto-bold filenames (`**Report.xlsx**`) | Yes |
| EMOJI_1 | No emojis allowed | Yes |
| SPACING_1 | Single blank line between sections | Yes |
| TABLE_1 | Use tables for comparisons | Logged |

---

## 6. Testing & Verification

### Manual Testing

1. Start the server:
   ```bash
   cd koda-webapp/backend
   npm run dev
   ```

2. Login to the web app at `http://localhost:3000`

3. Test with these queries:
   - "What is the total revenue for Lone Mountain Ranch?"
   - "Compare Food Revenue vs Beverage Revenue"
   - "What properties are in the Rosewood Fund?"

4. Verify responses have:
   - `## Title` at the top
   - 2-5 `### Section` headers
   - `•` bullets (not `-`)
   - **Bolded** numbers and dates
   - `### Source` section with document names
   - Follow-up question at the end

### Automated Testing

Use the verification script:

```bash
cd koda-webapp/backend
npx ts-node --transpile-only format-verification.ts
```

This will:
- Login as test user
- Send 5 test queries
- Validate against all 16 format rules
- Generate compliance report

### Expected Results After Implementation

| Category | Before | After |
|----------|--------|-------|
| Title | 0% | 100% |
| Sections | 0% | 100% |
| Bullets | 0% | 100% |
| Source | 0% | 100% |
| Follow-up | 0% | 100% |
| **Overall** | **48.8%** | **90%+** |

---

## 7. Troubleshooting

### Common Issues

#### Issue: Responses still missing structure

**Cause**: Format enforcement not running

**Solution**:
1. Check server logs for `🎨 [FORMAT]` messages
2. Verify imports in `rag.service.ts`
3. Check for errors in console

#### Issue: Bullets still using `-`

**Cause**: `normalizeBullets` not enabled

**Solution**:
```typescript
formatEnforcementService.enforceFormat(text, {
  normalizeBullets: true  // Ensure this is true
});
```

#### Issue: Source section not appearing

**Cause**: No documents detected

**Solution**:
1. Check `context.sources` array is populated
2. Verify chunk metadata has `filename` field

#### Issue: Follow-up questions generic

**Cause**: Query not matching patterns

**Solution**:
- Add more patterns to `generateFollowUp()` in `structureEnforcement.service.ts`

### Debug Logging

Enable detailed logging:

```typescript
const structureService = new StructureEnforcementService({
  enableLogging: true
});
```

Look for these log messages:
- `📝 [STRUCTURE] Added missing title`
- `📂 [STRUCTURE] Added sections`
- `📚 [STRUCTURE] Added source section`
- `❓ [STRUCTURE] Added follow-up question`

---

## 8. Maintenance Guide

### Adding New Format Rules

1. **For Structure Rules**: Edit `structureEnforcement.service.ts`
   - Add new `check*()` function
   - Add corresponding `add*()` function
   - Call in `enforceStructure()` method

2. **For Format Rules**: Edit `formatEnforcement.service.ts`
   - Add new transformation function
   - Add to `enforceFormat()` pipeline

3. **For System Prompt**: Edit `systemPrompts.service.ts`
   - Update the format rules section
   - Add examples

### Updating Follow-up Questions

Edit `generateFollowUp()` in `structureEnforcement.service.ts`:

```typescript
private generateFollowUp(query: string): string {
  const queryLower = query.toLowerCase();

  // Add new patterns here
  if (queryLower.includes('your_keyword')) {
    return 'Your context-specific follow-up question?';
  }

  // ...existing patterns...
}
```

### Performance Considerations

The format enforcement adds ~10-50ms to response time. If needed:

1. Disable specific rules:
   ```typescript
   structureEnforcementService.enforceStructure(text, {
     forceFollowUp: false  // Skip if not needed
   });
   ```

2. Skip for short responses:
   ```typescript
   if (fullResponse.length < 100) {
     // Skip enforcement for very short responses
   }
   ```

---

## Appendix A: Complete File Structure

```
koda-webapp/backend/src/services/
├── rag.service.ts                    # Main RAG pipeline (integration point)
├── systemPrompts.service.ts          # Layer 1 - System prompts
├── structureEnforcement.service.ts   # Layer 2 - Structure enforcement (NEW)
└── formatEnforcement.service.ts      # Layer 3 - Format enforcement (existing)
```

## Appendix B: Expected Response Format

```markdown
## Revenue Analysis

Total revenue for Lone Mountain Ranch shows strong performance across all departments.

### Key Metrics

• **Total Revenue**: **$24,972,043.79** for the year
• **Room Revenue**: **$3,741,462.88** (15% of total)
• **Food Revenue**: **$5,786,758.16** (23% of total)

### Performance Highlights

• **Peak Month**: July with **$3,865,691.29**
• **Low Month**: November with **$253,946.98**
• **Growth Rate**: **12.5%** year-over-year

### Source

• **Budget 2024.xlsx** (Sheet: Profit and Loss)

Would you like to see the breakdown by department or compare to previous years?
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-04 | Initial implementation |

---

*Generated by Format Enforcement Implementation Team*
