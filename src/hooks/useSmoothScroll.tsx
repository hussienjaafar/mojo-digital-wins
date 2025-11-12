import { useEffect } from 'react';

/**
 * Hook to enable smooth scroll animations for internal hash links
 * Adds enhanced easing and scroll behavior for better UX
 */
export const useSmoothScroll = () => {
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      
      if (!anchor) return;
      
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      
      e.preventDefault();
      
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (!targetElement) return;
      
      // Calculate offset for fixed navigation
      const navHeight = 80; // Height of fixed navigation
      const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - navHeight;
      
      // Smooth scroll with custom easing
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, '', href);
      }
    };
    
    document.addEventListener('click', handleAnchorClick);
    
    // Handle initial hash on page load
    const handleInitialHash = () => {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const targetElement = document.querySelector(hash);
          if (targetElement) {
            const navHeight = 80;
            const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - navHeight;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 100);
      }
    };
    
    handleInitialHash();
    
    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);
};
