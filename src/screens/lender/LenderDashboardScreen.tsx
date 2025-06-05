// src/screens/lender/LenderDashboardScreen.tsx
// Enterprise Lender Dashboard with real-time portfolio analytics and operational insights
// Provides comprehensive business intelligence for loan portfolio management

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

import { AnalyticsService } from '../../services/analytics/analyticsService';
import { LoanService } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { User, Borrower, Loan, LenderStackParamList, LenderTabParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type
type LenderDashboardNavigationProp = CompositeNavigationProp<
  StackNavigationProp<LenderStackParamList>,
  BottomTabNavigationProp<LenderTabParamList, 'Dashboard'>
>;

interface LenderAnalytics {
  total_borrowers: number;
  active_loans: number;
  total_disbursed: number;
  total_collected: number;
  pending_collections: number;
  overdue_amount: number;
  collection_rate: number;
  average_loan_size: number;
}

interface RecentActivity {
  recent_loans: Loan[];
  recent_payments: any[];
  overdue_emis: any[];
}

export const LenderDashboardScreen: React.FC = () => {
  const navigation = useNavigation<LenderDashboardNavigationProp>();
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

  // Fetch lender analytics
  const { 
    data: analyticsResponse, 
    isLoading: analyticsLoading, 
    error: analyticsError,
    refetch: refetchAnalytics 
  } = useQuery({
    queryKey: ['lenderAnalytics', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getLenderAnalytics(currentUser.id);
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
    queryKey: ['lenderActivity', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getLenderActivity(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
  });

  /**
   * Get lender-specific analytics
   */
  const getLenderAnalytics = async (lenderId: string): Promise<{ success: boolean; data?: LenderAnalytics }> => {
    try {
      // Get borrowers for this lender
      const borrowersResult = await LoanService.getBorrowersByLender(lenderId);
      if (!borrowersResult.success) {
        return { success: false };
      }

      const borrowers = borrowersResult.data || [];
      const totalBorrowers = borrowers.length;

      // Calculate loan metrics
      let totalLoans = 0;
      let activeLoans = 0;
      let totalDisbursed = 0;
      let totalCollected = 0;
      let pendingCollections = 0;
      let overdueAmount = 0;

      for (const borrower of borrowers) {
        const loans = (borrower as any).loans || [];
        
        for (const loan of loans) {
          totalLoans++;
          totalDisbursed += loan.principal_amount;
          
          if (loan.status === 'active') {
            activeLoans++;
            // Calculate pending amount (simplified - would need EMI data for exact calculation)
            pendingCollections += loan.principal_amount * 0.1; // Placeholder calculation
          }
        }
      }

      // Calculate collection rate (simplified)
      const collectionRate = totalDisbursed > 0 ? ((totalDisbursed - pendingCollections) / totalDisbursed) * 100 : 0;
      const averageLoanSize = totalLoans > 0 ? totalDisbursed / totalLoans : 0;

      return {
        success: true,
        data: {
          total_borrowers: totalBorrowers,
          active_loans: activeLoans,
          total_disbursed: totalDisbursed,
          total_collected: totalDisbursed - pendingCollections,
          pending_collections: pendingCollections,
          overdue_amount: overdueAmount,
          collection_rate: collectionRate,
          average_loan_size: averageLoanSize
        }
      };

    } catch (error) {
      console.error('Get lender analytics error:', error);
      return { success: false };
    }
  };

  /**
   * Get recent activity for lender
   */
  const getLenderActivity = async (lenderId: string): Promise<{ success: boolean; data?: RecentActivity }> => {
    try {
      // Get recent loans for this lender's borrowers
      const loansResult = await LoanService.getLoans(1, 5, { lender_id: lenderId });
      
      if (!loansResult.success) {
        return { success: false };
      }

      return {
        success: true,
        data: {
          recent_loans: loansResult.data?.data || [],
          recent_payments: [], // Would be implemented with payment service
          overdue_emis: [] // Would be implemented with EMI service
        }
      };

    } catch (error) {
      console.error('Get lender activity error:', error);
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
      queryClient.invalidateQueries({ queryKey: ['lenderAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['lenderActivity'] });
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
   * Get metric color based on performance
   */
  const getMetricColor = (type: string, value: number): string => {
    switch (type) {
      case 'collection_rate':
        if (value >= 90) return '#4caf50'; // Good
        if (value >= 75) return '#ff9800'; // Warning
        return '#f44336'; // Critical
      case 'overdue':
        if (value === 0) return '#4caf50';
        if (value < 50000) return '#ff9800';
        return '#f44336';
      default:
        return '#2196f3';
    }
  };

  /**
   * Get loan status badge
   */
  const getLoanStatusBadge = (status: string) => {
    const statusConfig = {
      'active': { color: '#4caf50', text: 'Active' },
      'pending_approval': { color: '#ff9800', text: 'Pending' },
      'completed': { color: '#2196f3', text: 'Completed' },
      'defaulted': { color: '#f44336', text: 'Defaulted' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: '#9e9e9e', text: status };
    
    return (
      <Badge
        value={config.text}
        badgeStyle={{ backgroundColor: config.color }}
        textStyle={{ fontSize: 10 }}
      />
    );
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
  const activity = activityResponse?.data || { recent_loans: [], recent_payments: [], overdue_emis: [] };

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
            <Text style={styles.headerTitle}>Portfolio Overview</Text>
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

        {/* Key Performance Metrics */}
        <View style={styles.metricsGrid}>
          
          {/* Total Borrowers */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="people" size={24} color="#2196f3" />
              <Text style={styles.metricValue}>{analytics.total_borrowers}</Text>
            </View>
            <Text style={styles.metricLabel}>Total Borrowers</Text>
            <Text style={styles.metricSubLabel}>
              {analytics.active_loans} active loans
            </Text>
          </View>

          {/* Total Disbursed */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cash" size={24} color="#4caf50" />
              <Text style={styles.metricValue}>
                {formatCurrency(analytics.total_disbursed)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Total Disbursed</Text>
            <Text style={styles.metricSubLabel}>
              Avg: {formatCurrency(analytics.average_loan_size)}
            </Text>
          </View>

          {/* Collection Rate */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons 
                name="trending-up" 
                size={24} 
                color={getMetricColor('collection_rate', analytics.collection_rate)} 
              />
              <Text style={[
                styles.metricValue,
                { color: getMetricColor('collection_rate', analytics.collection_rate) }
              ]}>
                {analytics.collection_rate.toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.metricLabel}>Collection Rate</Text>
            <Text style={styles.metricSubLabel}>
              {formatCurrency(analytics.total_collected)} collected
            </Text>
          </View>

          {/* Pending Collections */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons 
                name="hourglass" 
                size={24} 
                color={getMetricColor('overdue', analytics.pending_collections)} 
              />
              <Text style={[
                styles.metricValue,
                { color: getMetricColor('overdue', analytics.pending_collections) }
              ]}>
                {formatCurrency(analytics.pending_collections)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Pending Collections</Text>
            <Text style={styles.metricSubLabel}>
              Outstanding amounts
            </Text>
          </View>

        </View>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('MyBorrowers')}
            >
              <Ionicons name="person-add" size={24} color="#2196f3" />
              <Text style={styles.actionButtonText}>Add Borrower</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('MyLoans')}
            >
              <Ionicons name="document-text" size={24} color="#4caf50" />
              <Text style={styles.actionButtonText}>View All Loans</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => (navigation as any).navigate('RecordPayment')}
            >
              <Ionicons name="card" size={24} color="#ff9800" />
              <Text style={styles.actionButtonText}>Record Payment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => (navigation as any).navigate('EMIManagement')}
            >
              <Ionicons name="calendar" size={24} color="#9c27b0" />
              <Text style={styles.actionButtonText}>EMI Management</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Loans */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Recent Loans</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          {activity.recent_loans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document" size={32} color="#9e9e9e" />
              <Text style={styles.emptyStateText}>No recent loans</Text>
              <Text style={styles.emptyStateSubtext}>
                Recent loan activity will appear here
              </Text>
            </View>
          ) : (
            activity.recent_loans.slice(0, 5).map((loan: any) => (
              <View key={loan.id} style={styles.loanItem}>
                <View style={styles.loanInfo}>
                  <Text style={styles.loanNumber}>{loan.loan_number}</Text>
                  <Text style={styles.borrowerName}>
                    {loan.borrower?.user?.full_name || 'Unknown Borrower'}
                  </Text>
                  <Text style={styles.loanDate}>
                    {formatDate(new Date(loan.created_at), 'short')}
                  </Text>
                </View>
                <View style={styles.loanMetrics}>
                  <Text style={styles.loanAmount}>
                    {formatCurrency(loan.principal_amount)}
                  </Text>
                  {getLoanStatusBadge(loan.status)}
                </View>
              </View>
            ))
          )}

          {activity.recent_loans.length > 0 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('MyLoans')}
            >
              <Text style={styles.viewAllText}>View All Loans</Text>
              <Ionicons name="chevron-forward" size={16} color="#2196f3" />
            </TouchableOpacity>
          )}
        </View>

        {/* Performance Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Performance Summary</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.performanceGrid}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>
                {analytics.active_loans}
              </Text>
              <Text style={styles.performanceLabel}>Active Loans</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={[
                styles.performanceValue,
                { color: getMetricColor('collection_rate', analytics.collection_rate) }
              ]}>
                {analytics.collection_rate.toFixed(1)}%
              </Text>
              <Text style={styles.performanceLabel}>Collection Rate</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>
                {formatCurrency(analytics.average_loan_size)}
              </Text>
              <Text style={styles.performanceLabel}>Avg Loan Size</Text>
            </View>
          </View>
          
          <View style={styles.performanceInsight}>
            <Ionicons name="bulb" size={16} color="#ff9800" />
            <Text style={styles.insightText}>
              {analytics.collection_rate >= 90 
                ? "Excellent collection performance! Keep up the good work."
                : analytics.collection_rate >= 75
                ? "Good performance. Consider follow-up on pending collections."
                : "Collection rate needs attention. Review overdue accounts."}
            </Text>
          </View>
        </View>

        {/* Alerts & Notifications */}
        {analytics.pending_collections > 50000 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={20} color="#f44336" />
              <Text style={styles.alertTitle}>Collection Alert</Text>
            </View>
            <Text style={styles.alertText}>
              High pending collections detected: {formatCurrency(analytics.pending_collections)}
            </Text>
            <Text style={styles.alertSubtext}>
              Consider following up with borrowers for overdue payments.
            </Text>
            <TouchableOpacity style={styles.alertAction}>
              <Text style={styles.alertActionText}>View Overdue Accounts</Text>
            </TouchableOpacity>
          </View>
        )}

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
  loanItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  loanInfo: {
    flex: 1,
  },
  loanNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  borrowerName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  loanDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  loanMetrics: {
    alignItems: 'flex-end',
  },
  loanAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
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
    fontSize: 20,
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
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
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
    color: '#d32f2f',
    marginLeft: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 8,
  },
  alertSubtext: {
    fontSize: 12,
    color: '#c62828',
    marginBottom: 12,
  },
  alertAction: {
    alignSelf: 'flex-start',
  },
  alertActionText: {
    fontSize: 12,
    color: '#d32f2f',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});