import { useState, useRef, useCallback } from 'react';

/**
 * Hook for handling swipe gestures on mobile devices
 *
 * @param {Object} options
 * @param {Function} options.onSwipeLeft - Callback when swiping left
 * @param {Function} options.onSwipeRight - Callback when swiping right
 * @param {Function} options.onSwipeUp - Callback when swiping up
 * @param {Function} options.onSwipeDown - Callback when swiping down
 * @param {number} options.threshold - Minimum distance to trigger swipe (default: 50px)
 * @param {number} options.edgeThreshold - Distance from edge for edge swipes (default: 20px)
 * @param {boolean} options.preventScroll - Prevent scrolling during horizontal swipe (default: true)
 *
 * @returns {Object} Touch handlers and swipe state
 */
export default function useSwipeGestures({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onEdgeSwipeRight,
  threshold = 50,
  edgeThreshold = 20,
  preventScroll = true
} = {}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);
  const touchCurrentY = useRef(0);
  const isEdgeSwipe = useRef(false);

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [swipeProgress, setSwipeProgress] = useState(0); // 0-1 progress toward threshold

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;

    // Check if starting from left edge (for sidebar gesture)
    isEdgeSwipe.current = touch.clientX <= edgeThreshold;

    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
    setSwipeProgress(0);
  }, [edgeThreshold]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartX.current) return;

    const touch = e.touches[0];
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if this is a horizontal swipe (more X than Y movement)
    const isHorizontal = absDeltaX > absDeltaY;

    if (isHorizontal && absDeltaX > 10) {
      setIsSwiping(true);
      setSwipeDistance(deltaX);
      setSwipeProgress(Math.min(absDeltaX / threshold, 1));

      if (deltaX > 0) {
        setSwipeDirection('right');
      } else {
        setSwipeDirection('left');
      }

      // Prevent vertical scrolling during horizontal swipe
      if (preventScroll) {
        e.preventDefault();
      }
    } else if (!isHorizontal && absDeltaY > 10) {
      setIsSwiping(true);
      setSwipeDistance(deltaY);
      setSwipeProgress(Math.min(absDeltaY / threshold, 1));

      if (deltaY > 0) {
        setSwipeDirection('down');
      } else {
        setSwipeDirection('up');
      }
    }
  }, [threshold, preventScroll]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartX.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Check if swipe distance exceeds threshold
    if (absDeltaX > threshold && absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (deltaX > 0) {
        // Swipe right
        if (isEdgeSwipe.current && onEdgeSwipeRight) {
          onEdgeSwipeRight();
        } else if (onSwipeRight) {
          onSwipeRight();
        }
      } else {
        // Swipe left
        onSwipeLeft?.();
      }
    } else if (absDeltaY > threshold && absDeltaY > absDeltaX) {
      // Vertical swipe
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    // Reset state
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchCurrentX.current = 0;
    touchCurrentY.current = 0;
    isEdgeSwipe.current = false;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
    setSwipeProgress(0);
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onEdgeSwipeRight]);

  const handleTouchCancel = useCallback(() => {
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchCurrentX.current = 0;
    touchCurrentY.current = 0;
    isEdgeSwipe.current = false;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
    setSwipeProgress(0);
  }, []);

  return {
    // Touch event handlers
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,

    // Swipe state (useful for visual feedback)
    isSwiping,
    swipeDirection, // 'left' | 'right' | 'up' | 'down' | null
    swipeDistance,  // Actual pixel distance
    swipeProgress,  // 0-1 progress toward threshold

    // Bind all handlers at once
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel
    }
  };
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false
} = {}) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;

    // Only enable pull-to-refresh when at top of scroll container
    const target = e.currentTarget;
    scrollTop.current = target.scrollTop || 0;

    if (scrollTop.current <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || isRefreshing || !touchStartY.current) return;

    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only pull down, not up
    if (deltaY > 0 && scrollTop.current <= 0) {
      setIsPulling(true);
      // Apply resistance (pull feels heavier as you go)
      setPullDistance(Math.min(deltaY * 0.5, threshold * 1.5));

      if (deltaY > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing || !isPulling) {
      touchStartY.current = 0;
      return;
    }

    if (pullDistance >= threshold && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    touchStartY.current = 0;
    setIsPulling(false);
    setPullDistance(0);
  }, [disabled, isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    isPulling,
    pullDistance,
    isRefreshing,
    pullProgress: Math.min(pullDistance / threshold, 1),
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
}
