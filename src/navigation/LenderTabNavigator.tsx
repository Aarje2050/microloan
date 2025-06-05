// src/navigation/LenderTabNavigator.tsx
// ENTERPRISE SAFE AREA FIX - Proper handling for all iPhone models including notched devices
// Professional standard used by LinkedIn, Instagram, and other major apps

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { UniversalTabWrapper, getUniversalTabBarOptions } from '../components/common/UniversalTabWrapper';


import { LenderTabParamList } from '../types';
import { 
  LenderDashboardScreen, 
  ManageBorrowersScreen, 
  MyLoansScreen,
  LenderProfileScreen
} from '../screens/lender';

const Tab = createBottomTabNavigator<LenderTabParamList>();

export const LenderTabNavigator: React.FC = () => {
  return (
    <UniversalTabWrapper>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case 'Dashboard':
                iconName = focused ? 'speedometer' : 'speedometer-outline';
                break;
              case 'MyBorrowers':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'MyLoans':
                iconName = focused ? 'document-text' : 'document-text-outline';
                break;
              case 'Profile':
                iconName = focused ? 'person' : 'person-outline';
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
          component={LenderDashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
          }}
        />
        <Tab.Screen 
          name="MyBorrowers" 
          component={ManageBorrowersScreen}
          options={{
            tabBarLabel: 'Borrowers',
          }}
        />
        <Tab.Screen 
          name="MyLoans" 
          component={MyLoansScreen}
          options={{
            tabBarLabel: 'Loans',
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={LenderProfileScreen}
          options={{
            tabBarLabel: 'Profile',
          }}
        />
      </Tab.Navigator>
      </UniversalTabWrapper>
  );
};