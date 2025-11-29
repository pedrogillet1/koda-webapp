import { useState, useEffect, useRef } from 'react';

/**
 * ChatGPT-style streaming animation hook
 * Animates text character-by-character for smooth typing effect
 * 
 * @param {string} fullText - Complete text to animate
 * @param {number} speed - Characters per frame (default: 2)
 * @param {number} fps - Target frames per second (default: 30)
 * @returns {string} - Currently displayed text
 */
export function useStreamingAnimation(fullText, speed = 2, fps = 30) {
  const [displayedText, setDisplayedText] = useState('');
  const animationRef = useRef(null);
  const displayedLengthRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const adaptiveSpeedRef = useRef(speed);
  
  useEffect(() => {
    // If fullText is shorter than displayed (message changed/reset), reset animation
    if (fullText.length < displayedLengthRef.current) {
      displayedLengthRef.current = 0;
      setDisplayedText('');
      lastUpdateTimeRef.current = Date.now();
      return;
    }
    
    // If already fully displayed, no animation needed
    if (displayedLengthRef.current >= fullText.length) {
      return;
    }
    
    // Calculate adaptive speed based on chunk arrival rate
    const timeSinceUpdate = Date.now() - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = Date.now();
    
    if (timeSinceUpdate < 100) {
      // Chunks arriving fast - speed up animation
      adaptiveSpeedRef.current = Math.min(speed * 2, 5);
    } else if (timeSinceUpdate > 500) {
      // Chunks arriving slow - slow down animation for smoothness
      adaptiveSpeedRef.current = Math.max(speed / 2, 1);
    } else {
      // Normal speed
      adaptiveSpeedRef.current = speed;
    }
    
    // Start animation loop
    const frameDelay = 1000 / fps; // ms per frame
    
    function animate() {
      const currentLength = displayedLengthRef.current;
      const targetLength = fullText.length;
      
      if (currentLength < targetLength) {
        // Check if we're entering a code block - show code blocks instantly
        const remainingText = fullText.substring(currentLength);
        const codeBlockMatch = remainingText.match(/^```/);
        
        if (codeBlockMatch) {
          // Find end of code block
          const codeBlockEnd = remainingText.indexOf('```', 3);
          if (codeBlockEnd !== -1) {
            // Show entire code block instantly
            const newLength = currentLength + codeBlockEnd + 3;
            displayedLengthRef.current = newLength;
            setDisplayedText(fullText.substring(0, newLength));
            
            // Continue animation after code block
            animationRef.current = setTimeout(animate, frameDelay);
            return;
          }
        }
        
        // Normal character-by-character animation
        const charsToAdd = Math.min(
          Math.ceil(adaptiveSpeedRef.current),
          targetLength - currentLength
        );
        const newLength = currentLength + charsToAdd;
        
        displayedLengthRef.current = newLength;
        setDisplayedText(fullText.substring(0, newLength));
        
        // Schedule next frame
        animationRef.current = setTimeout(animate, frameDelay);
      }
    }
    
    // Start animation
    animate();
    
    // Cleanup
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [fullText, speed, fps]);
  
  return displayedText;
}

export default useStreamingAnimation;
