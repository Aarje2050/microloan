// src/components/common/UniversalTabWrapper.tsx
// Universal wrapper that makes any tab navigator work perfectly on web mobile

import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';

interface UniversalTabWrapperProps {
  children: React.ReactNode;
}

export const UniversalTabWrapper: React.FC<UniversalTabWrapperProps> = ({ children }) => {
  return (
    <>
      {/* Status bar configuration for native feel */}
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="white"
        translucent={false}
      />
      
      <SafeAreaView 
        style={{ flex: 1, backgroundColor: '#f5f5f5' }} 
        edges={Platform.OS === 'web' ? ['top'] : ['top', 'bottom']}
      >
        {children}
      </SafeAreaView>
    </>
  );
};

// Universal tab bar styling configuration
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
    // Add shadow for native feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
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

// Universal screen options for native feel
export const getUniversalScreenOptions = () => ({
  headerShown: false,
  // Add native-like transitions
  cardStyleInterpolator: Platform.OS === 'web' 
    ? undefined 
    : ({ current, layouts }: any) => ({
        cardStyle: {
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [layouts.screen.width, 0],
              }),
            },
          ],
        },
      }),
});