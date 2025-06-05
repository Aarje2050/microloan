// src/navigation/SuperAdminTabNavigator.tsx
// UPDATED - Tab navigation for Super Admin role with AllLoansScreen integration
// ENTERPRISE SAFE AREA FIX - Proper handling for all iPhone models including notched devices
// Provides access to all administrative functions with enterprise-grade screens

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SuperAdminTabParamList } from '../types';

// Import implemented screens
import { SuperAdminDashboardScreen } from '../screens/superadmin/SuperAdminDashboardScreen';
import { ManageLendersScreen } from '../screens/superadmin/ManageLendersScreen';
import { AllLoansScreen } from '../screens/superadmin/AllLoansScreen';
import { AnalyticsScreen } from '../screens/superadmin/AnalyticsScreen';

// Import placeholder for remaining screens
import { PlaceholderScreen } from '../components/common';
import { SettingsScreen } from '../screens/superadmin';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export const SuperAdminTabNavigator: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
            paddingTop: 5,
            height: 60, // Fixed height for consistency
            paddingBottom: 1
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            paddingBottom: 2,
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

      {/* UPDATED: Now using AllLoansScreen instead of PlaceholderScreen */}
      <Tab.Screen
        name="AllLoans"
        component={AllLoansScreen}
        options={{
          tabBarLabel: 'All Loans',
        }}
      />
      
      {/* UPDATED: Now using AnalyticsScreen instead of PlaceholderScreen */}
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
        }}
      />
      
      {/* REMAINING: Settings Screen - Only one left to implement */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
       
      </Tab.Navigator>
    </SafeAreaView>
  );
};