import React, { useEffect } from 'react';
import './KeyboardShortcutsModal.css';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { keys: [`${cmdKey}`, 'Enter'], action: 'Send message' },
    { keys: [`${cmdKey}`, 'K'], action: 'Focus search' },
    { keys: [`${cmdKey}`, 'N'], action: 'New conversation' },
    { keys: [`${cmdKey}`, 'Shift', 'C'], action: 'Copy last response' },
    { keys: ['Esc'], action: 'Cancel generation' },
    { keys: [`${cmdKey}`, '/'], action: 'Show this menu' },
    { keys: ['↑'], action: 'Edit last message (in empty input)' },
    { keys: [`${cmdKey}`, 'Shift', 'L'], action: 'Toggle sidebar' },
  ];

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcuts-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="shortcuts-list">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="shortcut-item">
              <div className="shortcut-keys">
                {shortcut.keys.map((key, i) => (
                  <React.Fragment key={i}>
                    <kbd>{key}</kbd>
                    {i < shortcut.keys.length - 1 && <span className="shortcut-plus">+</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="shortcut-action">{shortcut.action}</div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <span className="shortcuts-tip">Press <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
