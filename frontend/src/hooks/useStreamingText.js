import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for smooth streaming text display (like ChatGPT)
 * Animates new chunks character-by-character while preserving already-shown text
 * @param {string} fullText - The complete text to display (updated incrementally as chunks arrive)
 * @param {number} speed - Speed in milliseconds per character (default: 8ms for fast smooth effect)
 * @returns {object} - { displayedText, isStreaming }
 */
const useStreamingText = (fullText, speed = 8) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const displayedLengthRef = useRef(0);
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  useEffect(() => {
    if (!fullText) {
      setDisplayedText('');
      setIsStreaming(false);
      displayedLengthRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // New text arrived - start/continue animation
    if (fullText.length > displayedLengthRef.current) {
      setIsStreaming(true);

      const animate = () => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

        // Update based on speed (throttle to avoid too-fast rendering)
        if (timeSinceLastUpdate >= speed) {
          if (displayedLengthRef.current < fullText.length) {
            // Show one more character
            displayedLengthRef.current += 1;
            setDisplayedText(fullText.slice(0, displayedLengthRef.current));
            lastUpdateTimeRef.current = now;
          } else {
            // Finished animating
            setIsStreaming(false);
            return;
          }
        }

        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // Start animation if not already running
      if (!animationFrameRef.current) {
        lastUpdateTimeRef.current = Date.now();
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [fullText, speed]);

  return { displayedText, isStreaming };
};

export default useStreamingText;
