/**
 * Preview Cache Service
 * Caches document preview URLs to avoid re-downloading the same files
 * Automatically evicts old entries when cache is full
 */
class PreviewCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 50; // Cache up to 50 documents
  }

  /**
   * Get cached preview URL for a document
   * @param {string} docId - Document ID
   * @returns {string|undefined} - Cached URL or undefined
   */
  get(docId) {
    return this.cache.get(docId);
  }

  /**
   * Cache a preview URL for a document
   * @param {string} docId - Document ID
   * @param {string} url - Preview URL (blob URL or signed URL)
   */
  set(docId, url) {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      const oldUrl = this.cache.get(firstKey);

      // Revoke blob URL to free memory (only if it's a blob URL)
      if (oldUrl && oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }

      this.cache.delete(firstKey);
    }

    this.cache.set(docId, url);
  }

  /**
   * Check if a document is cached
   * @param {string} docId - Document ID
   * @returns {boolean}
   */
  has(docId) {
    return this.cache.has(docId);
  }

  /**
   * Remove a document from cache
   * @param {string} docId - Document ID
   */
  remove(docId) {
    const url = this.cache.get(docId);
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    this.cache.delete(docId);
  }

  /**
   * Clear all cached previews
   */
  clear() {
    this.cache.forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: `${this.cache.size}/${this.maxSize}`
    };
  }
}

// Export singleton instance
export const previewCache = new PreviewCache();
