/**
 * LoadMoreButton.tsx
 *
 * A reusable React component that renders a "Load more documents" button for paginated document lists.
 * It displays the number of currently shown documents and the total available documents.
 * When clicked, it triggers a callback to load more documents.
 *
 * This component is fully typed with TypeScript and includes comprehensive error handling and accessibility features.
 */

import React, { MouseEvent } from 'react';

interface LoadMoreButtonProps {
  /**
   * The number of documents currently displayed.
   */
  shownCount: number;

  /**
   * The total number of documents available.
   */
  totalCount: number;

  /**
   * The number of documents to load when the button is clicked.
   */
  loadCount: number;

  /**
   * Callback function invoked when the "Load more" button is clicked.
   * Should trigger loading additional documents.
   */
  onLoadMore: () => void;

  /**
   * Optional boolean to disable the button (e.g., while loading).
   */
  disabled?: boolean;

  /**
   * Optional className to allow custom styling.
   */
  className?: string;
}

/**
 * LoadMoreButton Component
 *
 * Displays a button to load more documents in a paginated list.
 * Shows the current count of displayed documents and the total available.
 *
 * @param {LoadMoreButtonProps} props - Component props
 * @returns {JSX.Element | null} The rendered LoadMoreButton component or null if no more documents to load
 */
const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  shownCount,
  totalCount,
  loadCount,
  onLoadMore,
  disabled = false,
  className = '',
}) => {
  // Validate props to avoid inconsistent UI states
  if (shownCount < 0 || totalCount < 0 || loadCount <= 0) {
    console.error(
      `LoadMoreButton: Invalid prop values detected. shownCount=${shownCount}, totalCount=${totalCount}, loadCount=${loadCount}`
    );
    // Do not render the button if props are invalid
    return null;
  }

  // If all documents are already shown, do not render the button
  if (shownCount >= totalCount) {
    return (
      <p
        className={`load-more-info ${className}`}
        aria-live="polite"
        aria-atomic="true"
      >
        Showing {shownCount} of {totalCount} documents.
      </p>
    );
  }

  // Calculate how many documents will be loaded on next click
  const remaining = totalCount - shownCount;
  const nextLoadCount = Math.min(loadCount, remaining);

  /**
   * Handles the click event on the Load More button.
   * Prevents default behavior and calls the onLoadMore callback.
   *
   * @param {MouseEvent<HTMLButtonElement>} event - The click event
   */
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    try {
      onLoadMore();
    } catch (error) {
      // Log error but do not crash the app
      console.error('LoadMoreButton: Error during onLoadMore callback', error);
    }
  };

  return (
    <div className={`load-more-container ${className}`}>
      <p
        className="load-more-info"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        Showing {shownCount} of {totalCount} documents.
      </p>
      <button
        type="button"
        className="load-more-button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={`Load ${nextLoadCount} more documents`}
      >
        Load {nextLoadCount} more document{nextLoadCount > 1 ? 's' : ''}
      </button>
      <style jsx>{`
        .load-more-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1rem 0;
          font-family: Arial, sans-serif;
        }
        .load-more-info {
          font-size: 0.9rem;
          color: #555;
          margin: 0;
        }
        .load-more-button {
          background-color: #007bff;
          border: none;
          color: white;
          padding: 0.5rem 1rem;
          font-size: 1rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
        }
        .load-more-button:disabled {
          background-color: #a0a0a0;
          cursor: not-allowed;
        }
        .load-more-button:not(:disabled):hover,
        .load-more-button:not(:disabled):focus {
          background-color: #0056b3;
          outline: none;
        }
      `}</style>
    </div>
  );
};

export default LoadMoreButton;
