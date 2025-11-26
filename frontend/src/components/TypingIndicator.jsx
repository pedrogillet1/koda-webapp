import React from 'react';
import './TypingIndicator.css';
import sphere from '../assets/sphere.svg';

export default function TypingIndicator({ userName = 'Koda', stage = null }) {
  return (
    <div className="typing-indicator-container">
      <div className="typing-indicator-avatar">
        <img src={sphere} alt="Koda" />
      </div>
      <div className="typing-indicator-content">
        <div className="typing-indicator-text">
          {stage?.message || `${userName} is thinking...`}
        </div>
        <div className="typing-indicator-dots">
          <span className="dot dot-1"></span>
          <span className="dot dot-2"></span>
          <span className="dot dot-3"></span>
        </div>
      </div>
    </div>
  );
}
