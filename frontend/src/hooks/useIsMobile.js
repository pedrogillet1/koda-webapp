import { useState, useEffect, useMemo } from 'react';

/**
 * Custom hook to detect mobile viewport
 * @returns {boolean} true if viewport width <= 768px
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

/**
 * Custom hook to detect tablet viewport
 * @returns {boolean} true if viewport width <= 1024px
 */
export const useIsTablet = () => {
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth <= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
};

/**
 * Custom hook for adaptive mobile sizing
 * Returns granular breakpoint info for different phone/tablet sizes
 *
 * Screen size breakpoints:
 * - Small Phones: 320px - 374px (iPhone SE, old Android)
 * - Regular Phones: 375px - 424px (iPhone 12/13/14)
 * - Large Phones: 425px - 599px (iPhone 14 Pro Max, Android XL)
 * - Small Tablets: 600px - 768px (iPad Mini)
 * - Large Tablets: 769px - 1024px (iPad, iPad Air)
 */
export const useMobileBreakpoints = () => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => ({
    width,
    isMobile: width <= 768,
    isSmallPhone: width < 375,
    isRegularPhone: width >= 375 && width < 425,
    isLargePhone: width >= 425 && width < 600,
    isSmallTablet: width >= 600 && width <= 768,
    isLargeTablet: width > 768 && width <= 1024,
    isDesktop: width > 1024,
    // Adaptive sizing helpers
    spacing: width < 375 ? 8 : width >= 425 ? 16 : 12,
    gap: width < 375 ? 8 : width >= 425 ? 16 : 12,
    fontSize: {
      xs: width < 375 ? 10 : width >= 425 ? 12 : 11,
      sm: width < 375 ? 12 : width >= 425 ? 14 : 13,
      base: width < 375 ? 13 : width >= 425 ? 15 : 14,
      lg: width < 375 ? 14 : width >= 425 ? 18 : 16,
      xl: width < 375 ? 16 : width >= 425 ? 22 : 20,
    },
    padding: {
      xs: width < 375 ? 4 : width >= 425 ? 8 : 6,
      sm: width < 375 ? 8 : width >= 425 ? 12 : 10,
      base: width < 375 ? 10 : width >= 425 ? 16 : 12,
      lg: width < 375 ? 12 : width >= 425 ? 20 : 16,
      xl: width < 375 ? 16 : width >= 425 ? 28 : 24,
    },
    buttonSize: width < 375 ? 40 : 44,
    headerHeight: width < 375 ? 52 : width >= 425 ? 68 : 60,
    borderRadius: {
      sm: width < 375 ? 6 : 8,
      base: width < 375 ? 8 : width >= 425 ? 12 : 10,
      lg: width < 375 ? 10 : width >= 425 ? 16 : 14,
      xl: width < 375 ? 12 : width >= 425 ? 20 : 16,
    },
    iconSize: {
      sm: width < 375 ? 16 : 20,
      base: width < 375 ? 20 : 24,
      lg: width < 375 ? 24 : 32,
    }
  }), [width]);
};
