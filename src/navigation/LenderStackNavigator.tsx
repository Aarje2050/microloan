// ============================================================================
// UPDATE LENDER STACK NAVIGATOR - src/navigation/LenderStackNavigator.tsx
// ============================================================================

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LenderStackParamList } from '../types';

import { LenderTabNavigator } from './LenderTabNavigator';
import { CreateLoanWizardScreen } from '../screens/lender/CreateLoanWizardScreen';
import { RecordPaymentScreen } from '../screens/lender/RecordPaymentScreen';
import { EMIManagementScreen } from '../screens/lender/EMIManagementScreen'; // NEW IMPORT

const Stack = createStackNavigator<LenderStackParamList>();

export const LenderStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="LenderTabs"
        component={LenderTabNavigator}
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        name="CreateLoanWizard"
        component={CreateLoanWizardScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      
      <Stack.Screen
        name="RecordPayment"
        component={RecordPaymentScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      
      {/* NEW: EMI Management Screen */}
      <Stack.Screen
        name="EMIManagement"
        component={EMIManagementScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};