// src/services/auth/emailVerificationService.ts
// Enterprise-grade email verification service
// Handles verification emails, token validation, and user activation

import { supabase } from '../supabase/config';
import { ApiResponse, User, UserRole } from '../../types';

export interface VerificationResult {
  success: boolean;
  message: string;
  role?: UserRole;
  active?: boolean;
  pending_approval?: boolean;
  error?: string;
}

export interface PendingApproval {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
  email_verified_at?: string;
}

export class EmailVerificationService {

  static async sendVerificationEmail(email: string): Promise<ApiResponse<null>> {
    try {
      // Just update our database tracking, no custom email needed
      const { data, error } = await supabase.rpc('send_verification_email', {
        user_email: email.toLowerCase()
      });
  
      if (error) {
        console.error('Generate verification link error:', error);
        return {
          success: false,
          error: 'Failed to generate verification link'
        };
      }
  
      return {
        success: true,
        data: null
      };
  
    } catch (error) {
      console.error('Send verification email error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while sending verification email'
      };
    }
  }
  /**
   * Verify email using token
   */
  static async verifyEmail(token: string): Promise<ApiResponse<VerificationResult>> {
    try {
      if (!token || !this.isValidUUID(token)) {
        return {
          success: false,
          error: 'Invalid verification token format'
        };
      }

      // Use database function to verify email
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
   * Check verification status for a user
   */
  static async getVerificationStatus(userId: string): Promise<ApiResponse<{
    email_verified: boolean;
    active: boolean;
    pending_approval: boolean;
    role: UserRole;
  }>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email_verified, active, pending_approval, role')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          success: false,
          error: 'Failed to check verification status'
        };
      }

      return {
        success: true,
        data: {
          email_verified: data.email_verified || false,
          active: data.active || false,
          pending_approval: data.pending_approval || false,
          role: data.role
        }
      };

    } catch (error) {
      console.error('Get verification status error:', error);
      return {
        success: false,
        error: 'Failed to retrieve verification status'
      };
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string): Promise<ApiResponse<null>> {
    try {
      // Check if user exists and is not verified
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email_verified, active, role')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (user.email_verified) {
        return {
          success: false,
          error: 'Email is already verified'
        };
      }

      if (user.active) {
        return {
          success: false,
          error: 'Account is already active'
        };
      }

      // Check verification attempts
      const { data: verification, error: verificationError } = await supabase
        .from('email_verifications')
        .select('attempts')
        .eq('user_id', user.id)
        .single();

      if (verification && verification.attempts >= 5) {
        return {
          success: false,
          error: 'Too many verification attempts. Please contact support.'
        };
      }

      // Send new verification email
      return await this.sendVerificationEmail(email);

    } catch (error) {
      console.error('Resend verification email error:', error);
      return {
        success: false,
        error: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Get pending lender approvals (for super admin)
   */
  static async getPendingApprovals(): Promise<ApiResponse<PendingApproval[]>> {
    try {
      const { data, error } = await supabase
        .from('pending_lender_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch pending approvals'
        };
      }

      return {
        success: true,
        data: data as PendingApproval[] || []
      };

    } catch (error) {
      console.error('Get pending approvals error:', error);
      return {
        success: false,
        error: 'Failed to retrieve pending approvals'
      };
    }
  }

  /**
   * Approve a lender (for super admin)
   */
  static async approveLender(lenderEmail: string): Promise<ApiResponse<null>> {
    try {
      const { data, error } = await supabase.rpc('approve_lender', {
        lender_email: lenderEmail.toLowerCase()
      });

      if (error) {
        console.error('Approve lender error:', error);
        return {
          success: false,
          error: 'Failed to approve lender'
        };
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to approve lender'
        };
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Approve lender error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while approving lender'
      };
    }
  }

  /**
   * Reject/Delete a pending lender application
   */
  static async rejectLender(lenderEmail: string): Promise<ApiResponse<null>> {
    try {
      // Soft delete the user (set deleted_at)
      const { error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('email', lenderEmail.toLowerCase())
        .eq('role', 'lender')
        .eq('pending_approval', true);

      if (error) {
        console.error('Reject lender error:', error);
        return {
          success: false,
          error: 'Failed to reject lender application'
        };
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Reject lender error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while rejecting lender'
      };
    }
  }

  /**
   * Clean up expired verifications (admin utility)
   */
  static async cleanupExpiredVerifications(): Promise<ApiResponse<null>> {
    try {
      const { error } = await supabase.rpc('cleanup_expired_verifications');

      if (error) {
        console.error('Cleanup expired verifications error:', error);
        return {
          success: false,
          error: 'Failed to cleanup expired verifications'
        };
      }

      return {
        success: true,
        data: null
      };

    } catch (error) {
      console.error('Cleanup expired verifications error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during cleanup'
      };
    }
  }

  /**
   * Get verification statistics (for admin dashboard)
   */
  static async getVerificationStats(): Promise<ApiResponse<{
    total_unverified: number;
    pending_approvals: number;
    expired_verifications: number;
  }>> {
    try {
      // Get unverified users count
      const { count: unverifiedCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('email_verified', false)
        .eq('active', false)
        .is('deleted_at', null);

      // Get pending approvals count
      const { count: pendingCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('email_verified', true)
        .eq('pending_approval', true)
        .eq('active', false)
        .is('deleted_at', null);

      // Get expired verifications count
      const { count: expiredCount } = await supabase
        .from('email_verifications')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())
        .is('verified_at', null);

      return {
        success: true,
        data: {
          total_unverified: unverifiedCount || 0,
          pending_approvals: pendingCount || 0,
          expired_verifications: expiredCount || 0
        }
      };

    } catch (error) {
      console.error('Get verification stats error:', error);
      return {
        success: false,
        error: 'Failed to retrieve verification statistics'
      };
    }
  }

  /**
   * Validate UUID format
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Format verification email template
   */
  static getVerificationEmailTemplate(userFullName: string, verificationLink: string): {
    subject: string;
    htmlBody: string;
    textBody: string;
  } {
    const subject = 'Verify Your MicroLoan Manager Account';
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196f3; color: white; padding: 20px; text-align: center;">
          <h1>MicroLoan Manager</h1>
          <p>Professional Loan Management Platform</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2>Welcome, ${userFullName}!</h2>
          <p>Thank you for registering with MicroLoan Manager. To complete your account setup, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4caf50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify My Email
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #eeeeee; padding: 10px; border-radius: 3px;">
            ${verificationLink}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in 24 hours</li>
              <li>If you didn't create this account, please ignore this email</li>
              <li>For support, contact: support@microloan.com</li>
            </ul>
          </div>
        </div>
        
        <div style="background-color: #666; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 MicroLoan Manager. Secure • Professional • Reliable</p>
        </div>
      </div>
    `;
    
    const textBody = `
      MicroLoan Manager - Email Verification
      
      Welcome, ${userFullName}!
      
      Thank you for registering with MicroLoan Manager. To complete your account setup, please verify your email address by visiting:
      
      ${verificationLink}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, please ignore this email.
      
      For support, contact: support@microloan.com
      
      © 2024 MicroLoan Manager. Secure • Professional • Reliable
    `;
    
    return { subject, htmlBody, textBody };
  }
}