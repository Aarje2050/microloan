// src/services/analytics/analyticsService.ts
// Enterprise analytics service for real-time system metrics
// Provides comprehensive business intelligence for super admin dashboard

import { supabase } from '../supabase/config';
import { 
  LoanAnalytics, 
  LenderPerformance, 
  SuperAdminDashboard,
  ApiResponse 
} from '../../types';

export class AnalyticsService {

  /**
   * Get comprehensive system analytics for super admin dashboard
   * @returns Promise with complete dashboard data
   */
  static async getSuperAdminDashboard(): Promise<ApiResponse<SuperAdminDashboard>> {
    try {
      // Execute multiple queries in parallel for performance
      const [
        loanAnalytics,
        recentLoans,
        lenderPerformance,
        overdueSummary
      ] = await Promise.all([
        this.getLoanAnalytics(),
        this.getRecentLoans(),
        this.getLenderPerformance(),
        this.getOverdueSummary()
      ]);

      // Check if any query failed
      if (!loanAnalytics.success || !recentLoans.success || 
          !lenderPerformance.success || !overdueSummary.success) {
        return {
          success: false,
          error: 'Failed to load dashboard data. Please try again.'
        };
      }

      const dashboardData: SuperAdminDashboard = {
        analytics: loanAnalytics.data!,
        recent_loans: recentLoans.data!,
        top_lenders: lenderPerformance.data!,
        overdue_summary: overdueSummary.data!
      };

      return {
        success: true,
        data: dashboardData
      };

    } catch (error) {
      console.error('Super admin dashboard error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while loading dashboard.'
      };
    }
  }

  /**
   * Calculate comprehensive loan analytics
   * @returns Promise with loan analytics data
   */
  static async getLoanAnalytics(): Promise<ApiResponse<LoanAnalytics>> {
    try {
      // Get loan counts by status
      const { data: loanCounts, error: loanCountsError } = await supabase
        .from('loans')
        .select('status')
        .is('deleted_at', null);

      if (loanCountsError) {
        throw loanCountsError;
      }

      // Get financial metrics from loans and payments
      const { data: financialData, error: financialError } = await supabase
        .from('loans')
        .select(`
          principal_amount,
          status,
          payments(amount)
        `)
        .is('deleted_at', null);

      if (financialError) {
        throw financialError;
      }

      // Calculate metrics
      const totalLoans = loanCounts?.length || 0;
      const activeLoans = loanCounts?.filter(loan => loan.status === 'active').length || 0;
      
      const totalAmountDisbursed = financialData?.reduce((sum, loan) => 
        sum + (loan.principal_amount || 0), 0) || 0;
      
      const totalAmountCollected = financialData?.reduce((sum, loan) => {
        const loanPayments = loan.payments?.reduce((paymentSum: number, payment: any) => 
          paymentSum + (payment.amount || 0), 0) || 0;
        return sum + loanPayments;
      }, 0) || 0;

      // Calculate default rate (defaulted loans / total loans)
      const defaultedLoans = loanCounts?.filter(loan => loan.status === 'defaulted').length || 0;
      const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;

      // Calculate average ticket size
      const averageTicketSize = totalLoans > 0 ? totalAmountDisbursed / totalLoans : 0;

      const analytics: LoanAnalytics = {
        total_loans: totalLoans,
        active_loans: activeLoans,
        total_amount_disbursed: totalAmountDisbursed,
        total_amount_collected: totalAmountCollected,
        default_rate: Number(defaultRate.toFixed(2)),
        average_ticket_size: Number(averageTicketSize.toFixed(2))
      };

      return {
        success: true,
        data: analytics
      };

    } catch (error) {
      console.error('Loan analytics error:', error);
      return {
        success: false,
        error: 'Failed to calculate loan analytics.'
      };
    }
  }

  /**
   * Get recent loans for dashboard display
   * @returns Promise with recent loans
   */
  static async getRecentLoans(): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('loan_details') // Using our view for optimized query
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Recent loans error:', error);
      return {
        success: false,
        error: 'Failed to load recent loans.'
      };
    }
  }

  /**
   * Get lender performance metrics
   * @returns Promise with lender performance data
   */
  static async getLenderPerformance(): Promise<ApiResponse<LenderPerformance[]>> {
    try {
      // Get lenders with their performance metrics
      const { data: lenders, error: lendersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role,
          phone,
          created_at,
          updated_at
        `)
        .eq('role', 'lender')
        .is('deleted_at', null);

      if (lendersError) {
        throw lendersError;
      }

      // Calculate performance for each lender
      const lenderPerformance: LenderPerformance[] = [];

      for (const lender of lenders || []) {
        // Get borrower count for this lender
        const { data: borrowers, error: borrowersError } = await supabase
          .from('borrowers')
          .select('id')
          .eq('lender_id', lender.id)
          .is('deleted_at', null);

        if (borrowersError) continue;

        // Get loans for this lender's borrowers
        const borrowerIds = borrowers?.map(b => b.id) || [];
        
        if (borrowerIds.length === 0) {
          lenderPerformance.push({
            lender: lender,
            total_borrowers: 0,
            total_loans: 0,
            collection_rate: 0,
            default_rate: 0
          });
          continue;
        }

        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select(`
            id,
            principal_amount,
            status,
            payments(amount)
          `)
          .in('borrower_id', borrowerIds)
          .is('deleted_at', null);

        if (loansError) continue;

        // Calculate metrics
        const totalLoans = loans?.length || 0;
        const defaultedLoans = loans?.filter(l => l.status === 'defaulted').length || 0;
        const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;

        // Calculate collection rate
        const totalDisbursed = loans?.reduce((sum, loan) => sum + loan.principal_amount, 0) || 0;
        const totalCollected = loans?.reduce((sum, loan) => {
          const loanPayments = loan.payments?.reduce((paymentSum: number, payment: any) => 
            paymentSum + payment.amount, 0) || 0;
          return sum + loanPayments;
        }, 0) || 0;
        
        const collectionRate = totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0;

        lenderPerformance.push({
          lender: lender,
          total_borrowers: borrowers?.length || 0,
          total_loans: totalLoans,
          collection_rate: Number(collectionRate.toFixed(2)),
          default_rate: Number(defaultRate.toFixed(2))
        });
      }

      // Sort by collection rate descending
      lenderPerformance.sort((a, b) => b.collection_rate - a.collection_rate);

      return {
        success: true,
        data: lenderPerformance.slice(0, 5) // Top 5 lenders
      };

    } catch (error) {
      console.error('Lender performance error:', error);
      return {
        success: false,
        error: 'Failed to calculate lender performance.'
      };
    }
  }

  /**
   * Get overdue loans summary
   * @returns Promise with overdue summary
   */
  static async getOverdueSummary(): Promise<ApiResponse<{count: number, amount: number}>> {
    try {
      const { data, error } = await supabase
        .from('overdue_emis') // Using our view
        .select('amount');

      if (error) {
        throw error;
      }

      const count = data?.length || 0;
      const amount = data?.reduce((sum, emi) => sum + (emi.amount || 0), 0) || 0;

      return {
        success: true,
        data: { count, amount }
      };

    } catch (error) {
      console.error('Overdue summary error:', error);
      return {
        success: false,
        error: 'Failed to calculate overdue summary.'
      };
    }
  }

  /**
   * Get system-wide statistics for super admin
   * @returns Promise with system statistics
   */
  static async getSystemStats(): Promise<ApiResponse<{
    total_users: number;
    total_lenders: number;
    total_borrowers: number;
    system_health: 'good' | 'warning' | 'critical';
  }>> {
    try {
      // Get user counts by role
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('role')
        .is('deleted_at', null);

      if (usersError) {
        throw usersError;
      }

      const totalUsers = users?.length || 0;
      const totalLenders = users?.filter(u => u.role === 'lender').length || 0;
      const totalBorrowers = users?.filter(u => u.role === 'borrower').length || 0;

      // Determine system health based on activity
      let systemHealth: 'good' | 'warning' | 'critical' = 'good';
      
      if (totalUsers === 0) {
        systemHealth = 'critical';
      } else if (totalLenders === 0 || totalBorrowers === 0) {
        systemHealth = 'warning';
      }

      return {
        success: true,
        data: {
          total_users: totalUsers,
          total_lenders: totalLenders,
          total_borrowers: totalBorrowers,
          system_health: systemHealth
        }
      };

    } catch (error) {
      console.error('System stats error:', error);
      return {
        success: false,
        error: 'Failed to load system statistics.'
      };
    }
  }

  /**
   * Get monthly growth trends
   * @returns Promise with growth data
   */
  static async getGrowthTrends(): Promise<ApiResponse<{
    month: string;
    loans_created: number;
    amount_disbursed: number;
  }[]>> {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('created_at, principal_amount')
        .is('deleted_at', null)
        .gte('created_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 6 months
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group by month
      const monthlyData: { [key: string]: { count: number; amount: number } } = {};
      
      data?.forEach(loan => {
        const month = new Date(loan.created_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        
        if (!monthlyData[month]) {
          monthlyData[month] = { count: 0, amount: 0 };
        }
        
        monthlyData[month].count++;
        monthlyData[month].amount += loan.principal_amount || 0;
      });

      // Convert to array format
      const trends = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        loans_created: data.count,
        amount_disbursed: data.amount
      }));

      return {
        success: true,
        data: trends
      };

    } catch (error) {
      console.error('Growth trends error:', error);
      return {
        success: false,
        error: 'Failed to load growth trends.'
      };
    }
  }
}