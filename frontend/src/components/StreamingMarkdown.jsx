import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import './StreamingAnimation.css';
import './SpacingUtilities.css';
import './MarkdownStyles.css';

/**
 * ✨ StreamingMarkdown Component
 *
 * Renders markdown with ChatGPT-style streaming animation.
 * Handles character-by-character rendering while maintaining proper markdown structure.
 *
 * Features:
 * - Real-time markdown parsing during streaming
 * - Smooth rendering of incomplete markdown
 * - Blinking cursor at the end of streamed text
 * - Custom component styling
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
  className = ''
}) => {

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

    // Bold text
    strong: ({ node, ...props }) => (
      <strong style={{ fontWeight: 600 }} {...props} />
    ),

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

  // Merge custom components with defaults
  const components = { ...defaultComponents, ...customComponents };

  // Normalize content to remove excessive whitespace that causes large gaps
  const normalizedContent = useMemo(() => {
    if (!content) return '';
    return content
      .replace(/\n{3,}/g, '\n\n')  // 3+ newlines → 2 (single paragraph break)
      .replace(/[ \t]+$/gm, '')    // Remove trailing whitespace
      .replace(/\r\n/g, '\n');     // Consistent line endings
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
      className={`markdown-preview-container ${isStreaming ? 'streaming' : ''} ${className}`}
      style={{
        color: '#171717',
        fontSize: '14px',
        fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '400',
        lineHeight: '1.4',
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
