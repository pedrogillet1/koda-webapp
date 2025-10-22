import multer from 'multer';
import path from 'path';

// Configure multer for memory storage (we'll upload directly to GCS)
const storage = multer.memoryStorage();

/**
 * Check if file is a Mac/Windows hidden system file
 * These files cause 400 errors and should be rejected
 */
const isMacHiddenFile = (filename: string): boolean => {
  const hiddenPatterns = [
    '.DS_Store',
    '.localized',
    '__MACOSX',
    'Thumbs.db',
    'desktop.ini',
  ];

  // Check if starts with dot (hidden file)
  if (filename.startsWith('.')) {
    return true;
  }

  // Check against known patterns
  return hiddenPatterns.some(pattern => filename.includes(pattern));
};

// File filter
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // ✅ CRITICAL: Reject Mac/Windows hidden files
  if (isMacHiddenFile(file.originalname)) {
    console.log('🚫 [Backend] Rejected hidden file:', file.originalname);
    cb(new Error(`System files not allowed: ${file.originalname}`));
    return;
  }
  // Allowed file types
  const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/html',
    'application/rtf',

    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'image/svg+xml',
    'image/x-icon',

    // Design files
    'image/vnd.adobe.photoshop',
    'application/photoshop',
    'application/psd',

    // Video files
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',

    // Generic fallback for when browser can't detect MIME type
    'application/octet-stream',
  ];

  // Allowed file extensions as fallback validation
  const allowedExtensions = [
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.html', '.rtf',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.svg', '.ico',
    // Design files
    '.psd', '.ai', '.sketch', '.fig', '.xd',
    // Video files
    '.mp4', '.webm', '.ogg', '.mov', '.avi',
  ];

  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Accept if MIME type is in whitelist OR extension is allowed
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} with extension ${fileExtension} not allowed`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for file upload with optional thumbnail
export const uploadWithThumbnail = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Middleware for multiple file upload
export const uploadMultiple = upload.array('files', 10); // Max 10 files

// Audio upload for voice transcription
const audioStorage = multer.memoryStorage();

const audioFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedAudioTypes = [
    'audio/webm',
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/m4a',
  ];

  if (allowedAudioTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error(`Audio type ${file.mimetype} not allowed`));
  }
};

export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio
  },
}).single('audio');
