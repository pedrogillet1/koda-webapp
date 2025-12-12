/**
 * Marker Utilities - Production V3
 * 
 * Unified marker format for backend/frontend contract:
 * {{DOC::id=docId::name="filename"::ctx=text}}
 * {{LOAD_MORE::total=50::shown=10::remaining=40}}
 * 
 * Rules:
 * - Markdown-safe (no < > angle brackets)
 * - Deterministic regex parsing
 * - Survives streaming chunk boundaries
 * - Safe encoding for special characters
 */

export interface DocMarkerData {
  id: string;
  name: string;
  ctx: 'list' | 'text';
}

export interface LoadMoreMarkerData {
  total: number;
  shown: number;
  remaining: number;
}

export type MarkerData = DocMarkerData | LoadMoreMarkerData;

/**
 * Encode a string value for use in marker
 * Handles quotes, colons, and special characters
 */
export function encodeMarkerValue(value: string): string {
  // URL encode to handle all special characters safely
  return encodeURIComponent(value);
}

/**
 * Decode a marker value
 */
export function decodeMarkerValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    // Fallback to original if decode fails
    return value;
  }
}

/**
 * Create a document marker
 * Format: {{DOC::id=docId::name="filename"::ctx=text}}
 */
export function createDocMarker(data: DocMarkerData): string {
  const encodedName = encodeMarkerValue(data.name);
  return `{{DOC::id=${data.id}::name="${encodedName}"::ctx=${data.ctx}}}`;
}

/**
 * Create a load more marker
 * Format: {{LOAD_MORE::total=50::shown=10::remaining=40}}
 */
export function createLoadMoreMarker(data: LoadMoreMarkerData): string {
  return `{{LOAD_MORE::total=${data.total}::shown=${data.shown}::remaining=${data.remaining}}}`;
}

/**
 * Parse a document marker
 * Returns null if invalid
 */
export function parseDocMarker(marker: string): DocMarkerData | null {
  // Match: {{DOC::id=...::name="..."::ctx=...}}
  const regex = /^{{DOC::id=([^:]+)::name="([^"]+)"::ctx=(list|text)}}$/;
  const match = marker.match(regex);
  
  if (!match) {
    return null;
  }
  
  return {
    id: match[1],
    name: decodeMarkerValue(match[2]),
    ctx: match[3] as 'list' | 'text',
  };
}

/**
 * Parse a load more marker
 * Returns null if invalid
 */
export function parseLoadMoreMarker(marker: string): LoadMoreMarkerData | null {
  // Match: {{LOAD_MORE::total=...::shown=...::remaining=...}}
  const regex = /^{{LOAD_MORE::total=(\d+)::shown=(\d+)::remaining=(\d+)}}$/;
  const match = marker.match(regex);
  
  if (!match) {
    return null;
  }
  
  return {
    total: parseInt(match[1], 10),
    shown: parseInt(match[2], 10),
    remaining: parseInt(match[3], 10),
  };
}

/**
 * Check if a string contains any markers
 */
export function containsMarkers(text: string): boolean {
  return /{{(DOC|LOAD_MORE)::[^}]+}}/.test(text);
}

/**
 * Check if a string has incomplete markers
 * (useful for streaming detection)
 */
export function hasIncompleteMarkers(text: string): boolean {
  // Check for opening {{ without closing }}
  const openCount = (text.match(/{{/g) || []).length;
  const closeCount = (text.match(/}}/g) || []).length;
  
  return openCount > closeCount;
}

/**
 * Extract all markers from text
 * Returns array of marker strings
 */
export function extractMarkers(text: string): string[] {
  const regex = /{{(DOC|LOAD_MORE)::[^}]+}}/g;
  return text.match(regex) || [];
}

/**
 * Validate that a marker is complete and parseable
 */
export function isValidMarker(marker: string): boolean {
  if (marker.startsWith('{{DOC::')) {
    return parseDocMarker(marker) !== null;
  }
  
  if (marker.startsWith('{{LOAD_MORE::')) {
    return parseLoadMoreMarker(marker) !== null;
  }
  
  return false;
}

/**
 * Strip all markers from text
 * Useful for plain text export
 */
export function stripMarkers(text: string): string {
  return text.replace(/{{(DOC|LOAD_MORE)::[^}]+}}/g, (match) => {
    // For DOC markers, extract and return just the filename
    const docData = parseDocMarker(match);
    if (docData) {
      return docData.name;
    }
    
    // For LOAD_MORE markers, return empty string
    return '';
  });
}

/**
 * Count markers in text
 */
export function countMarkers(text: string): { doc: number; loadMore: number; total: number } {
  const markers = extractMarkers(text);
  
  const doc = markers.filter(m => m.startsWith('{{DOC::')).length;
  const loadMore = markers.filter(m => m.startsWith('{{LOAD_MORE::')).length;
  
  return {
    doc,
    loadMore,
    total: doc + loadMore,
  };
}

/**
 * Validate markers are not in unsafe locations
 * Returns array of issues found
 */
export function validateMarkerLocations(text: string): string[] {
  const issues: string[] = [];
  const markers = extractMarkers(text);
  
  // Check for markers inside code blocks
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  for (const block of codeBlocks) {
    if (containsMarkers(block)) {
      issues.push('Marker found inside code block');
    }
  }
  
  // Check for markers inside inline code
  const inlineCode = text.match(/`[^`]+`/g) || [];
  for (const code of inlineCode) {
    if (containsMarkers(code)) {
      issues.push('Marker found inside inline code');
    }
  }
  
  // Check for markers inside URLs
  const urls = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  for (const url of urls) {
    if (containsMarkers(url)) {
      issues.push('Marker found inside markdown link');
    }
  }
  
  return issues;
}

/**
 * Get safe insertion points for markers
 * Returns indices where markers can be safely inserted
 * (not inside code blocks, inline code, or URLs)
 */
export function getSafeInsertionPoints(text: string): number[] {
  const unsafe: Array<[number, number]> = [];
  
  // Mark code blocks as unsafe
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    unsafe.push([match.index, match.index + match[0].length]);
  }
  
  // Mark inline code as unsafe
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    unsafe.push([match.index, match.index + match[0].length]);
  }
  
  // Mark URLs as unsafe
  const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = urlRegex.exec(text)) !== null) {
    unsafe.push([match.index, match.index + match[0].length]);
  }
  
  // Find safe points (not in any unsafe range)
  const safePoints: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const isSafe = !unsafe.some(([start, end]) => i >= start && i < end);
    if (isSafe) {
      safePoints.push(i);
    }
  }
  
  return safePoints;
}

export default {
  encodeMarkerValue,
  decodeMarkerValue,
  createDocMarker,
  createLoadMoreMarker,
  parseDocMarker,
  parseLoadMoreMarker,
  containsMarkers,
  hasIncompleteMarkers,
  extractMarkers,
  isValidMarker,
  stripMarkers,
  countMarkers,
  validateMarkerLocations,
  getSafeInsertionPoints,
};
