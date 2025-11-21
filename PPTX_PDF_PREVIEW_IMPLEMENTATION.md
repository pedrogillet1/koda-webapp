# PPTX PDF Preview Implementation Guide

## ✅ Completed

### 1. Database Schema Updated
- **File**: `backend/prisma/schema.prisma`
- Added `pdfPreviewPath` and `pdfPreviewUrl` fields to Document model (lines 187-189)

### 2. PPTX to PDF Service Created
- **File**: `backend/src/services/pptxToPdf.service.ts` (NEW)
- Converts PPTX files to PDF using LibreOffice
- Uploads PDF to GCS and generates signed URLs
- Handles multiple LibreOffice installation paths

### 3. API Endpoint Added
- **File**: `backend/src/routes/document.routes.ts`
- Added route: `GET /:id/pdf-preview` (line 34)

- **File**: `backend/src/controllers/document.controller.ts`
- Added controller method: `getPdfPreview` (lines 894-947)
- Generates fresh signed URLs for PDF previews

## 🔧 Manual Steps Required

### Step 1: Update Document Service (REQUIRED)

**File**: `backend/src/services/document.service.ts`

**Location**: After line 309 (right after the pptxSlideChunks creation)

**Add this code**:

```typescript
// 🆕 Convert PPTX to PDF for preview (synchronous, before document creation)
let pdfPreviewPath: string | null = null;
let pdfPreviewUrl: string | null = null;

console.log('📄 Converting PPTX to PDF for preview...');
try {
  const pptxToPdfService = (await import('./pptxToPdf.service')).default;
  const pdfResult = await pptxToPdfService.convertToPdf(tempFilePath, userId);

  if (pdfResult.success) {
    pdfPreviewPath = pdfResult.pdfPath;
    pdfPreviewUrl = pdfResult.pdfUrl;
    console.log('✅ PDF preview created successfully');
  } else {
    console.warn(`⚠️ PDF preview generation failed: ${pdfResult.error}`);
  }
} catch (pdfError: any) {
  console.warn(`⚠️ PDF preview generation error: ${pdfError.message}`);
}
```

**Then**: Find where the document is created (search for `prisma.document.create`) and add these fields:

```typescript
pdfPreviewPath,    // Add this line
pdfPreviewUrl,     // Add this line
```

### Step 2: Regenerate Prisma Client

```bash
cd backend
npx prisma generate
```

### Step 3: Restart Backend

Stop the current backend server and restart it:

```bash
cd backend
npm run dev
```

## 📝 Next Steps (Automated)

The following will be completed automatically once you confirm:

### Frontend Changes

1. **Update DocumentViewer.jsx** to use PDF preview for PPTX files
2. **Update PPTXPreview component** to fetch and display PDF instead of slides

## 🎯 How It Works

### Upload Flow:
1. User uploads PPTX file
2. Text extraction happens (existing flow)
3. **NEW**: PPTX is converted to PDF using LibreOffice
4. PDF is uploaded to GCS
5. Signed URL is generated and stored in database
6. Image extraction continues in background (existing flow)

### Preview Flow:
1. User opens PPTX document
2. Frontend checks if `pdfPreviewPath` exists
3. If yes: Displays PDF preview (full fidelity, all content visible)
4. If no: Falls back to slide-by-slide image preview

### Download Flow:
- Download button always downloads the ORIGINAL PPTX file
- PDF preview is only used for viewing, not downloading

## 🐛 Troubleshooting

### LibreOffice Not Found Error
- Ensure LibreOffice is installed
- The service tries multiple installation paths automatically
- Windows: `C:\Program Files\LibreOffice\program\soffice.exe`
- Linux: `/usr/bin/libreoffice`
- macOS: `/Applications/LibreOffice.app/Contents/MacOS/soffice`

### PDF Preview Not Generating
- Check backend logs for conversion errors
- Verify LibreOffice is accessible
- Check GCS permissions for uploads
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set

### Old PPTX Files
- Files uploaded before this implementation won't have PDF previews
- They will fall back to the existing slide image preview
- To regenerate: Delete and re-upload the file

## 📊 Benefits

1. **Better Preview**: Full-fidelity PDF rendering vs. individual slide images
2. **Faster Loading**: Single PDF file vs. loading many image files
3. **Reliable**: LibreOffice handles complex presentations better than image extraction
4. **Standard Approach**: Same as Google Drive, Dropbox, etc.

## 🎬 Ready to Continue?

Reply with "continue" to complete the frontend implementation automatically.
