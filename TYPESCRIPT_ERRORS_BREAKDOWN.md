# TypeScript Compilation Errors - Complete Breakdown

**Generated:** December 1, 2025
**Total Errors:** ~300+ across 50+ files
**Blocking Deployment:** YES

---

## Error Categories

### 1. **Prisma Model Naming Issues** (Highest Priority - ~150 errors)

**Problem:** Code uses **snake_case** Prisma model names, but Prisma Client expects **camelCase**

#### Examples:
- `prisma.users` → should be `prisma.user`
- `prisma.documents` → should be `prisma.document`
- `prisma.folders` → should be `prisma.folder`
- `prisma.messages` → should be `prisma.message`
- `prisma.conversations` → should be `prisma.conversation`
- `document_metadata` → should be `documentMetadata`
- `two_factor_auth` → should be `twoFactorAuth`
- `verification_codes` → should be `verificationCode`
- `action_history` → should be `actionHistory`
- `pending_users` → should be `pendingUser`

#### Affected Files:
```
src/controllers/auth.controller.ts
src/controllers/batch.controller.ts
src/controllers/chat.controller.ts
src/controllers/document.controller.ts
src/controllers/presigned-url.controller.ts
src/controllers/rag.controller.ts
src/services/auth.service.ts
src/services/chat.service.ts
src/services/chatActions.service.ts
src/services/advancedSearch.service.ts
src/services/terminology.service.ts
src/utils/rag.utils.ts
src/tests/setup-test-user.ts
... ~30 more files
```

#### Error Examples:
```typescript
// ❌ WRONG
await prisma.documents.findMany()
await prisma.users.create()
include: { document_metadata: true }

// ✅ CORRECT
await prisma.document.findMany()
await prisma.user.create()
include: { documentMetadata: true }
```

**Root Cause:** Prisma schema likely uses `@@map()` to map camelCase model names to snake_case database tables, but the code was written using the database table names instead of the Prisma model names.

---

### 2. **TypeScript Configuration Issues** (~50 errors)

**Problem:** Missing compiler options causing iterator and top-level await errors

#### Errors:
- `can only be iterated through when using '--downlevelIteration'`
- `Top-level 'await' expressions are only allowed when module option is 'es2022', 'esnext'...`

#### Example Errors:
```typescript
src/services/terminology.service.ts(534,30):
  Type 'Map<string, {...}>' can only be iterated through when using
  '--downlevelIteration' flag

src/services/chat.service.DOCUMENT_GENERATION_PATCH.ts(16,19):
  Top-level 'await' expressions are only allowed when 'module'
  option is set to 'es2022', 'esnext'
```

#### Files with Iterator Errors:
```
src/services/terminology.service.ts
src/services/terminologyIntelligence.service.ts
src/services/trendAnalysis.service.ts
src/utils/rag.utils.ts
src/utils/terminology-integration.ts
```

#### Fix Required in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "downlevelIteration": true,
    "lib": ["ES2020"]
  }
}
```

---

### 3. **Express Response Type Issues** (~15 errors)

**Problem:** `res.flush()` doesn't exist on Express Response type

#### Error Example:
```typescript
src/controllers/rag.controller.ts(2143,15):
  Property 'flush' does not exist on type
  'Response<any, Record<string, any>>'
```

#### Affected Files:
```
src/controllers/rag.controller.ts (multiple locations)
```

#### Fix:
```typescript
// Cast to any or define custom type
(res as any).flush?.();

// OR add type declaration
declare module 'express' {
  export interface Response {
    flush?: () => void;
  }
}
```

---

### 4. **Missing Properties on Types** (~30 errors)

**Problem:** Code references properties that don't exist on types

#### Examples:

##### A. User Type Missing `id` Property:
```typescript
src/controllers/rag.controller.ts(60,30):
  Property 'id' does not exist on type 'User'
```

##### B. RAG Service Missing `getContext` Method:
```typescript
src/controllers/rag.controller.ts(1286,38):
  Property 'getContext' does not exist on ragService type
```

##### C. Unknown Type Issues:
```typescript
src/controllers/rag.controller.ts(2357,79):
  Property 'documentName' does not exist on type 'unknown'
```

#### Affected Files:
```
src/controllers/rag.controller.ts
src/services/actionHistory.service.ts
src/queues/document.queue.ts
```

---

### 5. **Function Signature Mismatches** (~10 errors)

**Problem:** Functions called with wrong number of arguments

#### Examples:
```typescript
src/controllers/rag.controller.ts(449,72):
  Expected 1 arguments, but got 2

src/queues/document.queue.ts(32,77):
  Expected 2-3 arguments, but got 4
```

---

### 6. **Metadata Property Naming** (~20 errors)

**Problem:** Inconsistent use of `metadata` vs `document_metadata`

#### Error Examples:
```typescript
// Code uses: document_metadata
// Type expects: metadata

src/services/bm25-retrieval.service.ts(102,43):
  Property 'document_metadata' does not exist on type
  '{ content?: string; metadata?: any; score?: number; }'

src/controllers/session.controller.ts(149,7):
  Type '{ document_metadata: {}; }[]' is not assignable to
  type '{ metadata: any; }[]'
```

#### Affected Files:
```
src/services/bm25-retrieval.service.ts
src/services/advancedSearch.service.ts
src/controllers/session.controller.ts
src/queues/document.queue.ts
```

---

### 7. **Malformed Patch File** (~25 errors)

**Problem:** `chat.service.DOCUMENT_GENERATION_PATCH.ts` has top-level code outside functions

#### File:
```
src/services/chat.service.DOCUMENT_GENERATION_PATCH.ts
```

#### Errors:
- Top-level await expressions
- Variables used before declaration
- Return statements outside functions
- Missing variable declarations

**This file appears to be a code snippet that was accidentally saved as a source file.**

---

### 8. **Intent Types Missing Enum Value** (~3 errors)

**Problem:** `Intent.CREATE_FILE` missing from IntentCategory mapping

```typescript
src/types/intent.types.ts(99,14):
  Property '[Intent.CREATE_FILE]' is missing in type
  'Record<Intent, IntentCategory>'
```

---

### 9. **Generated Document Type Issues** (~2 errors)

**Problem:** `content` property doesn't exist on `GenerateDocumentParams` type

```typescript
src/controllers/rag.controller.ts(2570,11):
  'content' does not exist in type 'GenerateDocumentParams'
```

---

## Priority Fix Order

### **PRIORITY 1: Fix Prisma Model Names** (~150 errors)
This will eliminate the majority of errors. Two approaches:

**Option A: Update Prisma Schema (Recommended)**
Add `@@map()` directives to match code expectations:
```prisma
model User {
  // fields...
  @@map("users")
}
```

**Option B: Global Find/Replace in Code**
Replace all snake_case with camelCase:
- `prisma.users` → `prisma.user`
- `prisma.documents` → `prisma.document`
- etc.

### **PRIORITY 2: Fix tsconfig.json** (~50 errors)
Add missing compiler options:
```json
{
  "compilerOptions": {
    "downlevelIteration": true,
    "target": "ES2020"
  }
}
```

### **PRIORITY 3: Delete/Fix Patch File** (~25 errors)
```bash
rm src/services/chat.service.DOCUMENT_GENERATION_PATCH.ts
```

### **PRIORITY 4: Fix Type Definitions** (~30 errors)
- Add missing properties to User type
- Fix RAG service interface
- Add Express Response extensions
- Fix metadata vs document_metadata

### **PRIORITY 5: Fix Remaining Issues** (~20 errors)
- Function signatures
- Intent enum
- GenerateDocumentParams

---

## Estimated Fix Time

| Priority | Errors | Fix Method | Time Estimate |
|----------|--------|------------|---------------|
| 1 | ~150 | Global find/replace | 30-60 min |
| 2 | ~50 | Config update | 5 min |
| 3 | ~25 | Delete file | 1 min |
| 4 | ~30 | Type definitions | 30 min |
| 5 | ~20 | Case-by-case | 20 min |
| **Total** | **~275** | | **~90 min** |

---

## Quick Fix Strategy (Deploy UTF-8 Fixes Only)

If you want to deploy just the UTF-8 fixes without fixing all errors:

### Option 1: Transpile Without Type Checking
```json
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "noEmit": false
  },
  "ts-node": {
    "transpileOnly": true
  }
}
```

### Option 2: Use Babel Instead of TSC
```bash
npm install --save-dev @babel/cli @babel/preset-typescript
npx babel src --out-dir dist --extensions ".ts"
```

### Option 3: Copy Only rag.controller.js
Manually copy the compiled JavaScript file from local to VPS (bypassing build).

---

## Files Requiring Changes

### High Priority Files (Most Errors):
1. `src/controllers/rag.controller.ts` - 40+ errors
2. `src/controllers/document.controller.ts` - 30+ errors
3. `src/controllers/chat.controller.ts` - 20+ errors
4. `src/services/chat.service.ts` - 15+ errors
5. `src/services/chatActions.service.ts` - 20+ errors
6. `src/services/terminology.service.ts` - 15+ errors
7. `src/services/advancedSearch.service.ts` - 15+ errors
8. `src/utils/rag.utils.ts` - 10+ errors

### Configuration Files:
- `backend/tsconfig.json` - needs updates
- `backend/prisma/schema.prisma` - may need @@map directives

---

## Next Steps

**Choose one approach:**

1. **Fix All Errors** - Clean solution, takes ~90 minutes
2. **Quick Deploy** - Skip type checking, deploy UTF-8 fixes only
3. **Prisma Schema Fix** - Add @@map directives to schema, regenerate client
4. **Local Build + Copy** - Build locally, copy dist/ folder to VPS

**Recommendation:** Start with Quick Deploy to get UTF-8 fixes live, then fix errors properly in a separate branch.

---

## Commands to Check Specific Error Categories

```bash
# Count Prisma naming errors
npm run build 2>&1 | grep "Did you mean" | wc -l

# Count iterator errors
npm run build 2>&1 | grep "downlevelIteration" | wc -l

# Count flush() errors
npm run build 2>&1 | grep "flush" | wc -l

# Check if specific file compiles
npx tsc --noEmit src/controllers/rag.controller.ts
```

---

**Status:** All errors documented and categorized
**Blockers Identified:** Yes
**Fix Strategy:** Defined
**Ready for Decision:** Yes
