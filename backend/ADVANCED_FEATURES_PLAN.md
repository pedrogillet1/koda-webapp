# KODA AI: Advanced Features Implementation Plan

## Overview
This document outlines the complete implementation plan for 5 major advanced feature categories that will transform KODA into a Manus-like document management and generation platform.

---

## Phase 1: Database Foundation ✅ COMPLETED

### New Database Tables (Added to schema.prisma)

1. **GeneratedDocument** - AI-generated and comparison documents
   - Links to source documents via `sourceDocumentIds` (JSON array)
   - Stores renderable content for real-time preview
   - Tracks generation type: comparison, from_prompt, template, ai_edit
   - Relations: template, editHistory

2. **DocumentTemplate** - Document generation templates
   - System and user templates
   - JSON structure for sections, fields, formatting
   - Category-based (contract, report, invoice, etc.)

3. **DocumentEditHistory** - Version tracking and rollback
   - Sequential edit numbers
   - Content snapshots (before/after)
   - Tracks AI commands and manual edits
   - Enables rollback functionality

4. **ExcelSheet** - Cache Excel sheet metadata
   - Sheet-level data (name, dimensions)
   - Cache expiration for performance
   - Relations: cells

5. **ExcelCell** - Individual cell data cache
   - Cell values, formulas, data types
   - Basic styling information
   - Indexed by position (row, col)

### Schema Modifications

- **Document** table: Added `renderableContent` field for Manus-style preview
- Added `generatedDocument` relation to Document model

---

## Phase 2: Core Services Implementation

### 2.1 Document Generation Service
**File**: `src/services/documentGeneration.service.ts`

**Responsibilities**:
- Multi-document comparison with AI analysis
- Document generation from natural language prompts
- Template-based document creation
- Renderable content generation (JSON-to-HTML)

**Key Methods**:
```typescript
class DocumentGenerationService {
  // Multi-Document Comparison
  async compareDocuments(documentIds: string[], comparisonType: string): Promise<GeneratedDocument>

  // AI-Powered Generation
  async generateFromPrompt(userId: string, prompt: string, context?: any): Promise<GeneratedDocument>

  // Template-Based Generation
  async generateFromTemplate(templateId: string, data: any): Promise<GeneratedDocument>

  // Renderable Content
  async generateRenderableContent(documentId: string): Promise<any>
}
```

**AI Integration**:
- Use Google Gemini for document comparison analysis
- Generate structured comparison reports with:
  - Side-by-side highlights
  - Difference markers
  - Similarity scores
  - Discrepancy detection

### 2.2 Document Editing Service
**File**: `src/services/documentEditing.service.ts`

**Responsibilities**:
- AI-powered inline editing
- Natural language edit commands
- Edit history tracking
- Rollback functionality

**Key Methods**:
```typescript
class DocumentEditingService {
  // AI Editing
  async applyAIEdit(docId: string, command: string): Promise<GeneratedDocument>

  // Manual Editing
  async applyManualEdit(docId: string, changes: any): Promise<GeneratedDocument>

  // History Management
  async getEditHistory(docId: string): Promise<DocumentEditHistory[]>
  async rollbackToEdit(docId: string, editNumber: number): Promise<GeneratedDocument>

  // Preview Generation
  async generateLivePreview(docId: string): Promise<any>
}
```

### 2.3 Excel Interactive Service
**File**: `src/services/excelInteractive.service.ts`

**Responsibilities**:
- Load Excel files into cache
- Cell-level editing with formula preservation
- Sort, filter, search operations
- Export modifications back to Excel

**Key Methods**:
```typescript
class ExcelInteractiveService {
  // Sheet Operations
  async loadSheet(documentId: string, sheetIndex: number): Promise<ExcelSheet>
  async getSheetData(sheetId: string): Promise<ExcelCell[]>

  // Cell Operations
  async updateCell(sheetId: string, row: number, col: number, value: string): Promise<ExcelCell>
  async updateFormula(sheetId: string, row: number, col: number, formula: string): Promise<ExcelCell>

  // Data Operations
  async sortRange(sheetId: string, range: any, sortOptions: any): Promise<void>
  async filterRows(sheetId: string, filterCriteria: any): Promise<ExcelCell[]>
  async searchValue(sheetId: string, searchTerm: string): Promise<SearchResult[]>

  // Export
  async exportToExcel(sheetId: string): Promise<Buffer>
}
```

### 2.4 Document Export Service
**File**: `src/services/documentExport.service.ts`

**Responsibilities**:
- Multi-format export (DOCX, PDF, CSV)
- Format conversion
- Styling preservation

**Key Methods**:
```typescript
class DocumentExportService {
  // Export Operations
  async exportToDOCX(generatedDocId: string): Promise<Buffer>
  async exportToPDF(generatedDocId: string): Promise<Buffer>
  async exportToCSV(generatedDocId: string): Promise<Buffer>

  // Format Conversion
  async convertFormat(docId: string, targetFormat: string): Promise<Buffer>
}
```

### 2.5 Template Management Service
**File**: `src/services/templateManagement.service.ts`

**Responsibilities**:
- Create/update/delete templates
- System template management
- Template validation
- Smart field detection

**Key Methods**:
```typescript
class TemplateManagementService {
  // CRUD Operations
  async createTemplate(userId: string, templateData: any): Promise<DocumentTemplate>
  async updateTemplate(templateId: string, updates: any): Promise<DocumentTemplate>
  async deleteTemplate(templateId: string): Promise<void>
  async getTemplates(userId: string, category?: string): Promise<DocumentTemplate[]>

  // Template Operations
  async validateTemplate(structure: any): Promise<boolean>
  async getSystemTemplates(): Promise<DocumentTemplate[]>
  async cloneTemplate(templateId: string, userId: string): Promise<DocumentTemplate>
}
```

---

## Phase 3: API Routes Implementation

### 3.1 Document Generation Routes
**File**: `src/routes/documentGeneration.routes.ts`

**Endpoints**:
```
POST   /api/documents/compare          - Compare multiple documents
POST   /api/documents/generate          - Generate from prompt
POST   /api/documents/generate/template - Generate from template
GET    /api/documents/:id/preview       - Get renderable preview
```

### 3.2 Document Editing Routes
**File**: `src/routes/documentEditing.routes.ts`

**Endpoints**:
```
POST   /api/documents/:id/edit/ai       - Apply AI edit command
POST   /api/documents/:id/edit/manual   - Apply manual edit
GET    /api/documents/:id/edit/history  - Get edit history
POST   /api/documents/:id/edit/rollback - Rollback to version
GET    /api/documents/:id/preview/live  - Get live preview
```

### 3.3 Excel Interactive Routes
**File**: `src/routes/excelInteractive.routes.ts`

**Endpoints**:
```
GET    /api/excel/:docId/sheets          - List all sheets
GET    /api/excel/:docId/sheets/:index   - Get sheet data
PUT    /api/excel/cells/:cellId          - Update cell value
PUT    /api/excel/cells/:cellId/formula  - Update cell formula
POST   /api/excel/sheets/:id/sort        - Sort range
POST   /api/excel/sheets/:id/filter      - Filter rows
GET    /api/excel/sheets/:id/search      - Search in sheet
POST   /api/excel/sheets/:id/export      - Export to Excel
```

### 3.4 Document Export Routes
**File**: `src/routes/documentExport.routes.ts`

**Endpoints**:
```
GET    /api/documents/:id/export/docx    - Export as DOCX
GET    /api/documents/:id/export/pdf     - Export as PDF
GET    /api/documents/:id/export/csv     - Export as CSV
POST   /api/documents/:id/convert        - Convert format
```

### 3.5 Template Management Routes
**File**: `src/routes/templateManagement.routes.ts`

**Endpoints**:
```
GET    /api/templates                    - Get all templates
GET    /api/templates/system             - Get system templates
GET    /api/templates/:id                - Get template by ID
POST   /api/templates                    - Create template
PUT    /api/templates/:id                - Update template
DELETE /api/templates/:id                - Delete template
POST   /api/templates/:id/clone          - Clone template
POST   /api/templates/:id/validate       - Validate template structure
```

---

## Phase 4: Frontend Components

### 4.1 Document Comparison View
**File**: `frontend/src/components/DocumentComparison/ComparisonView.tsx`

**Features**:
- Side-by-side document display
- Highlight differences
- AI-generated insights panel
- Export comparison report

### 4.2 Document Generation Interface
**File**: `frontend/src/components/DocumentGeneration/GenerationInterface.tsx`

**Features**:
- Natural language prompt input
- Template selector
- Smart field suggestions
- Real-time preview

### 4.3 Interactive Document Editor
**File**: `frontend/src/components/DocumentEditor/InteractiveEditor.tsx`

**Features**:
- Manus-style preview (JSON-to-HTML rendering)
- AI command input
- Inline editing
- Edit history sidebar
- Rollback buttons

### 4.4 Excel Interactive Editor
**File**: `frontend/src/components/ExcelEditor/InteractiveSheet.tsx`

**Features**:
- Spreadsheet grid (react-data-grid)
- Cell editing with formula support
- Sort/filter controls
- Search functionality
- Export button

### 4.5 Template Builder
**File**: `frontend/src/components/Templates/TemplateBuilder.tsx`

**Features**:
- Visual template designer
- Field type selector
- Section management
- Preview pane

---

## Phase 5: Dependencies and Tools

### Backend Dependencies
```json
{
  "python-docx": "For DOCX generation",
  "xhtml2pdf": "For PDF generation",
  "openpyxl": "For Excel processing",
  "csv": "For CSV operations"
}
```

**Note**: Some libraries are Python-based. Options:
1. Create Python microservice for document operations
2. Use Node.js alternatives:
   - `docx` (npm) for DOCX
   - `pdfkit` or `puppeteer` for PDF
   - `exceljs` for Excel

### Frontend Dependencies
```json
{
  "react-data-grid": "Excel-like spreadsheet component",
  "@tiptap/react": "Rich text editor",
  "react-diff-viewer": "Side-by-side diff display",
  "react-json-view": "JSON preview"
}
```

---

## Phase 6: Implementation Priority

### Priority 1: Multi-Document Comparison (Week 1)
1. Implement `documentGeneration.service.ts`
2. Add comparison routes
3. Create frontend comparison view
4. Test with 2-3 document comparison

### Priority 2: AI Document Generation (Week 2)
1. Add prompt-based generation
2. Create template management system
3. Build generation interface
4. Test with various prompts

### Priority 3: Interactive Editor (Week 3)
1. Implement `documentEditing.service.ts`
2. Add AI edit capabilities
3. Build Manus-style preview
4. Add edit history tracking

### Priority 4: Excel Editing (Week 4)
1. Implement `excelInteractive.service.ts`
2. Cache Excel data in database
3. Build spreadsheet UI
4. Add cell editing

### Priority 5: Multi-Format Export (Week 5)
1. Implement `documentExport.service.ts`
2. Add format conversion
3. Create export routes
4. Test all formats

---

## Phase 7: Testing Strategy

### Unit Tests
- Test each service method independently
- Mock database calls
- Test edge cases

### Integration Tests
- Test API endpoints
- Test database operations
- Test file generation

### E2E Tests
- Test complete workflows
- Test UI interactions
- Test multi-user scenarios

---

## Phase 8: Performance Optimization

### Caching Strategy
1. **Excel Sheets**: Cache for 30 minutes, refresh on edit
2. **Renderable Content**: Generate once, cache until document changes
3. **Templates**: Cache system templates permanently

### Background Processing
1. **Document Comparison**: Queue for large documents
2. **PDF Generation**: Background job with webhook notification
3. **Excel Import**: Async processing for large files

---

## Phase 9: Security Considerations

### Access Control
- Use existing RBAC system
- Add permissions: `documents:generate`, `documents:edit`, `templates:manage`
- Validate ownership before operations

### Data Protection
- Encrypt generated documents
- Track all edits in audit log
- Implement rate limiting for AI operations

---

## Phase 10: Deployment Checklist

### Database
- [ ] Run Prisma migrations
- [ ] Create indexes for new tables
- [ ] Test query performance

### Backend
- [ ] Implement all 5 core services
- [ ] Create all API routes
- [ ] Add middleware for auth/validation
- [ ] Test all endpoints

### Frontend
- [ ] Build all 5 major components
- [ ] Integrate with backend APIs
- [ ] Add loading states
- [ ] Test responsive design

### Documentation
- [ ] API documentation
- [ ] User guides
- [ ] Admin guides
- [ ] Video tutorials

---

## Success Metrics

1. **Document Comparison**: Users can compare 2+ documents in < 5 seconds
2. **Document Generation**: Generate documents from prompts in < 10 seconds
3. **Interactive Editing**: Real-time preview updates in < 500ms
4. **Excel Editing**: Cell updates render in < 100ms
5. **Export**: Multi-format export completes in < 3 seconds

---

## Current Status

✅ **Phase 1 Complete**: Database schema updated with 5 new tables
⏳ **Phase 2 Next**: Begin implementing core services
📋 **Total Features**: 5 major feature categories
🎯 **Timeline**: 5 weeks for MVP implementation

---

**Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: Planning Complete - Ready for Implementation
