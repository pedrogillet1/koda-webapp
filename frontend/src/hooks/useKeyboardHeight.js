import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile keyboard height using visualViewport API
 * Returns keyboard height when keyboard is visible on mobile devices
 */
const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // Only run on mobile devices
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let initialHeight = visualViewport.height;

    const handleResize = () => {
      const currentHeight = visualViewport.height;
      const heightDiff = initialHeight - currentHeight;

      // If height decreased significantly, keyboard is likely visible
      if (heightDiff > 100) {
        setKeyboardHeight(heightDiff);
        setIsKeyboardVisible(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    };

    // Update initial height when orientation changes
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialHeight = visualViewport.height;
      }, 100);
    };

    visualViewport.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
};

export default useKeyboardHeight;
