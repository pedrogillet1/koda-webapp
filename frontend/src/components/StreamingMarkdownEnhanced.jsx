/**
 * StreamingMarkdown.ENHANCED.jsx
 *
 * Enhanced StreamingMarkdown component that parses streaming markdown content,
 * detects special markers (DOC and LOAD_MORE), and renders them as interactive components.
 *
 * It uses `kodaMarkerParser` to split content into segments of text and markers.
 * Text segments are rendered as markdown, while markers render corresponding UI elements.
 *
 * The component also determines if it is rendered inside a list context to adjust
 * the rendering of document buttons accordingly.
 */

import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { kodaMarkerParser, MarkerType, Marker } from './kodaMarkerParser'; // Assume this is a utility parser module
import { Button } from './Button'; // Generic Button component
import { DocumentButton } from './DocumentButton'; // Specialized button for DOC markers
import { LoadMoreButton } from './LoadMoreButton'; // Specialized button for LOAD_MORE markers

/**
 * Props for StreamingMarkdownEnhanced component.
 * @typedef {Object} StreamingMarkdownEnhancedProps
 * @property {string} content - The streaming markdown content to render.
 * @property {(docId: string) => void} onDocumentClick - Callback when a DOC marker button is clicked.
 * @property {() => void} onLoadMoreClick - Callback when LOAD_MORE marker button is clicked.
 * @property {boolean} [inList] - Optional flag indicating if the component is rendered inside a list.
 */

/**
 * StreamingMarkdownEnhanced component.
 *
 * Parses streaming markdown content, detects DOC and LOAD_MORE markers,
 * and renders them as interactive components alongside markdown text.
 *
 * @param {StreamingMarkdownEnhancedProps} props
 */
export function StreamingMarkdownEnhanced({
  content,
  onDocumentClick,
  onLoadMoreClick,
  inList = false,
}) {
  /**
   * Parses the content into segments of text and markers.
   * Uses useMemo to avoid re-parsing on every render unless content changes.
   */
  const segments = useMemo(() => {
    try {
      return kodaMarkerParser(content);
    } catch (error) {
      // Log error and fallback to rendering entire content as markdown
      // This ensures the UI does not break on parse errors.
      // eslint-disable-next-line no-console
      console.error('Error parsing content with kodaMarkerParser:', error);
      return [{ type: 'text', content }];
    }
  }, [content]);

  /**
   * Renders a single segment, either text or marker.
   *
   * @param {Marker | { type: 'text'; content: string }} segment
   * @param {number} index
   * @returns {JSX.Element}
   */
  const renderSegment = useCallback(
    (segment, index) => {
      if (segment.type === 'text') {
        // Render markdown text with GitHub Flavored Markdown and raw HTML support
        return (
          <ReactMarkdown
            key={`text-${index}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // Customize rendering of list items to pass down inList context if needed
              li: ({ node, ...props }) => <li {...props} />,
            }}
          >
            {segment.content}
          </ReactMarkdown>
        );
      }

      // Marker rendering
      switch (segment.markerType) {
        case MarkerType.DOC:
          // DOC marker: render DocumentButton with docId and inList context
          if (!segment.docId) {
            // Defensive: docId is required for DOC markers
            // eslint-disable-next-line no-console
            console.warn('DOC marker missing docId:', segment);
            return null;
          }
          return (
            <DocumentButton
              key={`doc-${index}`}
              docId={segment.docId}
              inList={inList}
              onClick={() => onDocumentClick(segment.docId)}
            />
          );

        case MarkerType.LOAD_MORE:
          // LOAD_MORE marker: render LoadMoreButton
          return (
            <LoadMoreButton
              key={`loadmore-${index}`}
              onClick={onLoadMoreClick}
            />
          );

        default:
          // Unknown marker type: render nothing or fallback
          // eslint-disable-next-line no-console
          console.warn('Unknown marker type encountered:', segment.markerType);
          return null;
      }
    },
    [inList, onDocumentClick, onLoadMoreClick]
  );

  return (
    <div className="streaming-markdown-enhanced" data-in-list={inList}>
      {segments.map(renderSegment)}
    </div>
  );
}

StreamingMarkdownEnhanced.propTypes = {
  content: PropTypes.string.isRequired,
  onDocumentClick: PropTypes.func.isRequired,
  onLoadMoreClick: PropTypes.func.isRequired,
  inList: PropTypes.bool,
};

StreamingMarkdownEnhanced.defaultProps = {
  inList: false,
};
