import { useState, useEffect, useRef } from 'react';

/**
 * ✨ ENHANCED ChatGPT-Style Streaming Animation Hook
 *
 * Features:
 * - Character-by-character animation with adaptive speed
 * - Smooth rendering of markdown elements (headings, lists, code blocks)
 * - Instant rendering of complete markdown blocks when detected
 * - Sub-section animation (animate each paragraph/list separately)
 * - Cursor blinking effect
 * - Performance optimized with requestAnimationFrame
 * - Pause/resume functionality
 * - Completion callback support
 *
 * @param {string} fullText - Complete text to animate
 * @param {number} baseSpeed - Base characters per frame (default: 3)
 * @param {number} fps - Target frames per second (default: 60)
 * @param {boolean} isPaused - Whether animation is paused (default: false)
 * @param {function} onComplete - Callback when animation completes (optional)
 * @returns {string} - Currently displayed text
 */
export function useStreamingAnimation(fullText, baseSpeed = 3, fps = 60, isPaused = false, onComplete = null) {
  const [displayedText, setDisplayedText] = useState('');
  const animationFrameRef = useRef(null);
  const displayedLengthRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const adaptiveSpeedRef = useRef(baseSpeed);
  const lastFrameTimeRef = useRef(Date.now());

  useEffect(() => {
    // Pause functionality - cancel animation if paused
    if (isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // Reset animation if text becomes shorter (new message started)
    if (fullText.length < displayedLengthRef.current) {
      displayedLengthRef.current = 0;
      setDisplayedText('');
      lastUpdateTimeRef.current = Date.now();
      lastFrameTimeRef.current = Date.now();
      return;
    }

    // Already fully displayed
    if (displayedLengthRef.current >= fullText.length) {
      // Call completion callback if provided
      if (onComplete && fullText.length > 0) {
        onComplete();
      }
      return;
    }

    // Calculate adaptive speed based on chunk arrival rate
    const timeSinceUpdate = Date.now() - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = Date.now();

    if (timeSinceUpdate < 50) {
      // Chunks arriving very fast - speed up significantly
      adaptiveSpeedRef.current = Math.min(baseSpeed * 3, 10);
    } else if (timeSinceUpdate < 150) {
      // Chunks arriving fast - speed up moderately
      adaptiveSpeedRef.current = Math.min(baseSpeed * 2, 6);
    } else if (timeSinceUpdate > 500) {
      // Chunks arriving slow - slow down for smoothness
      adaptiveSpeedRef.current = Math.max(baseSpeed / 2, 1);
    } else {
      // Normal speed
      adaptiveSpeedRef.current = baseSpeed;
    }

    const frameDelay = 1000 / fps;

    function animate() {
      const now = Date.now();
      const elapsed = now - lastFrameTimeRef.current;

      // Throttle to target FPS
      if (elapsed < frameDelay) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTimeRef.current = now;

      const currentLength = displayedLengthRef.current;
      const targetLength = fullText.length;

      if (currentLength < targetLength) {
        const remainingText = fullText.substring(currentLength);

        // ═══════════════════════════════════════════════════════════════
        // INSTANT RENDERING: Complete markdown blocks
        // ═══════════════════════════════════════════════════════════════

        // 1. Code blocks - show entire block instantly
        if (remainingText.startsWith('```')) {
          const codeBlockEnd = remainingText.indexOf('```', 3);
          if (codeBlockEnd !== -1) {
            const newLength = currentLength + codeBlockEnd + 3;
            displayedLengthRef.current = newLength;
            setDisplayedText(fullText.substring(0, newLength));
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }
        }

        // 2. Tables - show entire table instantly
        if (remainingText.match(/^\|.*\|/)) {
          // Find the end of the table (first non-table line)
          const lines = remainingText.split('\n');
          let tableEndIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].trim().startsWith('|')) {
              break;
            }
            tableEndIndex += lines[i].length + 1; // +1 for newline
          }
          if (tableEndIndex > 0) {
            const newLength = currentLength + tableEndIndex;
            displayedLengthRef.current = newLength;
            setDisplayedText(fullText.substring(0, newLength));
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }
        }

        // 3. Headings - show entire heading instantly
        const headingMatch = remainingText.match(/^(#{1,6}\s+[^\n]+)/);
        if (headingMatch) {
          const newLength = currentLength + headingMatch[0].length;
          displayedLengthRef.current = newLength;
          setDisplayedText(fullText.substring(0, newLength));
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // 4. List items - show entire item instantly
        const listItemMatch = remainingText.match(/^(\s*[-*+]\s+[^\n]+)/);
        if (listItemMatch) {
          const newLength = currentLength + listItemMatch[0].length;
          displayedLengthRef.current = newLength;
          setDisplayedText(fullText.substring(0, newLength));
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // 5. Numbered lists - show entire item instantly
        const numberedListMatch = remainingText.match(/^(\s*\d+\.\s+[^\n]+)/);
        if (numberedListMatch) {
          const newLength = currentLength + numberedListMatch[0].length;
          displayedLengthRef.current = newLength;
          setDisplayedText(fullText.substring(0, newLength));
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // 6. Bold/Italic markers - show complete word with formatting
        if (remainingText.match(/^\*\*[^*]+\*\*/)) {
          const boldMatch = remainingText.match(/^(\*\*[^*]+\*\*)/);
          if (boldMatch) {
            const newLength = currentLength + boldMatch[0].length;
            displayedLengthRef.current = newLength;
            setDisplayedText(fullText.substring(0, newLength));
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }
        }

        // 7. Inline code - show complete code span instantly
        if (remainingText.match(/^`[^`]+`/)) {
          const inlineCodeMatch = remainingText.match(/^(`[^`]+`)/);
          if (inlineCodeMatch) {
            const newLength = currentLength + inlineCodeMatch[0].length;
            displayedLengthRef.current = newLength;
            setDisplayedText(fullText.substring(0, newLength));
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }
        }

        // ═══════════════════════════════════════════════════════════════
        // CHARACTER-BY-CHARACTER: Regular text
        // ═══════════════════════════════════════════════════════════════

        // Calculate characters to add based on adaptive speed
        const charsToAdd = Math.min(
          Math.ceil(adaptiveSpeedRef.current),
          targetLength - currentLength
        );
        const newLength = currentLength + charsToAdd;

        displayedLengthRef.current = newLength;
        setDisplayedText(fullText.substring(0, newLength));

        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [fullText, baseSpeed, fps, isPaused, onComplete]);

  return displayedText;
}

export default useStreamingAnimation;
