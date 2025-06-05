// src/screens/borrower/BorrowerDashboardScreen.tsx
// Enterprise Borrower Dashboard with comprehensive loan portfolio analytics
// Real-time EMI tracking, payment history, and loan performance insights

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity 
} from 'react-native';
import { 
  Card, 
  Button, 
  Avatar, 
  Divider,
  Badge 
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { LoanService } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User, Loan, BorrowerStackParamList, BorrowerTabParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type
type BorrowerDashboardNavigationProp = CompositeNavigationProp<
  StackNavigationProp<BorrowerStackParamList>,
  BottomTabNavigationProp<BorrowerTabParamList, 'Dashboard'>
>;

interface BorrowerAnalytics {
  total_loans: number;
  active_loans: number;
  total_borrowed: number;
  total_paid: number;
  outstanding_amount: number;
  upcoming_emi_amount: number;
  upcoming_emi_date: string | null;
  overdue_amount: number;
  payment_score: number;
  credit_health: 'excellent' | 'good' | 'fair' | 'poor';
}

interface UpcomingEMI {
  id: string;
  emi_number: number;
  due_date: string;
  amount: number;
  loan_number: string;
  days_until_due: number;
  status: string;
}

interface RecentActivity {
  recent_payments: any[];
  upcoming_emis: UpcomingEMI[];
  loan_updates: any[];
}

export const BorrowerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<BorrowerDashboardNavigationProp>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch borrower analytics
  const { 
    data: analyticsResponse, 
    isLoading: analyticsLoading, 
    error: analyticsError,
    refetch: refetchAnalytics 
  } = useQuery({
    queryKey: ['borrowerAnalytics', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getBorrowerAnalytics(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
  });

  // Fetch recent activity
  const { 
    data: activityResponse,
    isLoading: activityLoading,
    refetch: refetchActivity 
  } = useQuery({
    queryKey: ['borrowerActivity', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getBorrowerActivity(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
  });

  /**
   * Get borrower-specific analytics - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerAnalytics = async (userId: string): Promise<{ success: boolean; data?: BorrowerAnalytics }> => {
    try {
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          *,
          loans(*,
            emis(*),
            payments(*)
          )
        `)
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single() to handle missing records

      // FIXED: If no borrower record exists, return default analytics
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower analytics error:', borrowerError);
        return { success: false };
      }

      // FIXED: Handle case where user has no borrower record (new user)
      if (!borrowerData) {
        return {
          success: true,
          data: {
            total_loans: 0,
            active_loans: 0,
            total_borrowed: 0,
            total_paid: 0,
            outstanding_amount: 0,
            upcoming_emi_amount: 0,
            upcoming_emi_date: null,
            overdue_amount: 0,
            payment_score: 100,
            credit_health: 'excellent'
          }
        };
      }

      const loans = borrowerData.loans || [];
      
      // Calculate metrics
      let totalLoans = loans.length;
      let activeLoans = loans.filter((loan: any) => loan.status === 'active').length;
      let totalBorrowed = 0;
      let totalPaid = 0;
      let outstandingAmount = 0;
      let overdueAmount = 0;
      let upcomingEMIAmount = 0;
      let upcomingEMIDate: string | null = null;
      let paymentScore = 100;

      const today = new Date();

      for (const loan of loans) {
        totalBorrowed += loan.principal_amount;
        
        // Calculate paid amount from payments
        const payments = loan.payments || [];
        const loanPaidAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
        totalPaid += loanPaidAmount;

        if (loan.status === 'active') {
          // Calculate outstanding with interest
          const totalLoanAmount = loan.principal_amount * (1 + loan.interest_rate / 100);
          const remaining = Math.max(0, totalLoanAmount - loanPaidAmount);
          outstandingAmount += remaining;

          // Find upcoming EMI
          const emis = loan.emis || [];
          const pendingEMIs = emis.filter((emi: any) => 
            emi.status === 'pending' && new Date(emi.due_date) >= today
          ).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

          if (pendingEMIs.length > 0) {
            const nextEMI = pendingEMIs[0];
            if (!upcomingEMIDate || new Date(nextEMI.due_date) < new Date(upcomingEMIDate)) {
              upcomingEMIAmount = nextEMI.amount;
              upcomingEMIDate = nextEMI.due_date;
            }
          }

          // Calculate overdue EMIs
          const overdueEMIs = emis.filter((emi: any) => 
            emi.status === 'overdue' || (emi.status === 'pending' && new Date(emi.due_date) < today)
          );
          
          for (const overdueEMI of overdueEMIs) {
            overdueAmount += overdueEMI.amount - (overdueEMI.paid_amount || 0);
          }

          // Calculate payment score based on payment history
          const totalEMIs = emis.length;
          const paidEMIs = emis.filter((emi: any) => emi.status === 'paid').length;
          const overdueEMIsCount = overdueEMIs.length;
          
          if (totalEMIs > 0) {
            const onTimePaymentRate = paidEMIs / totalEMIs;
            const overdueRate = overdueEMIsCount / totalEMIs;
            paymentScore = Math.max(0, Math.min(100, (onTimePaymentRate * 100) - (overdueRate * 20)));
          }
        }
      }

      // Determine credit health
      let creditHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (paymentScore < 60) creditHealth = 'poor';
      else if (paymentScore < 75) creditHealth = 'fair';
      else if (paymentScore < 90) creditHealth = 'good';

      return {
        success: true,
        data: {
          total_loans: totalLoans,
          active_loans: activeLoans,
          total_borrowed: totalBorrowed,
          total_paid: totalPaid,
          outstanding_amount: outstandingAmount,
          upcoming_emi_amount: upcomingEMIAmount,
          upcoming_emi_date: upcomingEMIDate,
          overdue_amount: overdueAmount,
          payment_score: paymentScore,
          credit_health: creditHealth
        }
      };

    } catch (error) {
      console.error('Get borrower analytics error:', error);
      return { success: false };
    }
  };

  /**
   * Get recent activity for borrower - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerActivity = async (userId: string): Promise<{ success: boolean; data?: RecentActivity }> => {
    try {
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          id,
          loans(*,
            emis(*),
            payments(*)
          )
        `)
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower activity error:', borrowerError);
        return { success: false };
      }

      // FIXED: Return empty activity if no borrower record exists
      if (!borrowerData) {
        return {
          success: true,
          data: {
            recent_payments: [],
            upcoming_emis: [],
            loan_updates: []
          }
        };
      }

      const loans = borrowerData.loans || [];
      let recentPayments: any[] = [];
      let upcomingEMIs: UpcomingEMI[] = [];

      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const loan of loans) {
        // Get recent payments (last 30 days)
        const payments = loan.payments || [];
        const recent = payments
          .filter((payment: any) => {
            const paymentDate = new Date(payment.payment_date);
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return paymentDate >= thirtyDaysAgo;
          })
          .map((payment: any) => ({
            ...payment,
            loan_number: loan.loan_number
          }));
        
        recentPayments = [...recentPayments, ...recent];

        // Get upcoming EMIs (next 7 days)
        const emis = loan.emis || [];
        const upcoming = emis
          .filter((emi: any) => {
            const dueDate = new Date(emi.due_date);
            return emi.status === 'pending' && dueDate >= today && dueDate <= nextWeek;
          })
          .map((emi: any) => ({
            ...emi,
            loan_number: loan.loan_number,
            days_until_due: Math.ceil((new Date(emi.due_date).getTime() - today.getTime()) / (1000 * 3600 * 24))
          }));
        
        upcomingEMIs = [...upcomingEMIs, ...upcoming];
      }

      // Sort by most recent/upcoming
      recentPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
      upcomingEMIs.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      return {
        success: true,
        data: {
          recent_payments: recentPayments.slice(0, 5),
          upcoming_emis: upcomingEMIs.slice(0, 5),
          loan_updates: [] // Would include status changes, approvals, etc.
        }
      };

    } catch (error) {
      console.error('Get borrower activity error:', error);
      return { success: false };
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAnalytics(), refetchActivity()]);
      queryClient.invalidateQueries({ queryKey: ['borrowerAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['borrowerActivity'] });
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.signOut();
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  /**
   * Get credit health color
   */
  const getCreditHealthColor = (health: string): string => {
    switch (health) {
      case 'excellent': return '#4caf50';
      case 'good': return '#8bc34a';
      case 'fair': return '#ff9800';
      case 'poor': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  /**
   * Get EMI urgency color
   */
  const getEMIUrgencyColor = (daysUntilDue: number): string => {
    if (daysUntilDue <= 1) return '#f44336'; // Red - Due soon
    if (daysUntilDue <= 3) return '#ff9800'; // Orange - Due this week
    return '#4caf50'; // Green - On track
  };

  // Show loading state
  if ((analyticsLoading || activityLoading) && !analyticsResponse && !activityResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="speedometer" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  // Show error state
  if (analyticsError || !analyticsResponse?.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <Button
          title="Retry"
          onPress={() => {
            refetchAnalytics();
            refetchActivity();
          }}
          buttonStyle={styles.retryButton}
        />
      </View>
    );
  }

  const analytics = analyticsResponse.data!;
  const activity = activityResponse?.data || { recent_payments: [], upcoming_emis: [], loan_updates: [] };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Loan Portfolio</Text>
            <Text style={styles.headerSubtitle}>
              Welcome back, {currentUser?.full_name?.split(' ')[0]}
            </Text>
            <Text style={styles.headerTimestamp}>
              Last updated: {formatDate(new Date(), 'short')}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#2196f3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loan Portfolio Summary */}
        <View style={styles.metricsGrid}>
          
          {/* Active Loans */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="document-text" size={24} color="#2196f3" />
              <Text style={styles.metricValue}>{analytics.active_loans}</Text>
            </View>
            <Text style={styles.metricLabel}>Active Loans</Text>
            <Text style={styles.metricSubLabel}>
              {analytics.total_loans} total loans
            </Text>
          </View>

          {/* Outstanding Amount */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="wallet" size={24} color="#ff9800" />
              <Text style={styles.metricValue}>
                {formatCurrency(analytics.outstanding_amount)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Outstanding</Text>
            <Text style={styles.metricSubLabel}>
              Total remaining
            </Text>
          </View>

          {/* Payment Score */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons 
                name="star" 
                size={24} 
                color={getCreditHealthColor(analytics.credit_health)} 
              />
              <Text style={[
                styles.metricValue,
                { color: getCreditHealthColor(analytics.credit_health) }
              ]}>
                {analytics.payment_score.toFixed(0)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Payment Score</Text>
            <Text style={[
              styles.metricSubLabel,
              { color: getCreditHealthColor(analytics.credit_health) }
            ]}>
              {analytics.credit_health.charAt(0).toUpperCase() + analytics.credit_health.slice(1)}
            </Text>
          </View>

          {/* Next EMI */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="calendar" size={24} color="#4caf50" />
              <Text style={styles.metricValue}>
                {analytics.upcoming_emi_amount > 0 
                  ? formatCurrency(analytics.upcoming_emi_amount)
                  : 'None'
                }
              </Text>
            </View>
            <Text style={styles.metricLabel}>Next EMI</Text>
            <Text style={styles.metricSubLabel}>
              {analytics.upcoming_emi_date 
                ? formatDate(new Date(analytics.upcoming_emi_date), 'short')
                : 'No due payments'
              }
            </Text>
          </View>

        </View>

        {/* Urgent EMI Alert */}
        {analytics.upcoming_emi_date && (
          (() => {
            const daysUntil = Math.ceil((new Date(analytics.upcoming_emi_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            if (daysUntil <= 3) {
              return (
                <View style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <Ionicons name="warning" size={20} color="#f44336" />
                    <Text style={styles.alertTitle}>EMI Due Soon</Text>
                  </View>
                  <Text style={styles.alertText}>
                    Your next EMI of {formatCurrency(analytics.upcoming_emi_amount)} is due in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.alertSubtext}>
                    Due date: {formatDate(new Date(analytics.upcoming_emi_date), 'short')}
                  </Text>
                  <TouchableOpacity style={styles.alertAction}>
                    <Text style={styles.alertActionText}>Make Payment Now</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })()
        )}

        {/* Overdue Alert */}
        {analytics.overdue_amount > 0 && (
          <View style={[styles.alertCard, { backgroundColor: '#ffebee', borderLeftColor: '#f44336' }]}>
            <View style={styles.alertHeader}>
              <Ionicons name="alert-circle" size={20} color="#f44336" />
              <Text style={styles.alertTitle}>Overdue Payment</Text>
            </View>
            <Text style={styles.alertText}>
              You have overdue payments totaling {formatCurrency(analytics.overdue_amount)}
            </Text>
            <Text style={styles.alertSubtext}>
              Please make payment immediately to avoid penalties.
            </Text>
            <TouchableOpacity style={styles.alertAction}>
              <Text style={styles.alertActionText}>Pay Overdue Amount</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('MyLoans')}
            >
              <Ionicons name="document-text" size={24} color="#2196f3" />
              <Text style={styles.actionButtonText}>View My Loans</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('PaymentHistory')}
            >
              <Ionicons name="receipt" size={24} color="#4caf50" />
              <Text style={styles.actionButtonText}>Payment History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('EMISchedule', {})}
            >
              <Ionicons name="calendar" size={24} color="#ff9800" />
              <Text style={styles.actionButtonText}>EMI Schedule</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Documents')}
            >
              <Ionicons name="folder" size={24} color="#9c27b0" />
              <Text style={styles.actionButtonText}>My Documents</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming EMIs */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Upcoming EMIs</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          {activity.upcoming_emis.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color="#9e9e9e" />
              <Text style={styles.emptyStateText}>No upcoming EMIs</Text>
              <Text style={styles.emptyStateSubtext}>
                All EMIs are up to date
              </Text>
            </View>
          ) : (
            activity.upcoming_emis.map((emi: UpcomingEMI) => (
              <View key={emi.id} style={styles.emiItem}>
                <View style={styles.emiInfo}>
                  <Text style={styles.emiLoanNumber}>{emi.loan_number}</Text>
                  <Text style={styles.emiDetails}>
                    EMI #{emi.emi_number} • {formatDate(new Date(emi.due_date), 'short')}
                  </Text>
                  <Badge
                    value={`${emi.days_until_due} day${emi.days_until_due !== 1 ? 's' : ''} left`}
                    badgeStyle={{ 
                      backgroundColor: getEMIUrgencyColor(emi.days_until_due),
                      marginTop: 4
                    }}
                    textStyle={{ fontSize: 10 }}
                  />
                </View>
                <View style={styles.emiAmount}>
                  <Text style={styles.emiAmountText}>
                    {formatCurrency(emi.amount)}
                  </Text>
                  <TouchableOpacity style={styles.payButton}>
                    <Text style={styles.payButtonText}>Pay</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Payments */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Recent Payments</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          {activity.recent_payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color="#9e9e9e" />
              <Text style={styles.emptyStateText}>No recent payments</Text>
              <Text style={styles.emptyStateSubtext}>
                Payment history will appear here
              </Text>
            </View>
          ) : (
            activity.recent_payments.map((payment: any) => (
              <View key={payment.id} style={styles.paymentItem}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentLoanNumber}>{payment.loan_number}</Text>
                  <Text style={styles.paymentDate}>
                    {formatDate(new Date(payment.payment_date), 'short')}
                  </Text>
                  <Text style={styles.paymentMethod}>
                    {payment.payment_method.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.paymentAmount}>
                  <Text style={styles.paymentAmountText}>
                    {formatCurrency(payment.amount)}
                  </Text>
                  <Badge 
                    value="Paid" 
                    badgeStyle={{ backgroundColor: '#4caf50' }}
                    textStyle={{ fontSize: 10 }}
                  />
                </View>
              </View>
            ))
          )}

          {activity.recent_payments.length > 0 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('PaymentHistory')}
            >
              <Text style={styles.viewAllText}>View All Payments</Text>
              <Ionicons name="chevron-forward" size={16} color="#2196f3" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loan Portfolio Performance */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Portfolio Performance</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.performanceGrid}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>
                {formatCurrency(analytics.total_borrowed)}
              </Text>
              <Text style={styles.performanceLabel}>Total Borrowed</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={[
                styles.performanceValue,
                { color: '#4caf50' }
              ]}>
                {formatCurrency(analytics.total_paid)}
              </Text>
              <Text style={styles.performanceLabel}>Total Paid</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={[
                styles.performanceValue,
                { color: getCreditHealthColor(analytics.credit_health) }
              ]}>
                {analytics.payment_score.toFixed(0)}%
              </Text>
              <Text style={styles.performanceLabel}>Payment Score</Text>
            </View>
          </View>
          
          <View style={styles.performanceInsight}>
            <Ionicons name="bulb" size={16} color="#ff9800" />
            <Text style={styles.insightText}>
              {analytics.payment_score >= 90 
                ? "Excellent payment history! Keep up the good work to maintain your credit score."
                : analytics.payment_score >= 75
                ? "Good payment track record. Consider setting up auto-pay for better score."
                : "Payment score needs improvement. Pay EMIs on time to boost your credit health."}
            </Text>
          </View>
        </View>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  headerTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
  },
  logoutButton: {
    padding: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  metricSubLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  sectionDivider: {
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  emiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emiInfo: {
    flex: 1,
  },
  emiLoanNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  emiDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emiAmount: {
    alignItems: 'flex-end',
  },
  emiAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  payButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLoanNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  paymentDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentMethod: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  paymentAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '500',
    marginRight: 4,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  performanceItem: {
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  performanceInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  insightText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  alertCard: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f57c00',
    marginLeft: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#f57c00',
    marginBottom: 8,
  },
  alertSubtext: {
    fontSize: 12,
    color: '#e65100',
    marginBottom: 12,
  },
  alertAction: {
    alignSelf: 'flex-start',
  },
  alertActionText: {
    fontSize: 12,
    color: '#f57c00',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});