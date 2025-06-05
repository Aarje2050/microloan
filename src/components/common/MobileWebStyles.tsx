import React, { useEffect } from 'react';

// Component to inject mobile-first styles for web
export const MobileWebStyles: React.FC = () => {
  useEffect(() => {
    // Only apply on web
    if (typeof document !== 'undefined') {
      
      // Add viewport meta tag for proper mobile rendering
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
      }

      // Create global mobile styles
      const styles = document.createElement('style');
      styles.innerHTML = `
        /* Force mobile-like experience */
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          font-size: 16px;
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;
        }

        /* Main app container - mobile width */
        #root, [data-reactroot] {
          max-width: 430px !important;
          margin: 0 auto !important;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          min-height: 100vh;
          background: #fff;
          position: relative;
        }

        /* Mobile-like navigation */
        .react-navigation-stack-header {
          max-width: 430px !important;
          margin: 0 auto !important;
        }

        /* Ensure all content respects mobile width */
        * {
          max-width: 100% !important;
          box-sizing: border-box;
        }

        /* Mobile touch targets */
        button, [role="button"], input, textarea {
          min-height: 44px !important;
          border-radius: 8px !important;
        }

        /* Mobile-friendly text sizes */
        h1 { font-size: 24px !important; }
        h2 { font-size: 20px !important; }
        h3 { font-size: 18px !important; }
        p, span, div { font-size: 16px !important; line-height: 1.5 !important; }

        /* Tab bar mobile styling */
        .react-navigation-tab-bar {
          max-width: 430px !important;
          margin: 0 auto !important;
          border-top: 1px solid #e0e0e0;
        }

        /* Mobile spacing */
        .rne-header {
          padding: 10px 16px !important;
        }

        /* Remove desktop scrollbars */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }

        /* Mobile-like form inputs */
        input, textarea {
          padding: 12px 16px !important;
          font-size: 16px !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          #root, [data-reactroot] {
            background: #1a1a1a;
          }
        }

        /* Responsive for larger screens but keep mobile feel */
        @media (min-width: 768px) {
          body {
            background: #f5f5f5;
          }
          #root, [data-reactroot] {
            box-shadow: 0 0 30px rgba(0,0,0,0.15);
            border-radius: 12px;
            margin-top: 20px !important;
            min-height: calc(100vh - 40px);
          }
        }
      `;
      
      document.head.appendChild(styles);

      // Cleanup function
      return () => {
        if (styles.parentNode) {
          styles.parentNode.removeChild(styles);
        }
      };
    }
  }, []);

  // This component doesn't render anything visible
  return null;
};

export default MobileWebStyles;