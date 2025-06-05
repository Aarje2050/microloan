// App.tsx
// Main application component with navigation and authentication flow
// This is the entry point of our microloan application

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileWebStyles } from './src/components/common/MobileWebStyles';
import { NativeMobileEnhancement } from './src/components/common/NativeMobileEnhancement';



// Import our services and types
import { AuthService } from './src/services/auth/authService';
import { User } from './src/types';

// Import navigation components (we'll create these next)
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';

// Import utility functions
// import { formatCurrency, formatDate, calculateDaysBetween, getStatusColor } from './src/utils';

// Create React Query client for data management
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Custom theme for React Native Elements
const theme = {
  colors: {
    // Primary brand colors for professional look
    primary: '#2196f3',
    secondary: '#1976d2',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    text: '#212121',
    grey0: '#fafafa',
    grey1: '#f5f5f5',
    grey2: '#eeeeee',
    grey3: '#e0e0e0',
    grey4: '#bdbdbd',
    grey5: '#9e9e9e',
    searchBg: '#f8f9fa',
    divider: '#e1e8ed',
  },
  Button: {
    titleStyle: {
      fontWeight: '600',
    },
    buttonStyle: {
      borderRadius: 8,
      paddingVertical: 12,
    },
  },
  Input: {
    inputContainerStyle: {
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#e0e0e0',
    },
    inputStyle: {
      fontSize: 16,
    },
  },
  Card: {
    containerStyle: {
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
};

export default function App() {
  // State management for authentication
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  // Initialize authentication on app startup
  useEffect(() => {
    initializeAuth();
  }, []);

  /**
   * Initialize authentication and set up auth state listener
   */
  const initializeAuth = async () => {
    try {
      // Check if user is already logged in
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);

      // Set up auth state change listener
      const { data: authListener } = AuthService.onAuthStateChange((authUser) => {
        setUser(authUser);
        setIsLoading(false);
      });

      setIsAuthInitialized(true);
      setIsLoading(false);

      // Cleanup function for auth listener
      return () => {
        authListener?.subscription?.unsubscribe?.();
      };
    } catch (error) {
      console.error('Auth initialization error:', error);
      setIsLoading(false);
      setIsAuthInitialized(true);
    }
  };

  // Show loading screen while initializing
  if (isLoading || !isAuthInitialized) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <StatusBar style="auto" />
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>
            Loading MicroLoan Manager...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <>
    <NativeMobileEnhancement />
     <MobileWebStyles /> {/* Add this line */}
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <View style={styles.container}>
            <StatusBar style="auto" />
            
            {/* Conditional navigation based on authentication status */}
            {user ? (
              // User is authenticated - show main app navigation
              <AppNavigator user={user} />
            ) : (
              // User is not authenticated - show auth navigation
              <AuthNavigator />
            )}
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
    </>
  );
}

// Additional utility functions for app-wide use

/**
 * Format currency values consistently across the app
 * @param amount Numeric amount to format
 * @param currency Currency code (default: INR)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format dates consistently across the app
 * @param date Date string or Date object
 * @param format Format type ('short', 'medium', 'long')
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date, 
  format: 'short' | 'medium' | 'long' = 'medium'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  let options: Intl.DateTimeFormatOptions;
  
  if (format === 'short') {
    options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  } else if (format === 'medium') {
    options = { day: '2-digit', month: 'short', year: 'numeric' };
  } else {
    options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
  }

  return new Intl.DateTimeFormat('en-IN', options).format(dateObj);
};

/**
 * Calculate days between two dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Number of days
 */
export const calculateDaysBetween = (startDate: Date, endDate: Date): number => {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Generate professional color based on status
 * @param status Status string
 * @returns Color scheme name
 */
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    // Loan statuses
    'active': 'success',
    'pending_approval': 'warning',
    'completed': 'primary',
    'defaulted': 'error',
    
    // EMI statuses
    'paid': 'success',
    'pending': 'warning',
    'overdue': 'error',
    'partially_paid': 'warning',
    
    // KYC statuses
    'verified': 'success',
    'rejected': 'error',
  };

  return statusColors[status] || 'gray';
};

// Styles for the App component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#1976d2',
    fontWeight: '500',
  },
});