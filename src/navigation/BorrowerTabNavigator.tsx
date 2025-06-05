// src/navigation/BorrowerTabNavigator.tsx
// Enterprise borrower tab navigation with role-based access control
// FIXED: Direct imports to avoid export/import issues and ensure component availability

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// FIXED: Direct imports instead of barrel exports to avoid import issues
import { BorrowerDashboardScreen } from '../screens/borrower/BorrowerDashboardScreen';
import { BorrowerMyLoansScreen } from '../screens/borrower/BorrowerMyLoansScreen';
import { PaymentHistoryScreen } from '../screens/borrower/PaymentHistoryScreen';
import { DocumentsScreen } from '../screens/borrower/DocumentsScreen';
import { BorrowerProfileScreen } from '../screens/borrower/BorrowerProfileScreen';
import { BorrowerTabParamList } from '../types';
import { UniversalTabWrapper, getUniversalTabBarOptions } from '../components/common/UniversalTabWrapper';


const Tab = createBottomTabNavigator<BorrowerTabParamList>();

export const BorrowerTabNavigator: React.FC = () => {
  return (
    <UniversalTabWrapper>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'speedometer' : 'speedometer-outline';
              break;
            case 'MyLoans':
              iconName = focused ? 'document-text' : 'document-text-outline';
              break;
            case 'Payments':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'Documents':
              iconName = focused ? 'folder' : 'folder-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle-outline'; // or any other valid icon name
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196f3',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={BorrowerDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="MyLoans" 
        component={BorrowerMyLoansScreen}
        options={{
          tabBarLabel: 'My Loans',
        }}
      />
      <Tab.Screen 
        name="Payments" 
        component={PaymentHistoryScreen}
        options={{
          tabBarLabel: 'Payments',
        }}
      />
      <Tab.Screen 
        name="Documents" 
        component={DocumentsScreen}
        options={{
          tabBarLabel: 'Documents',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={BorrowerProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
    </UniversalTabWrapper>
  );
};