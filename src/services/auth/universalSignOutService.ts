// src/services/auth/universalSignOutService.ts
// Enterprise-grade universal sign out with proper cleanup

import { Alert, Platform } from 'react-native';
import { AuthService } from './authService';

export class UniversalSignOutService {
  
  /**
   * Enterprise sign out with proper token cleanup
   */
  static async handleSignOut(): Promise<void> {
    
    // Use native Alert for mobile, browser confirm for web
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        await this.performSignOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Sign Out', 
            style: 'destructive',
            onPress: () => this.performSignOut()
          }
        ]
      );
    }
  }

  /**
   * Perform the actual sign out with proper cleanup
   */
  private static async performSignOut(): Promise<void> {
    try {
      // Step 1: Clear Supabase auth tokens specifically
      await this.clearSupabaseTokens();
      
      // Step 2: Sign out from Supabase
      await AuthService.signOut();
      
      // Step 3: Clear any remaining app-specific data
      await this.clearAppData();
      
    } catch (error) {
      console.warn('Sign out error:', error);
      // Even if signout fails, clear local data
      await this.clearSupabaseTokens();
      await this.clearAppData();
    } finally {
      // Step 4: Force app reload for clean state
      this.forceAppReload();
    }
  }

  /**
   * Clear Supabase-specific auth tokens
   */
  private static async clearSupabaseTokens(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      // Clear Supabase auth tokens (enterprise way - specific keys only)
      const supabaseKeys = [
        'sb-localhost-auth-token',
        'sb-auth-token', 
        'supabase.auth.token',
        'sb-' + window.location.hostname + '-auth-token'
      ];
      
      supabaseKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    }

    if (typeof sessionStorage !== 'undefined') {
      // Clear session storage
      sessionStorage.clear();
    }
  }

  /**
   * Clear app-specific data (add your app's storage keys here)
   */
  private static async clearAppData(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      // Clear app-specific keys (add more as needed)
      const appKeys = [
        'user-profile',
        'user-session', 
        'dashboard-cache',
        '@microloan-app'
      ];
      
      appKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    }
  }

  /**
   * Force app reload with clean URL
   */
  private static forceAppReload(): void {
    if (typeof window !== 'undefined') {
      // Clear any hash or query params for clean reload
      window.location.href = window.location.origin;
    }
  }
}