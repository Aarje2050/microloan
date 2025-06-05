// src/components/common/UniversalTabWrapper.tsx
// FIXED - Actually working tab wrapper with bottom navigation fix

import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

interface UniversalTabWrapperProps {
  children: React.ReactNode;
}

export const UniversalTabWrapper: React.FC<UniversalTabWrapperProps> = ({ children }) => {
  
  // Fix bottom navigation on web/iOS
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styles = document.createElement('style');
      styles.innerHTML = `
        /* FORCE bottom navigation to show on iOS Safari */
        .react-navigation-tab-bar, 
        [role="tablist"],
        div[style*="position: absolute"][style*="bottom: 0"] {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 999 !important;
          background: white !important;
          border-top: 1px solid #e0e0e0 !important;
          height: 80px !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          max-width: 430px !important;
          margin: 0 auto !important;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
        }

        /* Content spacing for bottom navigation */
        body, #root, [data-reactroot] {
          padding-bottom: 90px !important;
        }
      `;
      
      document.head.appendChild(styles);
      
      return () => {
        if (styles.parentNode) {
          styles.parentNode.removeChild(styles);
        }
      };
    }
  }, []);

  return (
    <SafeAreaView 
      style={{ flex: 1 }} 
      edges={Platform.OS === 'web' ? ['top'] : ['top', 'bottom']}
    >
      {children}
    </SafeAreaView>
  );
};

// Universal tab bar styling
export const getUniversalTabBarOptions = () => ({
  tabBarActiveTintColor: '#2196f3',
  tabBarInactiveTintColor: '#9e9e9e',
  tabBarStyle: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 8 : 4,
    height: Platform.OS === 'web' ? 80 : 85,
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginBottom: Platform.OS === 'web' ? 4 : 2,
  },
  tabBarItemStyle: {
    paddingVertical: 4,
  },
});