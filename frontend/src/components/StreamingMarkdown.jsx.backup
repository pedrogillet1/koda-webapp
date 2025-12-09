import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './StreamingAnimation.css';

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
      <table
        className="markdown-table"
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          marginTop: '12px',
          marginBottom: '12px'
        }}
        {...props}
      />
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

    // Headings - 16px
    h1: ({ node, ...props }) => (
      <h1
        className="markdown-h1"
        style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: 0,
          marginBottom: '8px',
          lineHeight: '1.3'
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }) => (
      <h2
        className="markdown-h2"
        style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: 0,
          marginBottom: '8px',
          lineHeight: '1.4'
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }) => (
      <h3
        className="markdown-h3"
        style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: 0,
          marginTop: '12px',
          lineHeight: '1.4'
        }}
        {...props}
      />
    ),
    h4: ({ node, ...props }) => <h4 className="markdown-h4" style={{margin: 0, marginTop: '12px', fontSize: '16px', fontWeight: 600}} {...props} />,
    h5: ({ node, ...props}) => <h5 className="markdown-h5" style={{margin: 0, marginTop: '8px'}} {...props} />,
    h6: ({ node, ...props }) => <h6 className="markdown-h6" style={{margin: 0, marginTop: '8px'}} {...props} />,

    // Paragraphs - No gaps, just line breaks
    p: ({ node, ...props }) => (
      <p
        className="markdown-paragraph"
        style={{
          margin: 0,
          padding: 0,
          lineHeight: '1.5'
        }}
        {...props}
      />
    ),

    // Bold text
    strong: ({ node, ...props }) => (
      <strong style={{ fontWeight: 700 }} {...props} />
    ),

    // Lists
    ul: ({ node, ...props }) => (
      <ul
        className="markdown-ul"
        style={{
          marginTop: '8px',
          marginBottom: '8px',
          paddingLeft: '24px',
          listStyleType: 'disc'
        }}
        {...props}
      />
    ),
    ol: ({ node, ...props }) => (
      <ol
        className="markdown-ol"
        style={{
          marginTop: '8px',
          marginBottom: '8px',
          paddingLeft: '24px'
        }}
        {...props}
      />
    ),
    li: ({ node, ...props }) => (
      <li
        style={{
          marginTop: '2px',
          marginBottom: '2px',
          lineHeight: '1.5'
        }}
        {...props}
      />
    ),

    // Code
    code: ({ node, inline, ...props }) =>
      inline ? (
        <code
          className="markdown-inline-code"
          style={{
            backgroundColor: '#f3f4f6',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.9em',
            fontFamily: 'monospace'
          }}
          {...props}
        />
      ) : (
        <code
          className="markdown-code-block"
          style={{
            display: 'block',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '0.9em',
            fontFamily: 'monospace',
            overflowX: 'auto',
            marginTop: '12px',
            marginBottom: '12px'
          }}
          {...props}
        />
      ),

    // Blockquotes
    blockquote: ({ node, ...props }) => (
      <blockquote
        className="markdown-blockquote"
        style={{
          borderLeft: '4px solid #10a37f',
          paddingLeft: '16px',
          marginLeft: '0',
          marginTop: '12px',
          marginBottom: '12px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}
        {...props}
      />
    ),

    // Horizontal rules
    hr: ({ node, ...props }) => (
      <hr
        className="markdown-hr"
        style={{
          border: 'none',
          borderTop: '1px solid #e5e7eb',
          marginTop: '16px',
          marginBottom: '16px'
        }}
        {...props}
      />
    ),

    // Images
    img: ({ node, ...props }) => (
      <img
        className="markdown-image"
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          marginTop: '12px',
          marginBottom: '12px'
        }}
        {...props}
        alt={props.alt || ''}
      />
    ),
  };

  // Merge custom components with defaults
  const components = { ...defaultComponents, ...customComponents };

  // Memoize the markdown rendering for performance
  const renderedMarkdown = useMemo(() => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content, components]);

  return (
    <div
      className={`markdown-preview-container ${isStreaming ? 'streaming' : ''} ${className}`}
      style={{
        color: '#323232',
        fontSize: '16px',
        fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '500',
        lineHeight: '1.5',
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
