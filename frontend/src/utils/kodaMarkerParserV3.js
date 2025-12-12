/**
 * @file kodaMarkerParser.ts
 * @description Frontend marker parser for parsing backend markers (DOC, LOAD_MORE) embedded in text.
 *              Parses text into segments of plain text and marker objects with extracted metadata.
 *              Supports DOC and LOAD_MORE markers with robust error handling and extensibility.
 */

import { strict as assert } from 'assert';

/**
 * Marker types supported by the parser.
 */
export type MarkerType = 'DOC' | 'LOAD_MORE';

/**
 * Base interface for a parsed marker.
 */
export interface BaseMarker {
  type: MarkerType;
  raw: string; // Raw marker string including delimiters
  metadata: Record<string, string>; // Extracted key-value metadata
}

/**
 * DOC marker interface.
 */
export interface DocMarker extends BaseMarker {
  type: 'DOC';
  metadata: {
    id: string;
    title?: string;
    [key: string]: string | undefined;
  };
}

/**
 * LOAD_MORE marker interface.
 */
export interface LoadMoreMarker extends BaseMarker {
  type: 'LOAD_MORE';
  metadata: {
    count: number;
    cursor?: string;
    [key: string]: string | number | undefined;
  };
}

/**
 * Union type for all supported markers.
 */
export type Marker = DocMarker | LoadMoreMarker;

/**
 * Segment type representing either plain text or a marker.
 */
export type Segment = 
  | { type: 'text'; content: string }
  | { type: 'marker'; marker: Marker };

/**
 * Parser class for extracting markers from text.
 */
export class KodaMarkerParser {
  // Regex to match markers of the form [[MARKER_TYPE key1=value1 key2="value 2"]]
  // Supports quoted values with spaces and escaped quotes.
  private static readonly MARKER_REGEX = /\[\[\s*(\w+)((?:\s+\w+=(?:"(?:[^"\\]|\\.)*"|\S+))*)\s*\]\]/g;

  // Regex to match individual key=value pairs inside a marker
  // Supports quoted values with escaped quotes and unquoted values without spaces.
  private static readonly KEY_VALUE_REGEX = /(\w+)=("((?:[^"\\]|\\.)*)"|[^\s"]+)/g;

  /**
   * Parses the input text and returns an array of segments.
   * Each segment is either plain text or a marker object with extracted metadata.
   * 
   * @param input - The input string containing text and embedded markers.
   * @returns Array of segments representing text and markers.
   * @throws {Error} Throws if marker metadata is invalid or required fields are missing.
   */
  public static parse(input: string): Segment[] {
    if (typeof input !== 'string') {
      throw new TypeError(`Input must be a string, received ${typeof input}`);
    }

    const segments: Segment[] = [];
    let lastIndex = 0;

    // Use global regex to find all markers
    const regex = KodaMarkerParser.MARKER_REGEX;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const [rawMarker, markerTypeRaw, metadataRaw] = match;
      const markerStart = match.index;
      const markerEnd = regex.lastIndex;

      // Push preceding text segment if any
      if (markerStart > lastIndex) {
        const textSegment = input.slice(lastIndex, markerStart);
        segments.push({ type: 'text', content: textSegment });
      }

      const markerType = markerTypeRaw.toUpperCase();

      try {
        const metadata = KodaMarkerParser.parseMetadata(metadataRaw);

        // Validate and create marker object based on type
        let marker: Marker;
        switch (markerType) {
          case 'DOC':
            marker = KodaMarkerParser.createDocMarker(rawMarker, metadata);
            break;
          case 'LOAD_MORE':
            marker = KodaMarkerParser.createLoadMoreMarker(rawMarker, metadata);
            break;
          default:
            // Unknown marker types are treated as plain text
            segments.push({ type: 'text', content: rawMarker });
            lastIndex = markerEnd;
            continue;
        }

        segments.push({ type: 'marker', marker });
      } catch (err) {
        // If parsing marker fails, treat the entire raw marker as plain text to avoid breaking UI
        console.error(`Failed to parse marker "${rawMarker}": ${(err as Error).message}`);
        segments.push({ type: 'text', content: rawMarker });
      }

      lastIndex = markerEnd;
    }

    // Push remaining text after last marker
    if (lastIndex < input.length) {
      segments.push({ type: 'text', content: input.slice(lastIndex) });
    }

    return segments;
  }

  /**
   * Parses the metadata string inside a marker into a key-value object.
   * Supports quoted values with escaped characters.
   * 
   * Example input: ' id=123 title="My Document" '
   * Output: { id: '123', title: 'My Document' }
   * 
   * @param metadataRaw - Raw metadata string inside the marker.
   * @returns Parsed metadata as key-value pairs.
   * @throws {Error} Throws if metadata parsing fails.
   */
  private static parseMetadata(metadataRaw: string): Record<string, string> {
    const metadata: Record<string, string> = {};
    const regex = KodaMarkerParser.KEY_VALUE_REGEX;
    let match: RegExpExecArray | null;

    // Reset lastIndex in case of global regex reuse
    regex.lastIndex = 0;

    while ((match = regex.exec(metadataRaw)) !== null) {
      const key = match[1];
      let rawValue = match[2];

      // If value is quoted, remove quotes and unescape
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        rawValue = rawValue.slice(1, -1);
        rawValue = rawValue.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }

      if (key in metadata) {
        throw new Error(`Duplicate metadata key "${key}" in marker metadata.`);
      }

      metadata[key] = rawValue;
    }

    return metadata;
  }

  /**
   * Creates a DOC marker object from raw marker string and metadata.
   * Validates required fields.
   * 
   * @param raw - Raw marker string including delimiters.
   * @param metadata - Parsed metadata key-value pairs.
   * @returns DocMarker object.
   * @throws {Error} Throws if required fields are missing or invalid.
   */
  private static createDocMarker(raw: string, metadata: Record<string, string>): DocMarker {
    const id = metadata.id;
    if (!id) {
      throw new Error(`DOC marker missing required "id" field.`);
    }

    // Optional title field
    const title = metadata.title;

    // Return marker with all metadata preserved
    return {
      type: 'DOC',
      raw,
      metadata: {
        id,
        title,
        ...metadata,
      },
    };
  }

  /**
   * Creates a LOAD_MORE marker object from raw marker string and metadata.
   * Validates required fields and converts types.
   * 
   * @param raw - Raw marker string including delimiters.
   * @param metadata - Parsed metadata key-value pairs.
   * @returns LoadMoreMarker object.
   * @throws {Error} Throws if required fields are missing or invalid.
   */
  private static createLoadMoreMarker(raw: string, metadata: Record<string, string>): LoadMoreMarker {
    const countStr = metadata.count;
    if (!countStr) {
      throw new Error(`LOAD_MORE marker missing required "count" field.`);
    }

    const count = Number(countStr);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`LOAD_MORE marker "count" must be a non-negative integer, got "${countStr}".`);
    }

    const cursor = metadata.cursor;

    return {
      type: 'LOAD_MORE',
      raw,
      metadata: {
        count,
        cursor,
        ...metadata,
      },
    };
  }
}

