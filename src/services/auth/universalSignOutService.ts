// src/services/auth/universalSignOutService.ts
// Universal sign out service that works across all platforms and user types

import { Alert } from 'react-native';
import { AuthService } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class UniversalSignOutService {
  
  /**
   * Professional sign out with proper cleanup
   */
  static async performSignOut(): Promise<boolean> {
    try {
      // Step 1: Sign out from Supabase
      await AuthService.signOut();
      
      // Step 2: Clear all local storage (ensure complete cleanup)
      await this.clearAllLocalData();
      
      // Step 3: Clear React Query cache if available
      // This will be handled by the auth context when user state changes
      
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      
      // Even if Supabase signout fails, clear local data
      await this.clearAllLocalData();
      
      Alert.alert(
        'Sign Out',
        'You have been signed out. Please restart the app if you experience any issues.',
        [{ text: 'OK' }]
      );
      
      return true; // Return true to force sign out
    }
  }

  /**
   * Clear all local storage data
   */
  private static async clearAllLocalData(): Promise<void> {
    try {
      // Clear auth tokens and user data
      const keysToRemove = [
        'sb-auth-token',
        'supabase.auth.token',
        'user-session',
        'user-profile',
        '@user-data',
        // Add any other keys your app uses
      ];

      await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));

      
    } catch (error) {
      console.warn('Error clearing local data:', error);
    }
  }

  /**
   * Show professional sign out confirmation
   */
  static showSignOutConfirmation(onConfirm: () => void): void {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: onConfirm
        }
      ],
      { cancelable: true }
    );
  }

  /**
   * Universal sign out handler for any component
   */
  static async handleSignOut(): Promise<void> {
    this.showSignOutConfirmation(async () => {
      const success = await this.performSignOut();
      
      if (success) {
        // Force app reload on web for complete cleanup
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    });
  }
}