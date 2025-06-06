// src/services/users/userService.ts
// Enterprise user management service with complete CRUD operations
// Handles user creation, updates, role management, and security

import { supabase } from '../supabase/config';
import { 
  User, 
  UserRole, 
  ApiResponse, 
  CreateInput, 
  UpdateInput,
  PaginatedResponse 
} from '../../types';
import { EmailVerificationService } from '../auth/emailVerificationService';


export interface CreateUserForm {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: UserRole;
  address?: string;
}

export interface UpdateUserForm {
  full_name?: string;
  phone?: string;
  address?: string;
  active?: boolean;
}

export interface UserListFilters {
  role?: UserRole;
  search?: string;
  active_only?: boolean;
}

export class UserService {

// REPLACE your existing createUser method in userService.ts with this:

/**
 * Create new user with email verification workflow - ENTERPRISE VERSION
 * @param userData User creation data
 * @returns Promise with created user data
 */
static async createUser(userData: CreateUserForm): Promise<ApiResponse<User>> {
  try {
    // Validate input data first
    const validation = this.validateUserData(userData);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.message || 'Invalid user data provided.'
      };
    }

    // Step 1: Use secure database function to validate email and check existence
    const { data: validationResult, error: validationError } = await supabase
      .rpc('create_user_with_validation', {
        p_email: userData.email.toLowerCase(),
        p_full_name: userData.full_name,
        p_phone: userData.phone,
        p_role: userData.role,
        p_address: userData.address || ''
      });

    if (validationError) {
      console.error('Validation function error:', validationError);
      return {
        success: false,
        error: 'User validation failed. Please try again.'
      };
    }

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error
      };
    }

    // Step 2: Create auth user 
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email.toLowerCase(),
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
      console.error('Auth signup error:', authError);
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

    // Step 3: Use secure database function to create user profile
    const { data: profileResult, error: profileError } = await supabase
      .rpc('create_user_profile_secure', {
        p_user_id: authData.user.id,
        p_email: userData.email.toLowerCase(),
        p_full_name: userData.full_name,
        p_phone: userData.phone,
        p_role: userData.role,
        p_address: userData.address || ''
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      
      // Clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      return {
        success: false,
        error: 'Failed to create user profile. Please try again.'
      };
    }

    if (!profileResult.success) {
      // Clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      return {
        success: false,
        error: profileResult.error || 'Failed to create user profile.'
      };
    }

    // Step 4: Send verification email (optional, don't fail if this fails)
    try {
      const emailResult = await EmailVerificationService.sendVerificationEmail(userData.email);
      console.log('Verification email result:', emailResult);
    } catch (emailError) {
      console.warn('Failed to send verification email:', emailError);
      // Don't fail the registration for email issues
    }

    // Step 5: Fetch the created user to return
    const { data: createdUser, error: fetchError } = await supabase
      .from('users')
      .select(`
        *,
        user_profiles(address, kyc_status, avatar_url)
      `)
      .eq('id', authData.user.id)
      .single();

    if (fetchError) {
      console.warn('Could not fetch created user:', fetchError);
      // Return basic user info even if fetch fails
      return {
        success: true,
        data: {
          id: authData.user.id,
          email: userData.email.toLowerCase(),
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
          active: userData.role === 'super_admin',
          email_verified: false,
          pending_approval: userData.role === 'lender',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as User
      };
    }

    return {
      success: true,
      data: createdUser as User
    };

  } catch (error) {
    console.error('Create user unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating user.'
    };
  }
}

/**
 * Check if user can login (active and verified)
 */
static async canUserLogin(email: string): Promise<ApiResponse<{
  canLogin: boolean;
  reason?: string;
  status: 'verified' | 'unverified' | 'pending_approval' | 'not_found';
}>> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, active, email_verified, pending_approval, role')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return {
        success: true,
        data: {
          canLogin: false,
          reason: 'Account not found',
          status: 'not_found'
        }
      };
    }

    if (!user.email_verified) {
      return {
        success: true,
        data: {
          canLogin: false,
          reason: 'Email not verified. Please check your email for verification instructions.',
          status: 'unverified'
        }
      };
    }

    if (!user.active) {
      if (user.pending_approval && user.role === 'lender') {
        return {
          success: true,
          data: {
            canLogin: false,
            reason: 'Your account is pending admin approval. You will receive an email once approved.',
            status: 'pending_approval'
          }
        };
      }

      return {
        success: true,
        data: {
          canLogin: false,
          reason: 'Account is inactive. Please contact support.',
          status: 'unverified'
        }
      };
    }

    return {
      success: true,
      data: {
        canLogin: true,
        status: 'verified'
      }
    };

  } catch (error) {
    console.error('Can user login check error:', error);
    return {
      success: false,
      error: 'Failed to check login eligibility'
    };
  }
}

/**
 * Get pending lender approvals (for super admin)
 */
static async getPendingLenderApprovals(): Promise<ApiResponse<any[]>> {
  try {
    return await EmailVerificationService.getPendingApprovals();
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return {
      success: false,
      error: 'Failed to retrieve pending approvals'
    };
  }
}

/**
 * Approve lender account (for super admin)
 */
static async approveLenderAccount(lenderEmail: string): Promise<ApiResponse<null>> {
  try {
    return await EmailVerificationService.approveLender(lenderEmail);
  } catch (error) {
    console.error('Approve lender error:', error);
    return {
      success: false,
      error: 'Failed to approve lender account'
    };
  }
}

/**
 * Reject lender account (for super admin)
 */
static async rejectLenderAccount(lenderEmail: string): Promise<ApiResponse<null>> {
  try {
    return await EmailVerificationService.rejectLender(lenderEmail);
  } catch (error) {
    console.error('Reject lender error:', error);
    return {
      success: false,
      error: 'Failed to reject lender account'
    };
  }
}

/**
 * Resend verification email
 */
static async resendVerificationEmail(email: string): Promise<ApiResponse<null>> {
  try {
    return await EmailVerificationService.resendVerificationEmail(email);
  } catch (error) {
    console.error('Resend verification email error:', error);
    return {
      success: false,
      error: 'Failed to resend verification email'
    };
  }
}

  /**
   * Get paginated list of users with filters
   * @param page Page number (1-based)
   * @param limit Items per page
   * @param filters Optional filters
   * @returns Promise with paginated user list
   */
  static async getUsers(
    page: number = 1, 
    limit: number = 20, 
    filters?: UserListFilters
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          user_profiles(address, kyc_status)
        `, { count: 'exact' })
        .is('deleted_at', null);

      // Apply filters
      if (filters?.role) {
        query = query.eq('role', filters.role);
      }

      if (filters?.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      // Calculate pagination
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: {
          data: data as User[] || [],
          count: count || 0,
          page,
          limit,
          total_pages: totalPages
        }
      };

    } catch (error) {
      console.error('Get users error:', error);
      return {
        success: false,
        error: 'Failed to load users list.'
      };
    }
  }

  /**
   * Get user by ID with profile data
   * @param userId User ID
   * @returns Promise with user data
   */
  static async getUserById(userId: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_profiles(address, kyc_status, avatar_url)
        `)
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return {
          success: false,
          error: 'User not found.'
        };
      }

      return {
        success: true,
        data: data as User
      };

    } catch (error) {
      console.error('Get user by ID error:', error);
      return {
        success: false,
        error: 'Failed to load user details.'
      };
    }
  }

  /**
   * Update user information
   * @param userId User ID to update
   * @param updates Fields to update
   * @returns Promise with updated user data
   */
  static async updateUser(
    userId: string, 
    updates: UpdateUserForm
  ): Promise<ApiResponse<User>> {
    try {
      // Prepare user table updates
      const userUpdates: any = {};
      if (updates.full_name) userUpdates.full_name = updates.full_name;
      if (updates.phone) userUpdates.phone = updates.phone;

      // Update user record if there are changes
      let updatedUser: User | null = null;
      if (Object.keys(userUpdates).length > 0) {
        const { data, error } = await supabase
          .from('users')
          .update(userUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        updatedUser = data as User;
      }

      // Update user profile if address is provided
      if (updates.address !== undefined) {
        await supabase
          .from('user_profiles')
          .update({ address: updates.address })
          .eq('user_id', userId);
      }

      // If no user update was made, fetch current user
      if (!updatedUser) {
        const result = await this.getUserById(userId);
        if (!result.success) {
          return result;
        }
        updatedUser = result.data!;
      }

      return {
        success: true,
        data: updatedUser
      };

    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: 'Failed to update user information.'
      };
    }
  }

  /**
   * Soft delete user (deactivate)
   * @param userId User ID to deactivate
   * @returns Promise with success status
   */
  static async deactivateUser(userId: string): Promise<ApiResponse<null>> {
    try {
      // Check if user has active relationships
      const activeRelationships = await this.checkActiveRelationships(userId);
      if (activeRelationships.hasActive) {
        return {
          success: false,
          error: `Cannot deactivate user: ${activeRelationships.reason}`
        };
      }

      // Soft delete by setting deleted_at timestamp
      const { error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Deactivate user error:', error);
      return {
        success: false,
        error: 'Failed to deactivate user.'
      };
    }
  }

  /**
   * Reactivate deactivated user
   * @param userId User ID to reactivate
   * @returns Promise with success status
   */
  static async reactivateUser(userId: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ deleted_at: null })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Reactivate user error:', error);
      return {
        success: false,
        error: 'Failed to reactivate user.'
      };
    }
  }

  /**
   * Get user statistics for dashboard
   * @returns Promise with user statistics
   */
  static async getUserStats(): Promise<ApiResponse<{
    total_active: number;
    total_lenders: number;
    total_borrowers: number;
    recent_registrations: number;
  }>> {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('role, created_at')
        .is('deleted_at', null);

      if (error) {
        throw error;
      }

      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        total_active: users?.length || 0,
        total_lenders: users?.filter(u => u.role === 'lender').length || 0,
        total_borrowers: users?.filter(u => u.role === 'borrower').length || 0,
        recent_registrations: users?.filter(u => 
          new Date(u.created_at) > lastWeek
        ).length || 0
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        success: false,
        error: 'Failed to load user statistics.'
      };
    }
  }

  /**
   * Validate user input data
   * @param userData User data to validate
   * @returns Validation result
   */
  private static validateUserData(userData: CreateUserForm): {
    isValid: boolean;
    message?: string;
  } {
    // Email validation
    if (!userData.email || !this.isValidEmail(userData.email)) {
      return { isValid: false, message: 'Please provide a valid email address.' };
    }

    // Password validation
    if (!userData.password || userData.password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters long.' };
    }

    // Name validation
    if (!userData.full_name || userData.full_name.trim().length < 2) {
      return { isValid: false, message: 'Please provide a valid full name.' };
    }

    // Phone validation
    if (!userData.phone || !this.isValidPhone(userData.phone)) {
      return { isValid: false, message: 'Please provide a valid phone number.' };
    }

    // Role validation
    if (!['super_admin', 'lender', 'borrower'].includes(userData.role)) {
      return { isValid: false, message: 'Please select a valid user role.' };
    }

    return { isValid: true };
  }

  /**
   * Check if user has active relationships that prevent deletion
   * @param userId User ID to check
   * @returns Promise with relationship check result
   */
  private static async checkActiveRelationships(userId: string): Promise<{
    hasActive: boolean;
    reason?: string;
  }> {
    try {
      // Check if lender has active borrowers
      const { data: borrowers } = await supabase
        .from('borrowers')
        .select('id')
        .eq('lender_id', userId)
        .is('deleted_at', null);

      if (borrowers && borrowers.length > 0) {
        return {
          hasActive: true,
          reason: `Has ${borrowers.length} active borrower(s). Please reassign or deactivate them first.`
        };
      }

      // Check if borrower has active loans
      const { data: borrowerRecord } = await supabase
        .from('borrowers')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (borrowerRecord) {
        const { data: loans } = await supabase
          .from('loans')
          .select('id')
          .eq('borrower_id', borrowerRecord.id)
          .in('status', ['active', 'pending_approval'])
          .is('deleted_at', null);

        if (loans && loans.length > 0) {
          return {
            hasActive: true,
            reason: `Has ${loans.length} active loan(s). Please close loans before deactivation.`
          };
        }
      }

      return { hasActive: false };

    } catch (error) {
      console.error('Check relationships error:', error);
      return { hasActive: false };
    }
  }

  /**
   * Validate email format
   * @param email Email to validate
   * @returns Boolean indicating if email is valid
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate phone number format
   * @param phone Phone number to validate
   * @returns Boolean indicating if phone is valid
   */
  private static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.trim());
  }

  /**
   * Format authentication error messages
   * @param errorMessage Raw error message
   * @returns User-friendly error message
   */
  private static formatAuthError(errorMessage: string): string {
    const errorMappings: Record<string, string> = {
      'User already registered': 'An account with this email already exists.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'Unable to validate email address: invalid format': 'Please enter a valid email address.',
      'signup_disabled': 'New user registration is currently disabled.',
    };

    return errorMappings[errorMessage] || errorMessage;
  }
  // ADD THESE METHODS TO YOUR EXISTING userService.ts FILE
// Don't replace anything - just add these at the end before the closing }

  /**
   * Get user profile with complete information - NEW METHOD FOR PROFILE SCREEN
   */
  static async getUserProfile(userId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Get user profile error:', error);
        return {
          success: false,
          error: 'Failed to load user profile.'
        };
      }

      // If no profile exists, create one
      if (!data) {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: userId,
            kyc_status: 'pending'
          })
          .select()
          .single();

        if (createError) {
          console.error('Create user profile error:', createError);
          return {
            success: false,
            error: 'Failed to create user profile.'
          };
        }

        return {
          success: true,
          data: newProfile
        };
      }

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Get user profile error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while loading profile.'
      };
    }
  }

  /**
   * Update user profile information - NEW METHOD FOR PROFILE SCREEN
   */
  static async updateUserProfile(
    userId: string, 
    profileData: { avatar_url?: string; address?: string; kyc_status?: string }
  ): Promise<ApiResponse<any>> {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: userId,
            ...profileData,
            kyc_status: profileData.kyc_status || 'pending'
          })
          .select()
          .single();

        if (createError) {
          console.error('Create user profile error:', createError);
          return {
            success: false,
            error: 'Failed to create user profile.'
          };
        }

        return {
          success: true,
          data: newProfile
        };
      }

      // Update existing profile
      const { data, error } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update user profile error:', error);
        return {
          success: false,
          error: 'Failed to update user profile.'
        };
      }

      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Update user profile error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while updating profile.'
      };
    }
  }


}