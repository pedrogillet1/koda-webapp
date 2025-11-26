import { useEffect } from 'react';

export default function useKeyboardShortcuts({
  onSendMessage,
  onNewConversation,
  onCopyLastResponse,
  onCancelGeneration,
  onShowShortcuts,
  onEditLastMessage,
  onToggleSidebar,
  onFocusSearch,
  isEnabled = true
}) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Don't trigger shortcuts when typing in inputs (except specific ones)
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

      // Cmd/Ctrl + Enter: Send message (works even in textarea)
      if (cmdKey && e.key === 'Enter') {
        e.preventDefault();
        onSendMessage?.();
        return;
      }

      // Cmd/Ctrl + K: Focus search
      if (cmdKey && e.key === 'k') {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      // Cmd/Ctrl + N: New conversation
      if (cmdKey && e.key === 'n') {
        e.preventDefault();
        onNewConversation?.();
        return;
      }

      // Cmd/Ctrl + Shift + C: Copy last response
      if (cmdKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        onCopyLastResponse?.();
        return;
      }

      // Esc: Cancel generation
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelGeneration?.();
        return;
      }

      // Cmd/Ctrl + /: Show shortcuts
      if (cmdKey && e.key === '/') {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      // ↑ in empty input: Edit last message
      if (e.key === 'ArrowUp' && isInputFocused && e.target.value === '') {
        e.preventDefault();
        onEditLastMessage?.();
        return;
      }

      // Cmd/Ctrl + Shift + L: Toggle sidebar
      if (cmdKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    onSendMessage,
    onNewConversation,
    onCopyLastResponse,
    onCancelGeneration,
    onShowShortcuts,
    onEditLastMessage,
    onToggleSidebar,
    onFocusSearch,
    isEnabled
  ]);
}
