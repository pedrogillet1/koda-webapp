import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LoadMoreButton Component
 *
 * Displays a "See all X" link to navigate to the documents page
 * Styled as black bold text (like document names) - no button styling
 */

const LoadMoreButton = ({ loadMoreData, onClick, style = {} }) => {
  const navigate = useNavigate();

  const { totalCount } = loadMoreData;

  const handleClick = (e) => {
    e.preventDefault();
    // Navigate to documents page to see all files
    navigate('/documents');
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'block',
        marginTop: '4px',
        paddingLeft: '40px',
        color: '#303030',
        fontWeight: 600,
        fontSize: 'inherit',
        textDecoration: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style
      }}
    >
      See all {totalCount}
    </div>
  );
};

export default LoadMoreButton;
