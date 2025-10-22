-- Verify user_id consistency between documents and document_chunks
-- This will show if chunks have wrong or NULL user_id

-- Check 1: Find chunks with mismatched user_ids
SELECT
  d.id as document_id,
  d.name as document_name,
  d.user_id as document_user_id,
  dc.user_id as chunk_user_id,
  COUNT(*) as chunk_count,
  CASE
    WHEN d.user_id = dc.user_id THEN '✅ Match'
    WHEN dc.user_id IS NULL THEN '❌ Chunk user_id is NULL'
    ELSE '❌ Mismatch'
  END as status
FROM documents d
JOIN document_chunks dc ON d.id = dc.document_id
GROUP BY d.id, d.name, d.user_id, dc.user_id
ORDER BY status DESC, d.id;

-- Check 2: Count total mismatches
SELECT
  COUNT(DISTINCT d.id) as total_documents,
  COUNT(DISTINCT CASE WHEN d.user_id != dc.user_id OR dc.user_id IS NULL THEN d.id END) as documents_with_mismatch,
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN d.user_id != dc.user_id OR dc.user_id IS NULL THEN 1 END) as chunks_with_mismatch
FROM documents d
JOIN document_chunks dc ON d.id = dc.document_id;

-- Check 3: Find chunks without user_id
SELECT
  d.id as document_id,
  d.name,
  d.user_id as correct_user_id,
  COUNT(*) as chunks_without_user_id
FROM documents d
JOIN document_chunks dc ON d.id = dc.document_id
WHERE dc.user_id IS NULL
GROUP BY d.id, d.name, d.user_id;

-- Check 4: For a specific user (replace with your friend's user_id)
-- SELECT
--   d.id,
--   d.name,
--   d.user_id as doc_user_id,
--   dc.user_id as chunk_user_id,
--   COUNT(*) as chunks
-- FROM documents d
-- JOIN document_chunks dc ON d.id = dc.document_id
-- WHERE d.user_id = YOUR_FRIEND_USER_ID
-- GROUP BY d.id, d.name, d.user_id, dc.user_id;
