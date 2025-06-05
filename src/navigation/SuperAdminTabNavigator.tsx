// src/navigation/SuperAdminTabNavigator.tsx
// FIXED - Mobile web navigation with proper bottom tab visibility

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { SuperAdminTabParamList } from '../types';

// Import implemented screens
import { SuperAdminDashboardScreen } from '../screens/superadmin/SuperAdminDashboardScreen';
import { ManageLendersScreen } from '../screens/superadmin/ManageLendersScreen';
import { AllLoansScreen } from '../screens/superadmin/AllLoansScreen';
import { AnalyticsScreen } from '../screens/superadmin/AnalyticsScreen';
import { SettingsScreen } from '../screens/superadmin';
import { UniversalTabWrapper, getUniversalTabBarOptions } from '../components/common/UniversalTabWrapper';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export const SuperAdminTabNavigator: React.FC = () => {
  return (
    <UniversalTabWrapper>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case 'Dashboard':
                iconName = focused ? 'analytics' : 'analytics-outline';
                break;
              case 'ManageLenders':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'AllLoans':
                iconName = focused ? 'document-text' : 'document-text-outline';
                break;
              case 'Analytics':
                iconName = focused ? 'bar-chart' : 'bar-chart-outline';
                break;
              case 'Settings':
                iconName = focused ? 'settings' : 'settings-outline';
                break;
              default:
                iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2196f3',
          tabBarInactiveTintColor: '#9e9e9e',
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
            paddingTop: 8,
            paddingBottom: Platform.OS === 'web' ? 8 : 4,
            height: Platform.OS === 'web' ? 80 : 85, // More height for web mobile
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: Platform.OS === 'web' ? 4 : 2,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
        })}
      >
      <Tab.Screen
        name="Dashboard"
        component={SuperAdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      
      <Tab.Screen
        name="ManageLenders"
        component={ManageLendersScreen}
        options={{
          tabBarLabel: 'Lenders',
        }}
      />

      <Tab.Screen
        name="AllLoans"
        component={AllLoansScreen}
        options={{
          tabBarLabel: 'All Loans',
        }}
      />
      
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
        }}
      />
      
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
       
      </Tab.Navigator>
      </UniversalTabWrapper>
  );
};