import React from 'react';
import folderIcon from '../assets/folder_icon.svg';

/**
 * CategoryIcon Component
 * Renders either a folder SVG icon or an emoji based on the category's emoji value
 *
 * @param {string} emoji - The emoji or special identifier ('__FOLDER_SVG__')
 * @param {object} style - Optional inline styles to apply
 * @param {string} className - Optional CSS class name
 */
const CategoryIcon = ({ emoji, style = {}, className = '' }) => {
  if (emoji === '__FOLDER_SVG__') {
    return (
      <img
        src={folderIcon}
        alt="Folder"
        className={className}
        style={{
          width: '1em',
          height: '1em',
          objectFit: 'contain',
          ...style
        }}
      />
    );
  }

  return <span className={className} style={style}>{emoji || '📁'}</span>;
};

export default CategoryIcon;
