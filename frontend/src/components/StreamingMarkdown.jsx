import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import './StreamingAnimation.css';
import './SpacingUtilities.css';
import './MarkdownStyles.css';
import { ClickableDocumentName, isDocumentName } from './ClickableDocumentName';

/**
 * ✨ StreamingMarkdown Component (with Koda Markdown Contract)
 *
 * Renders markdown with ChatGPT-style streaming animation.
 * Implements the frontend side of the Koda Markdown Contract:
 * - Chat-sized headings (not huge H1s)
 * - Tight lists (no gaps between bullets)
 * - Clickable document names
 * - UTF-8 encoding fixes
 *
 * Features:
 * - Real-time markdown parsing during streaming
 * - Smooth rendering of incomplete markdown
 * - Blinking cursor at the end of streamed text
 * - Custom component styling
 * - Uses .koda-markdown CSS class for contract compliance
 *
 * @param {string} content - The markdown content to render (can be incomplete during streaming)
 * @param {boolean} isStreaming - Whether content is currently being streamed
 * @param {object} customComponents - Custom ReactMarkdown components
 * @param {string} className - Additional CSS classes
 */
const StreamingMarkdown = ({
  content,
  isStreaming = false,
  customComponents = {},
  className = '',
  documents = [],
  onOpenPreview
}) => {

  // Build document name → document ID map for clickable documents
  const documentMap = useMemo(() => {
    const map = new Map();
    documents.forEach(doc => {
      const name = doc.name || doc.filename || doc.documentName || '';
      const id = doc.id || doc.documentId || '';
      if (name && id) {
        const normalized = name.toLowerCase().replace(/[_-]/g, ' ');
        map.set(normalized, id);
        map.set(name.toLowerCase(), id);
      }
    });
    return map;
  }, [documents]);

  // Default custom components for better styling
  const defaultComponents = {
    // Links
    a: ({ node, ...props }) => (
      <a
        {...props}
        style={{
          color: '#10a37f',
          textDecoration: 'underline',
          cursor: 'pointer'
        }}
        target="_blank"
        rel="noopener noreferrer"
      />
    ),

    // Tables
    table: ({ node, ...props }) => (
      <table className="markdown-table" {...props} />
    ),
    thead: ({ node, ...props }) => <thead {...props} />,
    tbody: ({ node, ...props }) => <tbody {...props} />,
    tr: ({ node, ...props }) => <tr {...props} />,
    th: ({ node, ...props }) => (
      <th
        style={{
          padding: '8px 12px',
          borderBottom: '2px solid #e5e7eb',
          textAlign: 'left',
          fontWeight: '600',
          backgroundColor: '#f9fafb'
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }) => (
      <td
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb'
        }}
        {...props}
      />
    ),

    // Headings - no inline margins, let CSS control spacing
    h1: ({ node, ...props }) => (
      <h1 className="markdown-h1" {...props} />
    ),
    h2: ({ node, ...props }) => (
      <h2 className="markdown-h2" {...props} />
    ),
    h3: ({ node, ...props }) => (
      <h3 className="markdown-h3" {...props} />
    ),
    h4: ({ node, ...props }) => <h4 className="markdown-h4" {...props} />,
    h5: ({ node, ...props}) => <h5 className="markdown-h5" {...props} />,
    h6: ({ node, ...props }) => <h6 className="markdown-h6" {...props} />,

    // Paragraphs - no inline margins, let CSS control spacing
    p: ({ node, ...props }) => (
      <p className="markdown-paragraph" {...props} />
    ),

    // Bold text - with clickable document name support
    strong: ({ node, children, ...props }) => {
      // Get text content from children
      const textContent = React.Children.toArray(children)
        .filter(child => typeof child === 'string')
        .join('');

      // Check if this is a document name or "See all" link
      if (isDocumentName(textContent) || textContent.toLowerCase().includes('see all')) {
        const normalizedName = textContent.toLowerCase().replace(/[_-]/g, ' ');
        const documentId = documentMap.get(normalizedName) || documentMap.get(textContent.toLowerCase());

        return (
          <ClickableDocumentName
            documentName={textContent}
            documentId={documentId}
            onOpenPreview={onOpenPreview}
          />
        );
      }

      // Default bold rendering
      return <strong style={{ fontWeight: 600 }} {...props}>{children}</strong>;
    },

    // Lists - no inline margins, let CSS control spacing
    ul: ({ node, ...props }) => (
      <ul className="markdown-ul" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="markdown-ol" {...props} />
    ),
    li: ({ node, ...props }) => (
      <li className="markdown-li" {...props} />
    ),

    // Code - keep non-margin styles
    code: ({ node, inline, ...props }) =>
      inline ? (
        <code className="markdown-inline-code" {...props} />
      ) : (
        <code className="markdown-code-block" {...props} />
      ),

    // Blockquotes
    blockquote: ({ node, ...props }) => (
      <blockquote className="markdown-blockquote" {...props} />
    ),

    // Horizontal rules
    hr: ({ node, ...props }) => (
      <hr className="markdown-hr" {...props} />
    ),

    // Images
    img: ({ node, ...props }) => (
      <img
        className="markdown-image"
        {...props}
        alt={props.alt || ''}
      />
    ),
  };

  // Merge custom components with defaults - memoized to include document context
  const components = useMemo(() => {
    return { ...defaultComponents, ...customComponents };
  }, [documentMap, onOpenPreview, customComponents]);

  // Clean content: normalize whitespace and fix UTF-8 encoding issues
  // Per Koda Markdown Contract: max 2 newlines, fix Portuguese character encoding
  const normalizedContent = useMemo(() => {
    if (!content) return '';

    let cleaned = content;

    // Fix UTF-8 encoding issues (VocÃª → Você) - common Portuguese character encoding
    cleaned = cleaned
      .replace(/Ã§/g, 'ç')
      .replace(/Ã£/g, 'ã')
      .replace(/Ã©/g, 'é')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã­/g, 'í')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã /g, 'à')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã‚/g, 'Â')
      .replace(/Ã€/g, 'À')
      .replace(/Ã‰/g, 'É');

    // Normalize whitespace per Koda Markdown Contract
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n')  // 3+ newlines → 2 (max 2 per contract)
      .replace(/[ \t]+$/gm, '')    // Remove trailing whitespace
      .replace(/\r\n/g, '\n');     // Consistent line endings

    return cleaned.trim();
  }, [content]);

  // Memoize the markdown rendering for performance
  const renderedMarkdown = useMemo(() => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {normalizedContent}
      </ReactMarkdown>
    );
  }, [normalizedContent, components]);

  return (
    <div
      className={`koda-markdown markdown-preview-container ${isStreaming ? 'streaming' : ''} ${className}`}
      style={{
        color: '#171717',
        fontSize: '14px',
        fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '400',
        lineHeight: '1.6',
        width: '100%',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}
    >
      {renderedMarkdown}
      {isStreaming && (
        <span className="streaming-cursor" aria-hidden="true" />
      )}
    </div>
  );
};

export default StreamingMarkdown;
