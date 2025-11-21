// frontend/src/workers/encryptionWorker.js
/* eslint-disable no-restricted-globals */

/**
 * Encryption Web Worker
 * Handles all client-side encryption operations off the main thread
 * to prevent UI blocking during CPU-intensive encryption tasks
 */

self.addEventListener('message', async (event) => {
  const { type, data, id } = event.data;

  try {
    switch (type) {
      case 'extractText':
        await handleExtractText(data, id);
        break;

      case 'encryptFile':
        await handleEncryptFile(data, id);
        break;

      case 'encryptData':
        await handleEncryptData(data, id);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

/**
 * Extract text from file
 */
async function handleExtractText(data, id) {
  const { file } = data;

  // Post progress update
  self.postMessage({
    type: 'progress',
    id,
    operation: 'extractText',
    progress: 0,
    message: 'Starting text extraction...'
  });

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Extract text based on file type
    let extractedText = '';

    if (file.type.startsWith('text/')) {
      // Plain text
      const decoder = new TextDecoder();
      extractedText = decoder.decode(arrayBuffer);
    }
    // Note: PDF and DOCX extraction would require additional libraries
    // For now, we'll return empty string for those file types

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'extractText',
      progress: 100,
      message: 'Text extraction complete'
    });

    // Post result
    self.postMessage({
      type: 'result',
      id,
      operation: 'extractText',
      result: extractedText
    });

  } catch (error) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

/**
 * Encrypt file using AES-256-GCM
 */
async function handleEncryptFile(data, id) {
  const { fileBuffer, password } = data;

  // Post progress update
  self.postMessage({
    type: 'progress',
    id,
    operation: 'encryptFile',
    progress: 0,
    message: 'Starting file encryption...'
  });

  try {
    // Generate encryption key from password
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptFile',
      progress: 20,
      message: 'Deriving encryption key...'
    });

    // Derive encryption key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptFile',
      progress: 40,
      message: 'Encrypting file...'
    });

    // Generate IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt file
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      fileBuffer
    );

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptFile',
      progress: 80,
      message: 'Processing encryption result...'
    });

    // Extract auth tag (last 16 bytes of AES-GCM output)
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptFile',
      progress: 100,
      message: 'Encryption complete'
    });

    // Post result
    self.postMessage({
      type: 'result',
      id,
      operation: 'encryptFile',
      result: {
        ciphertext: ciphertext,
        salt: salt,
        iv: iv,
        authTag: authTag
      }
    });

  } catch (error) {
    throw new Error(`File encryption failed: ${error.message}`);
  }
}

/**
 * Encrypt data (string) using AES-256-GCM
 */
async function handleEncryptData(data, id) {
  const { text, password } = data;

  // Post progress update
  self.postMessage({
    type: 'progress',
    id,
    operation: 'encryptData',
    progress: 0,
    message: 'Starting data encryption...'
  });

  try {
    // Convert text to buffer
    const encoder = new TextEncoder();
    const textBuffer = encoder.encode(text);

    // Generate encryption key from password
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptData',
      progress: 30,
      message: 'Deriving encryption key...'
    });

    // Derive encryption key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptData',
      progress: 60,
      message: 'Encrypting data...'
    });

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt text
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      textBuffer
    );

    // Extract auth tag
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Convert to base64 for storage
    const ciphertextBase64 = btoa(String.fromCharCode(...ciphertext));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const authTagBase64 = btoa(String.fromCharCode(...authTag));

    // Post progress update
    self.postMessage({
      type: 'progress',
      id,
      operation: 'encryptData',
      progress: 100,
      message: 'Encryption complete'
    });

    // Post result
    self.postMessage({
      type: 'result',
      id,
      operation: 'encryptData',
      result: {
        ciphertext: ciphertextBase64,
        salt: saltBase64,
        iv: ivBase64,
        authTag: authTagBase64
      }
    });

  } catch (error) {
    throw new Error(`Data encryption failed: ${error.message}`);
  }
}

console.log('✅ Encryption Web Worker initialized');
