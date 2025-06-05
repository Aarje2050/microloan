// src/services/auth/authService.ts
// ENTERPRISE AUTHENTICATION - NO RECURSION, COMPLETE FUNCTIONALITY
// Handles super admin immediate access, lender approval workflow, borrower verification

import { supabase } from '../supabase/config';
import { User, UserRole, ApiResponse, RegisterForm } from '../../types';

export class AuthService {
  
  /**
   * ENTERPRISE SIGN IN - Proper Flow
   * 1. Authenticate with Supabase (gets session)
   * 2. Fetch user record (now allowed by RLS)
   * 3. Check permissions in application logic (not RLS)
   * 4. Allow/deny based on user status
   */
  static async signIn(email: string, password: string): Promise<ApiResponse<User>> {
    try {
      // STEP 1: Authenticate first
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (authError) {
        return {
          success: false,
          error: this.formatAuthError(authError.message)
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Authentication failed. Please try again.'
        };
      }

      // STEP 2: Now authenticated, fetch user profile (RLS allows this)
      const userProfile = await this.fetchUserProfile(authData.user.id);
      
      if (!userProfile) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'User profile not found. Please contact support.'
        };
      }

      // STEP 3: Application-level security checks (not RLS)
      
      // Check if account is deleted
      if (userProfile.deleted_at) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'This account has been deactivated. Please contact support.'
        };
      }

      // SUPER ADMIN: Immediate access (as requested)
      if (userProfile.role === 'super_admin') {
        return {
          success: true,
          data: userProfile
        };
      }

      // LENDER: Needs email verification + admin approval
      if (userProfile.role === 'lender') {
        if (!userProfile.email_verified) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Email not verified. Please check your email for verification instructions.',
            data: {
              email: email,
              role: userProfile.role,
              fullName: userProfile.full_name,
              needsVerification: true
            } as any
          };
        }

        if (userProfile.pending_approval || !userProfile.active) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Your Loan Officer account is pending admin approval. You will receive an email once approved.'
          };
        }

        return {
          success: true,
          data: userProfile
        };
      }

      // BORROWER: Needs only email verification
      if (userProfile.role === 'borrower') {
        if (!userProfile.email_verified) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Email not verified. Please check your email for verification instructions.',
            data: {
              email: email,
              role: userProfile.role,
              fullName: userProfile.full_name,
              needsVerification: true
            } as any
          };
        }

        if (!userProfile.active) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Account is inactive. Please contact support.'
          };
        }

        return {
          success: true,
          data: userProfile
        };
      }

      // Unknown role
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Invalid user role. Please contact support.'
      };

    } catch (error) {
      console.error('Sign in error:', error);
      try {
        await supabase.auth.signOut();
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
      
      return {
        success: false,
        error: 'An unexpected error occurred during sign in.'
      };
    }
  }

  /**
   * Register new user with role-based flow
   * @param userData Registration form data
   * @returns Promise with user data or error
   */
  static async signUp(userData: RegisterForm): Promise<ApiResponse<User>> {
    let authUserId: string | null = null;
    
    try {
      // Check if email already exists in our users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email, active, email_verified, deleted_at')
        .eq('email', userData.email.toLowerCase())
        .maybeSingle();

      if (existingUser && !existingUser.deleted_at) {
        if (!existingUser.email_verified) {
          return {
            success: false,
            error: 'An account with this email exists but is not verified. Please check your email for verification instructions.'
          };
        }
        
        return {
          success: false,
          error: 'Email address is already registered.'
        };
      }

      // STEP 1: Create auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            phone: userData.phone,
            role: userData.role
          }
        }
      });

      if (authError) {
        return {
          success: false,
          error: this.formatAuthError(authError.message)
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Failed to create user account.'
        };
      }

      authUserId = authData.user.id;

      // STEP 2: Create user profile with role-based settings
      const userSettings = this.getUserRegistrationSettings(userData.role);
      
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email.trim().toLowerCase(),
          role: userData.role,
          phone: userData.phone,
          full_name: userData.full_name,
          active: userSettings.active,
          email_verified: userSettings.email_verified,
          pending_approval: userSettings.pending_approval
        })
        .select()
        .single();

      if (userError) {
        console.error('User profile creation failed:', userError);
        console.error('Error details:', {
          code: userError.code,
          message: userError.message,
          details: userError.details,
          hint: userError.hint
        });
        
        // Clean up auth user since profile creation failed
        try {
          console.log('Attempting to clean up auth user:', authUserId);
          await supabase.auth.admin.deleteUser(authUserId);
          console.log('Auth user cleanup successful');
        } catch (cleanupError) {
          console.warn('Auth cleanup failed:', cleanupError);
        }
        
        return {
          success: false,
          error: 'Failed to create user profile due to permission restrictions. Please contact support.'
        };
      }

      // STEP 3: Create user profile entry
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: authData.user.id,
          kyc_status: userData.role === 'super_admin' ? 'verified' : 'pending'
        });

      if (profileError) {
        console.warn('User profile entry creation failed:', profileError);
        // Don't fail registration for this - it's optional
      }

      // STEP 4: Sign out new user immediately (they need email verification except super admin)
      if (userData.role !== 'super_admin') {
        await supabase.auth.signOut();
      }

      return {
        success: true,
        data: newUser as User
      };

    } catch (error) {
      console.error('Sign up error:', error);
      
      // Clean up auth user if we created one
      if (authUserId) {
        try {
          await supabase.auth.admin.deleteUser(authUserId);
        } catch (cleanupError) {
          console.warn('Emergency auth cleanup failed:', cleanupError);
        }
      }
      
      return {
        success: false,
        error: 'An unexpected error occurred during registration.'
      };
    }
  }

  /**
   * Get registration settings based on role
   * @param role User role
   * @returns Settings object
   */
  private static getUserRegistrationSettings(role: UserRole) {
    switch (role) {
      case 'super_admin':
        return {
          active: true,           // Immediate access
          email_verified: true,   // No verification needed
          pending_approval: false // No approval needed
        };
      case 'lender':
        return {
          active: false,          // Inactive until approved
          email_verified: false,  // Must verify email
          pending_approval: true  // Needs admin approval
        };
      case 'borrower':
        return {
          active: false,          // Inactive until email verified
          email_verified: false,  // Must verify email
          pending_approval: false // No approval needed
        };
      default:
        return {
          active: false,
          email_verified: false,
          pending_approval: true
        };
    }
  }

  /**
   * Get current authenticated user
   * @returns Promise with current user or null
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        return null;
      }

      return await this.fetchUserProfile(authUser.id);

    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Fetch user profile with all related data
   * @param userId User ID
   * @returns User profile or null
   */
  private static async fetchUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_profiles(address, kyc_status, avatar_url)
        `)
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Fetch user profile error:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Fetch user profile error:', error);
      return null;
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Update user profile
   * @param userId User ID to update
   * @param updates Fields to update
   * @returns Promise with updated user data
   */
  static async updateProfile(
    userId: string, 
    updates: Partial<Pick<User, 'full_name' | 'phone'>>
  ): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: 'Failed to update profile. Please try again.'
        };
      }

      return {
        success: true,
        data: data as User
      };

    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while updating profile.'
      };
    }
  }

  /**
   * Reset password
   * @param email User's email address
   * @returns Promise with success status
   */
  static async resetPassword(email: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: 'com.yourcompany.microloanapp://reset-password'
        }
      );

      if (error) {
        return {
          success: false,
          error: this.formatAuthError(error.message)
        };
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Failed to send password reset email.'
      };
    }
  }

  /**
   * Verify user email with token
   * @param token Verification token
   * @returns Promise with verification result
   */
  static async verifyEmail(token: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
    role?: string;
    active?: boolean;
    pending_approval?: boolean;
  }>> {
    try {
      if (!token || !this.isValidUUID(token)) {
        return {
          success: false,
          error: 'Invalid verification token format'
        };
      }

      // Use database function to verify email (if available)
      const { data, error } = await supabase.rpc('verify_user_email', {
        token: token
      });

      if (error) {
        console.error('Verify email error:', error);
        return {
          success: false,
          error: 'Email verification failed'
        };
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Invalid or expired verification link'
        };
      }

      return {
        success: true,
        data: {
          success: data.success,
          message: data.message,
          role: data.role,
          active: data.active,
          pending_approval: data.pending_approval
        }
      };

    } catch (error) {
      console.error('Verify email error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during email verification'
      };
    }
  }

  /**
   * Resend verification email
   * @param email User's email address
   * @returns Promise with success status
   */
  static async resendVerificationEmail(email: string): Promise<ApiResponse<null>> {
    try {
      // Use database function to resend verification (if available)
      const { data, error } = await supabase.rpc('send_verification_email', {
        user_email: email.toLowerCase()
      });

      if (error) {
        return {
          success: false,
          error: 'Failed to send verification email'
        };
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to send verification email'
        };
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Resend verification email error:', error);
      return {
        success: false,
        error: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Check if user has required role
   * @param user User object
   * @param requiredRole Required role to check
   * @returns Boolean indicating if user has required role
   */
  static hasRole(user: User | null, requiredRole: UserRole): boolean {
    if (!user) return false;
    
    // Super admin has access to everything
    if (user.role === 'super_admin') return true;
    
    // Check specific role
    return user.role === requiredRole;
  }

  /**
   * Check if user can access resource based on role hierarchy
   * @param user Current user
   * @param resourceRole Role required to access resource
   * @returns Boolean indicating access permission
   */
  static canAccess(user: User | null, resourceRole: UserRole): boolean {
    if (!user) return false;

    const roleHierarchy: Record<UserRole, number> = {
      'borrower': 1,
      'lender': 2,
      'super_admin': 3
    };

    return roleHierarchy[user.role] >= roleHierarchy[resourceRole];
  }

  /**
   * Subscribe to authentication state changes
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function
   */
  static onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Validate email format
   * @param email Email to validate
   * @returns Boolean indicating if email is valid
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate phone number format
   * @param phone Phone number to validate
   * @returns Boolean indicating if phone is valid
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.trim());
  }

  /**
   * Validate UUID format
   * @param uuid UUID to validate
   * @returns Boolean indicating if UUID is valid
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate password strength
   * @param password Password to validate
   * @returns Object with validation result and message
   */
  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters long' };
    }

    if (password.length < 8) {
      return { isValid: false, message: 'Password should be at least 8 characters for better security' };
    }

    // Check for at least one number and one letter
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);

    if (!hasNumber || !hasLetter) {
      return { isValid: false, message: 'Password should contain both letters and numbers' };
    }

    return { isValid: true };
  }

  /**
   * Format authentication error messages for user display
   * @param errorMessage Raw error message
   * @returns User-friendly error message
   */
  private static formatAuthError(errorMessage: string): string {
    const errorMappings: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials.',
      'Email not confirmed': 'Please check your email and click the confirmation link.',
      'User already registered': 'An account with this email already exists.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'Unable to validate email address: invalid format': 'Please enter a valid email address.',
      'signup_disabled': 'New registrations are currently disabled.',
      'User not found': 'Invalid email or password. Please check your credentials.',
      'Invalid email': 'Please enter a valid email address.',
      'Signup disabled': 'New registrations are currently disabled.',
      'Too many requests': 'Too many login attempts. Please wait a moment and try again.'
    };

    return errorMappings[errorMessage] || errorMessage;
  }
}