// src/components/common/NativeMobileEnhancement.tsx
// Enhances web app to feel like native iOS app

import React, { useEffect } from 'react';
import { Platform } from 'react-native';

export const NativeMobileEnhancement: React.FC = () => {
  useEffect(() => {
    // Only apply on web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      
      // Prevent default iOS gestures that interfere with app
      const preventDefaults = (e: Event) => {
        e.preventDefault();
      };

      // Add native iOS app styling and behavior
      const styles = document.createElement('style');
      styles.innerHTML = `
        /* iOS Native App Feel */
        html, body {
          overflow: hidden;
          -webkit-overflow-scrolling: touch;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        /* Native scrolling behavior */
        .scroll-view {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        /* Native button touch feedback */
        button, [role="button"] {
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        button:active, [role="button"]:active {
          transform: scale(0.98);
          opacity: 0.8;
        }

        /* Native tab bar styling */
        .react-navigation-tab-bar {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(255, 255, 255, 0.95);
        }

        /* iOS-like card styling */
        .card-style {
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* Disable text selection on interactive elements */
        button, [role="button"], .tab-bar, .navigation-header {
          -webkit-user-select: none;
          user-select: none;
        }

        /* Native input styling */
        input, textarea {
          -webkit-appearance: none;
          appearance: none;
          border-radius: 10px;
          transition: all 0.2s ease;
        }

        input:focus, textarea:focus {
          transform: scale(1.02);
          box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.2);
        }

        /* Native loading states */
        @keyframes nativeLoading {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }

        .loading-animation {
          animation: nativeLoading 1.5s ease-in-out infinite;
        }

        /* Hide web scrollbars for native feel */
        ::-webkit-scrollbar {
          display: none;
        }
        
        /* Native safe area simulation */
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 44px);
        }
        
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 34px);
        }

        /* Native status bar color */
        meta[name="theme-color"] {
          content: "#ffffff";
        }

        /* PWA app-like behavior */
        body.pwa-mode {
          overscroll-behavior: none;
        }

        /* Native card transitions */
        .card-enter {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Native modal behavior */
        .modal-overlay {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(0, 0, 0, 0.4);
        }

        /* Disable zoom on inputs */
        input[type="text"], 
        input[type="email"], 
        input[type="password"], 
        textarea {
          font-size: 16px !important;
        }

        /* Native pull-to-refresh feel */
        .refresh-control {
          -webkit-overflow-scrolling: touch;
        }
      `;
      
      document.head.appendChild(styles);

      // Add PWA meta tags for native feel
      const addMetaTag = (name: string, content: string) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
          const meta = document.createElement('meta');
          meta.name = name;
          meta.content = content;
          document.head.appendChild(meta);
        }
      };

      // iOS PWA meta tags
      addMetaTag('mobile-web-app-capable', 'yes');
      addMetaTag('apple-mobile-web-app-capable', 'yes');
      addMetaTag('apple-mobile-web-app-status-bar-style', 'default');
      addMetaTag('apple-mobile-web-app-title', 'MicroLoan Manager');
      addMetaTag('theme-color', '#2196f3');

      // Prevent bounce scrolling on iOS
      document.addEventListener('touchmove', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.scroll-view')) {
          e.preventDefault();
        }
      }, { passive: false });

      // Prevent double-tap zoom
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);

      // Add body class for PWA mode
      document.body.classList.add('pwa-mode');

      // Cleanup function
      return () => {
        if (styles.parentNode) {
          styles.parentNode.removeChild(styles);
        }
        document.body.classList.remove('pwa-mode');
      };
    }
  }, []);

  // This component doesn't render anything visible
  return null;
};

export default NativeMobileEnhancement;