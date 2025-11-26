/* eslint-disable no-restricted-globals */
// hash.worker.js - Web Worker for non-blocking SHA-256 hash calculation
self.onmessage = async (event) => {
  const { file } = event.data;

  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    self.postMessage({ hash: hashHex });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
/* eslint-enable no-restricted-globals */
