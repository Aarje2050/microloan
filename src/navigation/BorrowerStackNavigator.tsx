// src/navigation/BorrowerStackNavigator.tsx
// Enterprise borrower stack navigation with modal screens and deep linking
// FIXED: Direct imports to avoid export/import issues and ensure component availability

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { BorrowerTabNavigator } from './BorrowerTabNavigator';
// FIXED: Direct imports instead of barrel exports to avoid import issues
import { PaymentHistoryScreen } from '../screens/borrower/PaymentHistoryScreen';
import { EMIScheduleScreen } from '../screens/borrower/EMIScheduleScreen';
import { DocumentsScreen } from '../screens/borrower/DocumentsScreen';
import { PlaceholderScreen } from '../components/common';
import { BorrowerStackParamList } from '../types';

const Stack = createStackNavigator<BorrowerStackParamList>();

// FIXED: Wrapper components with correct PlaceholderScreenProps - trying 'subtitle' instead of 'message'
const MakePaymentPlaceholder = ({ route }: any) => (
  <PlaceholderScreen 
    title={route.params?.title || 'Make Payment'}
    subtitle={route.params?.subtitle || 'Payment interface coming soon! You will be able to make EMI payments securely through multiple payment methods.'}
    icon={route.params?.icon || 'card'}
    role ={route.params?.role || 'borrower'}

  />
);

const LoanDetailsPlaceholder = ({ route }: any) => (
  <PlaceholderScreen 
    title={route.params?.title || 'Loan Details'}
    subtitle={route.params?.subtitle || 'Detailed loan view coming soon! You will see complete loan information, EMI history, and payment tracking.'}
    icon={route.params?.icon || 'document-text'}
    role ={route.params?.role || 'borrower'}
  />
);

const DocumentUploadPlaceholder = ({ route }: any) => (
  <PlaceholderScreen 
    title={route.params?.title || 'Upload Document'}
    subtitle={route.params?.subtitle || 'Document upload feature coming soon! You will be able to upload and manage all your loan documents securely.'}
    icon={route.params?.icon || 'cloud-upload'}
    role ={route.params?.role || 'borrower'}

  />
);

const DocumentViewerPlaceholder = ({ route }: any) => (
  <PlaceholderScreen 
    title={route.params?.title || 'Document Viewer'}
    subtitle={route.params?.subtitle || 'Document viewer coming soon! You will be able to view, download, and share your documents.'}
    icon={route.params?.icon || 'eye'}
    role ={route.params?.role || 'borrower'}

  />
);

export const BorrowerStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    >
      {/* Main Tab Navigator */}
      <Stack.Screen 
        name="BorrowerTabs" 
        component={BorrowerTabNavigator}
      />
      
      {/* Modal/Stack Screens - FIXED: Using direct imports to ensure components are available */}
      <Stack.Screen 
        name="PaymentHistory" 
        component={PaymentHistoryScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Payment History',
          headerBackTitle: 'Back',
        }}
      />
      
      <Stack.Screen 
        name="EMISchedule" 
        component={EMIScheduleScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'EMI Schedule',
          headerBackTitle: 'Back',
        }}
      />
      
      {/* FIXED: Placeholder screens with proper component wrappers */}
      <Stack.Screen 
        name="MakePayment" 
        component={MakePaymentPlaceholder}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Make Payment',
          headerBackTitle: 'Back',
        }}
      />
      
      <Stack.Screen 
        name="LoanDetails" 
        component={LoanDetailsPlaceholder}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Loan Details',
          headerBackTitle: 'Back',
        }}
      />
      
      <Stack.Screen 
        name="DocumentUpload" 
        component={DocumentUploadPlaceholder}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Upload Document',
          headerBackTitle: 'Back',
        }}
      />
      
      <Stack.Screen 
        name="DocumentViewer" 
        component={DocumentViewerPlaceholder}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Document Viewer',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};