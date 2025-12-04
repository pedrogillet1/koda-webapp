# Use relative path from current working directory
$servicesPath = ".\backend\src\services"
$deleted = 0
$notFound = 0

# Category 1: Redundant/Duplicate Services
$cat1 = @(
    'chat.service.DOCUMENT_GENERATION_PATCH.ts',
    'rag.service.DOCUMENT_GENERATION_PATCH.ts',
    'systemPrompts.service.BACKUP.ts',
    'systemPrompts.service.BACKUP_20251124.ts',
    'confidenceScoring.service.ts',
    'contradictionDetection.service.ts',
    'metadataEnhancement.service.ts',
    'metadataEnrichment.service.ts',
    'metadataExtraction.service.ts',
    'metadata.service.ts',
    'sessionStorage.service.ts'
)

# Category 2: Unused/Never Called
$cat2 = @(
    'adaptiveAnswerGeneration.service.ts',
    'showVsExplainClassifier.service.ts',
    'formatTypeClassifier.service.ts',
    'documentTypeClassifier.service.ts',
    'synthesisQueryDetection.service.ts',
    'retrievalQuality.service.ts',
    'emptyResponsePrevention.service.ts',
    'proactiveSuggestions.service.ts',
    'clarification.service.ts',
    'reasoning.service.ts',
    'hybridRetrievalBooster.service.ts',
    'fullDocumentRetrieval.service.ts',
    'crossDocumentSynthesis.service.ts',
    'comparativeAnalysis.service.ts',
    'documentComparison.service.ts',
    'advancedSearch.service.ts',
    'p0Features.service.ts'
)

# Category 3: Over-Engineered Metadata
$cat3 = @(
    'systemMetadata.service.ts',
    'documentStructure.service.ts',
    'documentIndex.service.ts',
    'citation-tracking.service.ts'
)

# Category 4: Over-Engineered Document Processing
$cat4 = @(
    'chatDocumentAnalysis.service.ts',
    'chatDocumentGeneration.service.ts',
    'documentGeneration.service.ts',
    'documentGenerationDetection.service.ts',
    'documentEditing.service.ts',
    'documentExport.service.ts',
    'fileCreation.service.ts',
    'fileGenerationModal.service.ts',
    'slideGeneration.service.ts',
    'pptxCreation.service.ts',
    'pptxSlideGenerator.service.ts',
    'presentationExport.service.ts'
)

# Category 5: Over-Engineered Search/Retrieval
$cat5 = @(
    'search.service.ts',
    'semanticDocumentSearch.service.ts',
    'semanticFileMatcher.service.ts',
    'semantic-chunking.service.ts',
    'fuzzy-match.service.ts',
    'llm-chunk-filter.service.ts',
    'reranking.service.ts',
    'conversationRetrieval.service.ts',
    'conversationEmbedding.service.ts',
    'vectorEmbedding.service.ts'
)

# Category 6: Intent Detection
$cat6 = @(
    'fastPathDetector.service.ts'
)

# Category 7: Query Processing
$cat7 = @(
    'query-decomposition.service.ts',
    'query-enhancement.service.ts',
    'queryRewriter.service.ts',
    'intelligentQuery.service.ts'
)

# Category 8: Redundant Response Formatting
$cat8 = @(
    'responsePostProcessor.service.ts',
    'unifiedFormatting.service.ts',
    'structuredResponseGenerator.service.ts',
    'dynamicResponseGenerator.service.ts',
    'dynamicResponseSystem.service.ts',
    'outputIntegration.service.ts'
)

# Category 9: Redundant Context Management
$cat9 = @(
    'contextEngineering.service.ts',
    'contextTracker.service.ts',
    'memory.service.ts'
)

# Category 10: Over-Engineered Extraction
$cat10 = @(
    'causalExtraction.service.ts',
    'methodologyExtraction.service.ts',
    'definitionExtraction.service.ts',
    'relationshipExtraction.service.ts',
    'knowledgeExtraction.service.ts',
    'evidenceAggregation.service.ts',
    'practicalImplications.service.ts',
    'terminologyIntelligence.service.ts',
    'memoryExtraction.service.ts',
    'trendAnalysis.service.ts',
    'domainKnowledge.service.ts',
    'synthesis.service.ts'
)

# Category 11: Third-Party/Non-Core
$cat11 = @(
    'manus.service.ts',
    'oauth.service.ts',
    'pendingUser.service.ts',
    'sms.service.ts',
    'storage.service.ts',
    'tag.service.ts',
    'thumbnail.service.ts',
    'vision.service.ts',
    'navigation.service.ts',
    'chatActions.service.ts',
    'conversationState.service.ts',
    'ner.service.ts',
    'terminology.service.ts',
    'postProcessor.service.ts'
)

# Combine all categories
$allCategories = [ordered]@{
    'Category 01: Redundant/Duplicate' = $cat1
    'Category 02: Unused/Never Called' = $cat2
    'Category 03: Over-Engineered Metadata' = $cat3
    'Category 04: Document Processing' = $cat4
    'Category 05: Search/Retrieval' = $cat5
    'Category 06: Intent Detection' = $cat6
    'Category 07: Query Processing' = $cat7
    'Category 08: Response Formatting' = $cat8
    'Category 09: Context Management' = $cat9
    'Category 10: Extraction Services' = $cat10
    'Category 11: Third-Party/Non-Core' = $cat11
}

Write-Host "========================================================"
Write-Host "  KODA UNUSED SERVICES REMOVAL"
Write-Host "========================================================"
Write-Host "Services path: $servicesPath"
Write-Host "Current dir: $(Get-Location)"
Write-Host ""

foreach ($category in $allCategories.GetEnumerator()) {
    Write-Host "[$($category.Key)]" -ForegroundColor Cyan
    foreach ($file in $category.Value) {
        $fullPath = Join-Path $servicesPath $file
        if (Test-Path $fullPath) {
            Remove-Item $fullPath -Force
            Write-Host "  [DELETED] $file" -ForegroundColor Green
            $deleted++
        } else {
            Write-Host "  [NOT FOUND] $file" -ForegroundColor Yellow
            $notFound++
        }
    }
    Write-Host ""
}

Write-Host "========================================================"
Write-Host "  SUMMARY"
Write-Host "========================================================"
Write-Host "Services deleted: $deleted" -ForegroundColor Green
Write-Host "Services not found: $notFound" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backup branch: backup-before-cleanup-20251204"
Write-Host "Cleanup branch: cleanup-unused-services"
