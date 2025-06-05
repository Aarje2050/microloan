// src/screens/superadmin/SuperAdminDashboardScreen.tsx
// Enterprise Super Admin Dashboard with real-time analytics and management tools
// Provides comprehensive system overview and administrative functions

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

import { AnalyticsService } from '../../services/analytics/analyticsService';
import { AuthService } from '../../services/auth/authService';
import { SuperAdminDashboard, LenderPerformance } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { UniversalSignOutService } from '../../services/auth/universalSignOutService';



export const SuperAdminDashboardScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ALSO UPDATE THE useQuery CONFIGURATION
const { 
  data: dashboardData, 
  isLoading, 
  error, 
  refetch 
} = useQuery({
  queryKey: ['superAdminDashboard'],
  queryFn: () => AnalyticsService.getSuperAdminDashboard(),
  refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  staleTime: 5000, // REDUCED - Consider data stale after 5 seconds for web
  refetchOnWindowFocus: true, // ADDED - Refetch when window gains focus
  refetchOnMount: true, // ADDED - Always refetch on mount
});
  
  useFocusEffect(
    useCallback(() => {
      // Refetch data when tab comes into focus
      refetch();
    }, [refetch])
  );
  /**
   * Handle pull-to-refresh functionality
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['superAdminDashboard'] });
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

//  Handle logout functionality
const handleLogout = async () => {
  UniversalSignOutService.handleSignOut();
};
  /**
   * Get status color based on system health
   */
  const getSystemHealthColor = (analytics: any): string => {
    if (analytics.total_loans === 0) return '#f44336'; // Critical
    if (analytics.default_rate > 10) return '#ff9800'; // Warning
    return '#4caf50'; // Good
  };

  /**
   * Get status badge for loan status
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

  // Show loading state - FIXED CONDITION
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="analytics" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
        <View style={styles.loadingDots}>
          <Text style={styles.loadingDot}>•</Text>
          <Text style={styles.loadingDot}>•</Text>
          <Text style={styles.loadingDot}>•</Text>
        </View>
      </View>
    );
  }

  // Show error state - FIXED CONDITION
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="airplane" size={48} color="#f44336" />
        <Text style={styles.errorText}>Connection Problem</Text>
        <Text style={styles.errorSubtext}>
          Please check your internet connection and try again
        </Text>
        <Button
          title="Retry Connection"
          onPress={() => refetch()}
          buttonStyle={styles.retryButton}
          icon={<Ionicons name="refresh" size={16} color="white" style={{ marginRight: 8 }} />}
        />
      </View>
    );
  }

  // Show no data state - NEW CONDITION
  if (!dashboardData || !dashboardData.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="document-text-outline" size={48} color="#ff9800" />
        <Text style={styles.errorText}>No Data Available</Text>
        <Text style={styles.errorSubtext}>
          Dashboard data is not available at the moment
        </Text>
        <Button
          title="Refresh Data"
          onPress={() => refetch()}
          buttonStyle={[styles.retryButton, { backgroundColor: '#ff9800' }]}
          icon={<Ionicons name="refresh" size={16} color="white" style={{ marginRight: 8 }} />}
        />
      </View>
    );
  }

  const { analytics, recent_loans, top_lenders, overdue_summary } = dashboardData.data!;

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
            <Text style={styles.headerTitle}>System Overview</Text>
            <Text style={styles.headerSubtitle}>
              Last updated: {formatDate(new Date(), 'short')}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#f44336" />
          </TouchableOpacity>
        </View>

        {/* Key Metrics Cards */}
        <View style={styles.metricsGrid}>
          
          {/* Total Loans */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="document-text" size={24} color="#2196f3" />
              <Text style={styles.metricValue}>{analytics.total_loans}</Text>
            </View>
            <Text style={styles.metricLabel}>Total Loans</Text>
            <Text style={styles.metricSubLabel}>
              {analytics.active_loans} active
            </Text>
          </View>

          {/* Total Disbursed */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cash" size={24} color="#4caf50" />
              <Text style={styles.metricValue}>
                {formatCurrency(analytics.total_amount_disbursed)}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Disbursed</Text>
            <Text style={styles.metricSubLabel}>
              Avg: {formatCurrency(analytics.average_ticket_size)}
            </Text>
          </View>

          {/* Collection Rate */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="trending-up" size={24} color="#ff9800" />
              <Text style={styles.metricValue}>
                {analytics.total_amount_collected > 0 
                  ? `${((analytics.total_amount_collected / analytics.total_amount_disbursed) * 100).toFixed(1)}%`
                  : '0%'
                }
              </Text>
            </View>
            <Text style={styles.metricLabel}>Collection Rate</Text>
            <Text style={styles.metricSubLabel}>
              {formatCurrency(analytics.total_amount_collected)} collected
            </Text>
          </View>

          {/* Default Rate */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons 
                name="warning" 
                size={24} 
                color={analytics.default_rate > 10 ? '#f44336' : '#4caf50'} 
              />
              <Text style={[
                styles.metricValue,
                { color: analytics.default_rate > 10 ? '#f44336' : '#333' }
              ]}>
                {analytics.default_rate}%
              </Text>
            </View>
            <Text style={styles.metricLabel}>Default Rate</Text>
            <Text style={styles.metricSubLabel}>
              System health: {analytics.default_rate <= 5 ? 'Good' : analytics.default_rate <= 10 ? 'Warning' : 'Critical'}
            </Text>
          </View>

        </View>

        {/* Overdue Summary Alert */}
        {overdue_summary.count > 0 && (
          <View style={styles.overdueAlert}>
            <View style={styles.overdueHeader}>
              <Ionicons name="alert-circle" size={20} color="#f44336" />
              <Text style={styles.overdueTitle}>Overdue EMIs Alert</Text>
            </View>
            <Text style={styles.overdueText}>
              {overdue_summary.count} EMIs overdue • {formatCurrency(overdue_summary.amount)} pending
            </Text>
            <Button
              title="View Details"
              type="outline"
              buttonStyle={styles.overdueButton}
              titleStyle={styles.overdueButtonText}
              onPress={() => {
                // Navigate to overdue loans screen (Phase 3)
                Alert.alert('Feature Coming Soon', 'Overdue loans management will be available in the next update.');
              }}
            />
          </View>
        )}

        {/* Top Performing Lenders */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Top Performing Lenders</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          {top_lenders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-add" size={32} color="#9e9e9e" />
              <Text style={styles.emptyStateText}>No lenders found</Text>
              <Text style={styles.emptyStateSubtext}>Create lender accounts to start managing loans</Text>
            </View>
          ) : (
            top_lenders.map((lenderPerf, index) => (
              <View key={lenderPerf.lender.id} style={styles.lenderItem}>
                <View style={styles.lenderInfo}>
                  <Avatar
                    size="small"
                    rounded
                    title={lenderPerf.lender.full_name.charAt(0).toUpperCase()}
                    overlayContainerStyle={{ backgroundColor: '#2196f3' }}
                  />
                  <View style={styles.lenderDetails}>
                    <Text style={styles.lenderName}>{lenderPerf.lender.full_name}</Text>
                    <Text style={styles.lenderStats}>
                      {lenderPerf.total_borrowers} borrowers • {lenderPerf.total_loans} loans
                    </Text>
                  </View>
                </View>
                <View style={styles.lenderMetrics}>
                  <Text style={styles.collectionRate}>
                    {lenderPerf.collection_rate.toFixed(1)}%
                  </Text>
                  <Text style={styles.metricLabel}>Collection</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Loans */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Recent Loans</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          {recent_loans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document" size={32} color="#9e9e9e" />
              <Text style={styles.emptyStateText}>No loans found</Text>
              <Text style={styles.emptyStateSubtext}>Loans will appear here once created</Text>
            </View>
          ) : (
            recent_loans.slice(0, 5).map((loan: any) => (
              <View key={loan.id} style={styles.loanItem}>
                <View style={styles.loanInfo}>
                  <Text style={styles.loanNumber}>{loan.loan_number}</Text>
                  <Text style={styles.borrowerName}>{loan.borrower_name}</Text>
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
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Alert.alert('Feature Coming Soon', 'Lender management will be available in the next update.');
              }}
            >
              <Ionicons name="person-add" size={24} color="#2196f3" />
              <Text style={styles.actionButtonText}>Add Lender</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Alert.alert('Feature Coming Soon', 'Reports generation will be available in the next update.');
              }}
            >
              <Ionicons name="document-text" size={24} color="#4caf50" />
              <Text style={styles.actionButtonText}>Generate Report</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Alert.alert('Feature Coming Soon', 'System settings will be available in the next update.');
              }}
            >
              <Ionicons name="settings" size={24} color="#ff9800" />
              <Text style={styles.actionButtonText}>Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={24} color="#9c27b0" />
              <Text style={styles.actionButtonText}>Refresh Data</Text>
            </TouchableOpacity>
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
    paddingBottom: Platform.OS === 'web' ? 90 : 95, // Space for bottom tabs

  },
  content: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 20, // Extra space at bottom

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
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  overdueAlert: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  overdueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginLeft: 8,
  },
  overdueText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 12,
  },
  overdueButton: {
    borderColor: '#f44336',
    borderRadius: 6,
    paddingVertical: 8,
  },
  overdueButtonText: {
    color: '#f44336',
    fontSize: 12,
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
  lenderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lenderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lenderDetails: {
    marginLeft: 12,
    flex: 1,
  },
  lenderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lenderStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  lenderMetrics: {
    alignItems: 'center',
  },
  collectionRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50',
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
  // ADD THESE NEW STYLES TO THE EXISTING STYLES OBJECT

  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  loadingDot: {
    fontSize: 20,
    color: '#2196f3',
    marginHorizontal: 4,
    opacity: 0.7,
  },

  
});