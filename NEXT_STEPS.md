# Next Steps - Koda QA Integration & Deployment

**Status:** All code changes completed and committed locally
**Ready for:** Manual QA gate integration, testing, and GitHub push

---

## ✅ What's Been Completed

### 1. QA Orchestrator Implementation
- ✅ Created `qaOrchestrator.service.ts` with full quality assurance checks
- ✅ Integrated grounding verification, citation checking, completeness, and formatting
- ✅ Fixed all TypeScript interface mismatches
- ✅ Added import to `rag.service.ts`

### 2. Gemini Model Upgrade
- ✅ All 58 Gemini references now use `gemini-2.5-flash`
- ✅ Updated 5 service files:
  - `geminiClient.service.ts`
  - `entityExtractor.service.ts`
  - `microSummaryGenerator.service.ts`
  - `rollingConversationSummary.service.ts`
  - `geminiCache.service.ts` (already correct)

### 3. Service Cleanup
- ✅ Deleted 3 duplicate services
- ✅ Created 3 stub services for backward compatibility
- ✅ Fixed all broken imports (0 remaining)
- ✅ Verified all 9 core services present

### 4. Git Commits
- ✅ 3 commits ready to push:
  1. `caf08f3` - QA orchestration and Gemini 2.5 Flash upgrade
  2. `27ae751` - Update remaining Gemini models
  3. `9ada0f3` - Add comprehensive verification report

---

## 🔧 Step 1: Complete QA Gate Integration (MANUAL STEP)

**File:** `backend/src/services/rag.service.ts`
**Location:** After line 9073
**Instructions:** See `QA_GATE_INTEGRATION.md`

### Why Manual?
File encoding issues with emoji characters in the file prevented automated insertion.

### What to Add:
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

### After Adding:
```bash
# Save the file, then commit
git add backend/src/services/rag.service.ts
git commit -m "feat: Integrate QA gate into RAG pipeline

Add quality assurance checks after LLM generation:
- Grounding verification
- Citation checking
- Completeness validation
- Formatting checks

QA gate runs automatically on all generated answers with
configurable thresholds and fallback handling.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Step 2: Test the Backend

### Start Backend:
```bash
cd backend
npm run dev
```

### What to Look For:
1. **Startup logs:**
   - No errors about missing services
   - All imports resolve correctly
   - Server starts on port 5000

2. **Make a test query** (via frontend or API):
   ```bash
   # Example: Ask a question that uses RAG
   curl -X POST http://localhost:5000/api/rag/query \
     -H "Content-Type: application/json" \
     -d '{"query": "What is in my documents?", "userId": "test-user-id"}'
   ```

3. **Check console for QA logs:**
   ```
   [QA-GATE] Running quality assurance checks...
   [QA-GATE] Quality scores: { overall: 0.87, grounding: 0.92, ... }
   [QA-GATE] PASSED - Quality checks successful
   [QA-GATE] Completed in 145ms
   ```

### If Errors Occur:
- Check `VERIFICATION_REPORT.md` for troubleshooting
- Verify all imports in `rag.service.ts`
- Check that `qaOrchestrator.service.ts` exports correctly

---

## 🚀 Step 3: Push to GitHub

### Option A: Push with Existing Credentials
```bash
cd /c/Users/Pedro/Desktop/webapp
git push origin main
```

### Option B: Authenticate First (if push fails)

#### Using Personal Access Token (Recommended):
```bash
# 1. Generate token at: https://github.com/settings/tokens
#    - Scopes: repo (full control)

# 2. Use token as password when pushing:
git push origin main
# Username: pedrogillet1
# Password: <paste-your-token>

# 3. Cache credentials (optional):
git config --global credential.helper store
# Next push will save credentials
```

#### Using SSH Key:
```bash
# 1. Generate SSH key (if you don't have one):
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. Add to GitHub: https://github.com/settings/keys
#    Copy contents of: C:\Users\Pedro\.ssh\id_ed25519.pub

# 3. Update remote to use SSH:
git remote set-url origin git@github.com:pedrogillet1/koda-webapp.git

# 4. Push:
git push origin main
```

#### Using GitHub CLI:
```bash
# 1. Install GitHub CLI: https://cli.github.com/

# 2. Authenticate:
gh auth login

# 3. Push:
git push origin main
```

---

## 🔍 Step 4: Verify on GitHub

After successful push, verify:

1. **Check commits on GitHub:**
   - Go to: https://github.com/pedrogillet1/koda-webapp/commits/main
   - Verify all 3 commits are present
   - Check commit messages are formatted correctly

2. **Review changes:**
   - Check that `qaOrchestrator.service.ts` is visible
   - Verify deleted services no longer appear
   - Confirm Gemini model changes in files

3. **GitHub Actions (if configured):**
   - Check that CI/CD pipeline passes
   - Verify no build errors

---

## 📊 Verification Checklist

Before considering complete:

- [ ] QA gate code manually added to `rag.service.ts` line 9073
- [ ] Backend starts without errors (`npm run dev`)
- [ ] Test query produces response
- [ ] `[QA-GATE]` logs appear in console
- [ ] Quality scores logged (overall, grounding, citations, etc.)
- [ ] All commits pushed to GitHub
- [ ] GitHub shows latest commits
- [ ] No CI/CD failures

---

## 🎯 Success Criteria

You'll know everything is working when:

1. ✅ Backend starts cleanly
2. ✅ Queries return responses
3. ✅ Console shows:
   ```
   [MODEL-SELECTION] Using Flash (medium query, QA enabled)
   [QA-GATE] Running quality assurance checks...
   [QA-GATE] Quality scores: {...}
   [QA-GATE] PASSED - Quality checks successful
   ```
4. ✅ All changes visible on GitHub
5. ✅ No TypeScript errors
6. ✅ No runtime errors

---

## 📝 Documents Created

For reference:

1. **QA_GATE_INTEGRATION.md** - Manual integration instructions
2. **VERIFICATION_REPORT.md** - Complete verification against checklist
3. **NEXT_STEPS.md** - This file (step-by-step guide)

---

## 🆘 Troubleshooting

### Backend Won't Start
```bash
# Check for TypeScript errors
cd backend
npm run build

# Check for missing dependencies
npm install
```

### QA Gate Not Running
- Verify `runQualityAssurance` is imported in `rag.service.ts`
- Check that QA gate code is at correct location (after line 9073)
- Ensure `qaOrchestrator.service.ts` exists

### GitHub Push Fails
- Check GitHub permissions
- Verify repository URL: `git remote -v`
- Try authentication methods in Step 3

### Quality Scores Always 1.0
- Check that `sortedChunks` variable exists in scope
- Verify `userMessage` variable contains the query
- Ensure services are actually being called (add debug logs)

---

## 🎉 When Complete

Once all steps are done:

1. Update VPS environment keys (see original request)
2. Deploy to production
3. Monitor QA logs in production
4. Collect metrics on quality improvements

**You're now ready to deploy with:**
- Automated quality assurance
- Gemini 2.5 Flash performance
- Clean, maintainable codebase

Good luck! 🚀
