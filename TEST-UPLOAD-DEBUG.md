# Upload Debug Guide - Step by Step

## 🔍 Debugging Steps

### Step 1: Check Browser Console

1. Open browser (http://localhost:3000)
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Navigate to Upload page
5. Upload a small file
6. **Look for these logs** (I added comprehensive logging):

```
========================================
✅ Upload completed!
📊 Document ID: [some-id]
📊 Document filename: [your-filename]
📊 Current local documents count: X
========================================
🔄 Fetching documents from /api/documents...
========================================
📊 Backend returned X documents
📊 Document IDs: [array of IDs]
📊 Document filenames: [array of filenames]
📊 Looking for document ID: [some-id]
📊 Is our document in the list? true/false  ← KEY INFO!
========================================
```

### Step 2: What to Look For

**Scenario A: Upload is not completing**
- If you don't see "✅ Upload completed!" logs
- The upload code is not reaching the fetch section
- Problem is earlier in the upload flow

**Scenario B: Backend doesn't have the document**
- If you see "Is our document in the list? false"
- Backend successfully saved document
- But GET /api/documents doesn't return it
- Possible reasons:
  - Document status filter (only returns completed?)
  - User ID mismatch
  - Database query issue

**Scenario C: State update fails**
- If you see "✅ Local state updated!" but document still not visible
- State is updating correctly
- But React is not re-rendering
- OR documents are filtered out in the render

### Step 3: Check Backend Logs

While upload is happening, check backend console:

```bash
# In a new terminal
pm2 logs koda-backend --lines 50
```

Look for:
```
✅ Document created: [document-id]
📡 WebSocket event emitted: document created
```

### Step 4: Manual API Test

Test the API directly in browser console:

```javascript
// After uploading, run this in browser console:
fetch('http://localhost:5000/api/documents', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('📊 Total documents:', data.documents.length);
  console.log('📊 Documents:', data.documents.map(d => ({
    id: d.id,
    filename: d.filename,
    status: d.status
  })));
});
```

This will show you:
- How many documents the backend has
- What their statuses are
- If your uploaded document is there

### Step 5: Check Document Status

The backend might be filtering documents by status. Check if your documents are status='processing':

```javascript
// In browser console:
fetch('http://localhost:5000/api/documents', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('📊 Processing documents:', data.documents.filter(d => d.status === 'processing'));
  console.log('📊 Completed documents:', data.documents.filter(d => d.status === 'completed'));
  console.log('📊 Uploading documents:', data.documents.filter(d => d.status === 'uploading'));
});
```

## 🎯 Next Steps Based on Results

### If "Is our document in the list? false"

The backend saved the document but GET /api/documents doesn't return it.

**Possible causes:**
1. Backend filters documents by status (only returns 'completed')
2. Backend filters by userId (document saved with wrong userId)
3. Database replication delay

**Fix:** Check backend controller:
```typescript
// backend/src/controllers/document.controller.ts
// Look for GET /api/documents endpoint
// Check if there's a status filter
```

### If "Is our document in the list? true" but still not visible

The state has the document but it's not rendering.

**Possible causes:**
1. `filteredDocuments` is filtering it out (search query?)
2. React not re-rendering
3. CSS hiding it

**Debug:**
```javascript
// In browser console after upload:
// Check if searchQuery is filtering it out
console.log('Search query:', searchQuery);

// Check raw state
console.log('Raw documents:', documents);
console.log('Filtered documents:', filteredDocuments);
```

### If you don't see any logs at all

The upload code is not reaching our logging section.

**Check:**
1. Is upload failing earlier?
2. Check browser Network tab for failed requests
3. Check for JavaScript errors in console

## 📞 Report Back

Please share:
1. **All console logs** from the upload (copy-paste from browser console)
2. **Backend logs** if possible
3. **Manual API test results** (run the fetch commands above)

This will tell us exactly what's happening!
