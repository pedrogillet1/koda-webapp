# KODA Actions Testing Guide

## Quick Test Scenarios

Test these queries in KODA to verify all fixes are working:

---

## ✅ Test 1: Create Folder (Should Actually Create)

**Query:** `"Create a folder named 'Test Projects'"`

**Expected Response:**
```
Folder "Test Projects" created successfully.
```

**Verify:**
1. Check KODA's response is not just "OK I will do it"
2. Navigate to your folders in the UI - "Test Projects" should appear
3. Try to create the same folder again - should say "already exists"

---

## ✅ Test 2: Rename Folder (Should Actually Rename)

**Query:** `"rename the pedro1 folder to pedro_renamed"`

**Expected Response:**
```
Folder renamed from "pedro1" to "pedro_renamed".
```

**Verify:**
1. Folder "pedro1" no longer exists
2. Folder "pedro_renamed" now exists
3. All documents that were in "pedro1" are now in "pedro_renamed"
4. Subfolders have updated paths

---

## ✅ Test 3: Move Files with Semantic Search (Anti-Hallucination Test)

**Setup:** First create a target folder:
```
"Create a folder named 'Koda Documents'"
```

**Query:** `"Move all documents related to Koda to the Koda Documents folder"`

**Expected Response:**
```
Successfully moved 3 document(s) to "Koda Documents":
Koda Business Plan.pdf, Koda Blueprint.pdf, Koda Presentation.pptx
```

**CRITICAL VERIFICATION - No Hallucinations:**
1. ✅ Check that response ONLY mentions files that actually exist in your system
2. ❌ Response should NOT mention "koda advogados.pdf" or any made-up filenames
3. ✅ All mentioned files should now be in the "Koda Documents" folder
4. ✅ The file count in the response should match the actual number of files moved

---

## ✅ Test 4: Show PDF Documents Related to Koda (Content Search, Not Filename)

**Query:** `"Show me all PDF documents related to Koda"`

**Expected Response:**
```
I found 5 documents related to "Koda":

In Koda Business Plan.pdf: [relevant excerpt]
In Montana Hotel Analysis.pdf: [mentions Koda Sanctuary project]
In Blueprint.pdf: [discusses Koda architecture]
...
```

**Verify:**
1. ✅ Response includes ALL documents that MENTION Koda (not just files with "Koda" in the name)
2. ✅ Each result says "In [Document Name]:" with the actual content
3. ❌ Response does NOT say "I couldn't find any files" if documents exist

---

## ✅ Test 5: Summarize Specific Document

**Query:** `"Summarize the ICP document"`

**Expected Response:**
```
The ICP (Ideal Customer Profile) document outlines [actual summary content from the document].
```

**Verify:**
1. ✅ Response is a SUMMARY of the document content (not "what's in the folder")
2. ✅ Response includes specific facts from the document
3. ❌ Response does NOT say "I couldn't find a folder named..."

---

## ✅ Test 6: Find Duplicates

**Query:** `"Find duplicates in my documents"`

**Expected Response:**
```
Found 2 group(s) of duplicate files (3.5 MB wasted space):

Group 1: Business_Plan.pdf (2 copies)
- Business_Plan.pdf in Work folder (Jan 15, 2025)
- Business_Plan.pdf in Backup folder (Jan 20, 2025)

Group 2: Invoice_2024.pdf (3 copies)
- Invoice_2024.pdf in Finance folder (Dec 1, 2024)
- Invoice_2024 (1).pdf in Finance folder (Dec 5, 2024)
- Invoice_2024 (2).pdf in Downloads folder (Dec 10, 2024)
```

**Verify:**
1. ✅ Lists actual duplicate files (same SHA-256 hash)
2. ✅ Shows location of each copy
3. ✅ Calculates wasted space

---

## ✅ Test 7: What's in a Folder (Navigation, Not Content)

**Query:** `"What's in the EOY F3 folder?"`

**Expected Response:**
```
The folder EOY F3 contains:
• Documents (3): Biology.docx, Chemistry.pdf, Physics.xlsx
• Subfolders (1): Lab Reports
```

**Verify:**
1. ✅ Lists files and subfolders in the folder
2. ✅ Uses structured format (not paragraph)
3. ❌ Does NOT try to summarize document content

---

## 🔴 Edge Cases to Test

### Edge Case 1: Folder Already Exists
**Query:** `"Create a folder named 'Test Projects'"` (run twice)

**Expected 2nd Response:**
```
A folder named "Test Projects" already exists in this location.
```

---

### Edge Case 2: Folder Not Found
**Query:** `"Rename the XYZ_NonExistent folder to ABC"`

**Expected Response:**
```
Folder "XYZ_NonExistent" not found.
```

---

### Edge Case 3: No Matching Documents
**Query:** `"Move all documents about dinosaurs to Science folder"`

**Expected Response:**
```
No documents found matching your criteria for "documents about dinosaurs".
```

**CRITICAL:** Should NOT say "I will move koda_dinosaurs.pdf" (hallucination)

---

### Edge Case 4: Target Folder Doesn't Exist
**Query:** `"Move all PDFs to the NonExistentFolder"`

**Expected Response:**
```
Target folder "NonExistentFolder" not found. Please create it first.
```

---

## 🛠️ Debugging Tips

### Check Database Directly

**View all folders:**
```bash
cd backend
npx prisma studio
# Navigate to "folders" table
```

**Check folder after creation:**
```sql
SELECT id, name, path, userId FROM folders WHERE name='Test Projects';
```

**Check documents in folder:**
```sql
SELECT d.filename, f.name as folder_name
FROM documents d
LEFT JOIN folders f ON d.folderId = f.id
WHERE f.name = 'Koda Documents';
```

---

### Check Backend Logs

Look for these log patterns:

**CREATE_FOLDER:**
```
📁 [CREATE_FOLDER] Creating folder: "Test Projects" for user: user-123
✅ [CREATE_FOLDER] Successfully created folder: uuid-456
```

**MOVE_FILES:**
```
📦 [MOVE_FILES] Moving files to "Koda Documents"
   Query: "Move all documents related to Koda..."
✅ [MOVE_FILES] Successfully moved 3 documents
```

**Anti-Hallucination Check:**
```
⚠️  [MOVE_FILES] AI hallucinated non-existent files: fake_file.pdf
```
If you see this warning, the AI tried to make up a file but was caught!

---

## 🚨 Known Issues (Should NOT Happen)

### ❌ BAD: KODA Says "OK I will do it" but Nothing Happens
**If this happens:** The action handler is not being called correctly.
**Check:** Backend logs for the specific intent detection

### ❌ BAD: AI Mentions Files That Don't Exist
**If this happens:** The document list grounding failed.
**Check:** `moveFiles()` function in fileActions.service.ts

### ❌ BAD: "Summarize the ICP document" → "I couldn't find a folder"
**If this happens:** Intent classification is wrong.
**Check:** Pattern matching in patternIntent.service.ts

---

## ✅ Success Criteria

All fixes are working correctly if:
1. ✅ CREATE_FOLDER actually creates a folder in the database
2. ✅ RENAME_FOLDER actually renames the folder (not just says "OK")
3. ✅ MOVE_FILES only mentions files that exist (no hallucinations)
4. ✅ "Summarize X" goes to RAG (not folder navigation)
5. ✅ "Show me PDFs related to X" does semantic search (not filename search)
6. ✅ FIND_DUPLICATES returns actual duplicate groups
7. ✅ Error messages are clear and helpful

---

## 📞 Need Help?

If any test fails:
1. Check the `KODA_FIX_SUMMARY.md` for implementation details
2. Review backend logs for error messages
3. Verify database state with Prisma Studio
4. Check that patternIntent.service.ts is correctly classifying intents

**Implementation Status:** ✅ All core functionality completed and integrated!
