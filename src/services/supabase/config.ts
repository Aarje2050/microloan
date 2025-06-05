// src/services/supabase/config.ts
// Supabase client configuration with secure storage integration
// This file sets up the Supabase client with proper authentication persistence

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get environment variables from Expo Constants
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables');
}

// Helper function to check if SecureStore is available
const isSecureStoreAvailable = () => {
  return Platform.OS !== 'web';
};

// Hybrid storage: SecureStore for small items on mobile, AsyncStorage for web and large items
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      // On web or if SecureStore unavailable, use AsyncStorage only
      if (!isSecureStoreAvailable()) {
        return await AsyncStorage.getItem(key);
      }
      
      // Try SecureStore first on mobile
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
      
      // Fallback to AsyncStorage for large items
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('Storage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // On web or if SecureStore unavailable, use AsyncStorage only
      if (!isSecureStoreAvailable()) {
        await AsyncStorage.setItem(key, value);
        console.log(`Stored in AsyncStorage (web) - Key: ${key}, Size: ${value.length} bytes`);
        return;
      }
      
      if (value.length <= 2048) {
        // Use SecureStore for small items (more secure)
        await SecureStore.setItemAsync(key, value);
        console.log(`Stored in SecureStore - Key: ${key}, Size: ${value.length} bytes`);
      } else {
        // Use AsyncStorage for large items
        await AsyncStorage.setItem(key, value);
        console.log(`Stored in AsyncStorage - Key: ${key}, Size: ${value.length} bytes`);
      }
    } catch (error) {
      console.error('Storage setItem error:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      // Always try AsyncStorage
      await AsyncStorage.removeItem(key);
      
      // Only try SecureStore if available
      if (isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
      
      console.log(`Removed from storage - Key: ${key}`);
    } catch (error) {
      console.warn('Storage removeItem error:', error);
    }
  },
};

// Create Supabase client with secure storage and proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use secure storage for token persistence across app restarts
    storage: ExpoSecureStoreAdapter,
    // Auto refresh tokens when they expire
    autoRefreshToken: true,
    // Persist session across app restarts
    persistSession: true,
    // Detect session in url (for web compatibility if needed later)
    detectSessionInUrl: Platform.OS === 'web', // Enable for web, disable for mobile
    
  },
  // Add this logging to see what's being stored

  // Real-time configuration for live updates
  realtime: {
    params: {
      eventsPerSecond: 10, // Limit events for mobile performance
    },
  },
  // Global headers for all requests
  global: {
    headers: {
      'x-application-name': 'microloan-app',
    },
  },
});

// Helper function to check if Supabase is properly configured
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};

// Helper function to get current user with error handling
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
};

// Export types for better TypeScript support
export type SupabaseClient = typeof supabase;