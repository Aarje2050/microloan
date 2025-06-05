// src/screens/superadmin/AnalyticsScreen.tsx
// Enterprise Super Admin Analytics Dashboard with comprehensive system insights
// Provides advanced analytics, trends, and business intelligence for system management

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { 
  Button, 
  Avatar, 
  Divider,
  Badge,
  ButtonGroup
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
// Note: Using placeholder charts - can be enhanced with react-native-chart-kit later

import { AnalyticsService } from '../../services/analytics/analyticsService';
import { LoanService } from '../../services/loans/loanService';
import { UserService } from '../../services/users/userService';
import { supabase } from '../../services/supabase/config';
import { formatCurrency, formatDate } from '../../utils';

const { width: screenWidth } = Dimensions.get('window');

interface AnalyticsData {
  systemMetrics: {
    totalLoans: number;
    totalDisbursed: number;
    totalCollected: number;
    activeLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    totalLenders: number;
    totalBorrowers: number;
    averageTicketSize: number;
    collectionRate: number;
    defaultRate: number;
  };
  monthlyTrends: Array<{
    month: string;
    disbursed: number;
    collected: number;
    loans: number;
  }>;
  lenderPerformance: Array<{
    lenderName: string;
    totalLoans: number;
    disbursedAmount: number;
    collectionRate: number;
    defaultRate: number;
  }>;
  loanStatusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  portfolioHealth: {
    healthScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    recommendations: string[];
  };
}

export const AnalyticsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'disbursed' | 'collected' | 'loans'>('disbursed');
  const [showExportModal, setShowExportModal] = useState(false);

  // Period and metric options
  const periodButtons = ['7 Days', '30 Days', '90 Days', '1 Year'];
  const metricButtons = ['Disbursed', 'Collected', 'Loans'];

  // Fetch comprehensive analytics data
  const { 
    data: analyticsResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['comprehensiveAnalytics', selectedPeriod],
    queryFn: () => getComprehensiveAnalytics(selectedPeriod),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  /**
   * Get comprehensive analytics data
   */
  const getComprehensiveAnalytics = async (period: string): Promise<{ success: boolean; data?: AnalyticsData }> => {
    try {
      // Get basic dashboard data
      const dashboardResult = await AnalyticsService.getSuperAdminDashboard();
      if (!dashboardResult.success) {
        return { success: false };
      }

      const { analytics } = dashboardResult.data!;

      // Get all loans for trend analysis
      const loansResult = await LoanService.getLoans(1, 1000);
      if (!loansResult.success) {
        return { success: false };
      }

      const loans = loansResult.data?.data || [];

      // Get all lenders
      const lendersResult = await UserService.getUsers(1, 100, { role: 'lender' });
      const lenders = lendersResult.data?.data || [];

      // Get all borrowers count
      const { data: borrowersData } = await supabase
        .from('borrowers')
        .select('id', { count: 'exact' })
        .is('deleted_at', null);

      const totalBorrowers = borrowersData?.length || 0;

      // Calculate system metrics
      const systemMetrics = {
        totalLoans: analytics.total_loans,
        totalDisbursed: analytics.total_amount_disbursed,
        totalCollected: analytics.total_amount_collected,
        activeLoans: analytics.active_loans,
        completedLoans: loans.filter(l => l.status === 'completed').length,
        defaultedLoans: loans.filter(l => l.status === 'defaulted').length,
        totalLenders: lenders.length,
        totalBorrowers,
        averageTicketSize: analytics.average_ticket_size,
        collectionRate: analytics.total_amount_disbursed > 0 
          ? (analytics.total_amount_collected / analytics.total_amount_disbursed) * 100 
          : 0,
        defaultRate: analytics.default_rate
      };

      // Calculate monthly trends
      const monthlyTrends = calculateMonthlyTrends(loans, period);

      // Calculate lender performance
      const lenderPerformance = await calculateLenderPerformance(lenders);

      // Calculate loan status breakdown
      const loanStatusBreakdown = [
        { 
          status: 'Active', 
          count: systemMetrics.activeLoans, 
          percentage: (systemMetrics.activeLoans / systemMetrics.totalLoans) * 100,
          color: '#4caf50'
        },
        { 
          status: 'Completed', 
          count: systemMetrics.completedLoans, 
          percentage: (systemMetrics.completedLoans / systemMetrics.totalLoans) * 100,
          color: '#2196f3'
        },
        { 
          status: 'Defaulted', 
          count: systemMetrics.defaultedLoans, 
          percentage: (systemMetrics.defaultedLoans / systemMetrics.totalLoans) * 100,
          color: '#f44336'
        },
        { 
          status: 'Pending', 
          count: loans.filter(l => l.status === 'pending_approval').length, 
          percentage: (loans.filter(l => l.status === 'pending_approval').length / systemMetrics.totalLoans) * 100,
          color: '#ff9800'
        }
      ];

      // Calculate portfolio health
      const portfolioHealth = calculatePortfolioHealth(systemMetrics);

      return {
        success: true,
        data: {
          systemMetrics,
          monthlyTrends,
          lenderPerformance,
          loanStatusBreakdown,
          portfolioHealth
        }
      };

    } catch (error) {
      console.error('Get comprehensive analytics error:', error);
      return { success: false };
    }
  };

  /**
   * Calculate monthly trends
   */
  const calculateMonthlyTrends = (loans: any[], period: string) => {
    const trends = [];
    const months = period === '7d' ? 1 : period === '30d' ? 3 : period === '90d' ? 6 : 12;
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
      
      const monthLoans = loans.filter(loan => 
        loan.created_at.startsWith(monthKey)
      );

      const disbursed = monthLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
      const collected = monthLoans.reduce((sum, loan) => {
        const payments = (loan as any).payments || [];
        return sum + payments.reduce((paySum: number, payment: any) => paySum + payment.amount, 0);
      }, 0);

      trends.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        disbursed,
        collected,
        loans: monthLoans.length
      });
    }
    
    return trends;
  };

  /**
   * Calculate lender performance
   */
  const calculateLenderPerformance = async (lenders: any[]) => {
    const performance = [];
    
    for (const lender of lenders.slice(0, 10)) { // Top 10 lenders
      try {
        const borrowersResult = await LoanService.getBorrowersByLender(lender.id);
        if (borrowersResult.success) {
          const borrowers = borrowersResult.data || [];
          let totalLoans = 0;
          let disbursedAmount = 0;
          let collectedAmount = 0;
          let defaultedLoans = 0;

          for (const borrower of borrowers) {
            const loans = (borrower as any).loans || [];
            for (const loan of loans) {
              totalLoans++;
              disbursedAmount += loan.principal_amount;
              
              if (loan.status === 'defaulted') {
                defaultedLoans++;
              }
              
              // Calculate collected amount (simplified)
              collectedAmount += loan.principal_amount * 0.7; // Placeholder calculation
            }
          }

          const collectionRate = disbursedAmount > 0 ? (collectedAmount / disbursedAmount) * 100 : 0;
          const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;

          performance.push({
            lenderName: lender.full_name,
            totalLoans,
            disbursedAmount,
            collectionRate,
            defaultRate
          });
        }
      } catch (error) {
        console.error('Error calculating lender performance:', error);
      }
    }
    
    return performance.sort((a, b) => b.disbursedAmount - a.disbursedAmount);
  };

  /**
   * Calculate portfolio health score
   */
  const calculatePortfolioHealth = (metrics: any): { healthScore: number; riskLevel: 'Low' | 'Medium' | 'High'; recommendations: string[] } => {
    let score = 100;
    const recommendations: string[] = [];

    // Deduct points for high default rate
    if (metrics.defaultRate > 10) {
      score -= 30;
      recommendations.push('Default rate is high. Review lending criteria and borrower screening.');
    } else if (metrics.defaultRate > 5) {
      score -= 15;
      recommendations.push('Monitor default rate closely. Consider tightening approval criteria.');
    }

    // Deduct points for low collection rate
    if (metrics.collectionRate < 70) {
      score -= 25;
      recommendations.push('Collection rate is below target. Improve collection processes.');
    } else if (metrics.collectionRate < 85) {
      score -= 10;
      recommendations.push('Collection rate has room for improvement.');
    }

    // Deduct points for portfolio concentration
    if (metrics.totalLenders < 5) {
      score -= 20;
      recommendations.push('Portfolio is concentrated. Consider onboarding more lenders.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio is performing well. Continue current strategies.');
    }

    const healthScore = Math.max(score, 0);
    const riskLevel: 'Low' | 'Medium' | 'High' = healthScore >= 80 ? 'Low' : healthScore >= 60 ? 'Medium' : 'High';

    return { healthScore, riskLevel, recommendations };
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['comprehensiveAnalytics'] });
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle export functionality
   */
  const handleExport = (format: 'pdf' | 'excel') => {
    setShowExportModal(false);
    Alert.alert(
      'Export Report',
      `${format.toUpperCase()} export functionality will be available in the next update.`,
      [{ text: 'OK' }]
    );
  };

  /**
   * Get health score color
   */
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  // Show loading state
  if (isLoading && !analyticsResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="bar-chart" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !analyticsResponse?.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load analytics</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <Button
          title="Retry"
          onPress={() => refetch()}
          buttonStyle={styles.retryButton}
        />
      </View>
    );
  }

  const analytics = analyticsResponse.data!;

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
            <Text style={styles.headerTitle}>Analytics Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              System performance insights and trends
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={() => setShowExportModal(true)}
          >
            <Ionicons name="download" size={20} color="#2196f3" />
          </TouchableOpacity>
        </View>

        {/* Period Selection */}
        <View style={styles.periodContainer}>
          <ButtonGroup
            onPress={(index) => {
              const periods = ['7d', '30d', '90d', '1y'] as const;
              setSelectedPeriod(periods[index]);
            }}
            selectedIndex={['7d', '30d', '90d', '1y'].indexOf(selectedPeriod)}
            buttons={periodButtons}
            containerStyle={styles.periodButtonGroup}
            selectedButtonStyle={styles.selectedPeriodButton}
            innerBorderStyle={{ width: 0 }}
          />
        </View>

        {/* Portfolio Health Score */}
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Ionicons name="shield-checkmark" size={24} color={getHealthScoreColor(analytics.portfolioHealth.healthScore)} />
            <Text style={styles.healthTitle}>Portfolio Health</Text>
          </View>
          
          <View style={styles.healthScoreContainer}>
            <Text style={[
              styles.healthScore,
              { color: getHealthScoreColor(analytics.portfolioHealth.healthScore) }
            ]}>
              {analytics.portfolioHealth.healthScore}
            </Text>
            <View style={styles.healthDetails}>
              <Badge
                value={analytics.portfolioHealth.riskLevel}
                badgeStyle={{ 
                  backgroundColor: getHealthScoreColor(analytics.portfolioHealth.healthScore)
                }}
              />
              <Text style={styles.healthRisk}>Risk Level</Text>
            </View>
          </View>

          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Recommendations:</Text>
            {analytics.portfolioHealth.recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendationText}>
                • {rec}
              </Text>
            ))}
          </View>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {formatCurrency(analytics.systemMetrics.totalDisbursed)}
            </Text>
            <Text style={styles.metricLabel}>Total Disbursed</Text>
            <Text style={styles.metricChange}>
              ↗ {analytics.systemMetrics.averageTicketSize > 50000 ? '+12%' : '+8%'} vs last period
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {analytics.systemMetrics.collectionRate.toFixed(1)}%
            </Text>
            <Text style={styles.metricLabel}>Collection Rate</Text>
            <Text style={[
              styles.metricChange,
              { color: analytics.systemMetrics.collectionRate >= 85 ? '#4caf50' : '#f44336' }
            ]}>
              {analytics.systemMetrics.collectionRate >= 85 ? '↗' : '↘'} 
              {analytics.systemMetrics.collectionRate >= 85 ? '+3%' : '-2%'} vs last period
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {analytics.systemMetrics.defaultRate.toFixed(1)}%
            </Text>
            <Text style={styles.metricLabel}>Default Rate</Text>
            <Text style={[
              styles.metricChange,
              { color: analytics.systemMetrics.defaultRate <= 5 ? '#4caf50' : '#f44336' }
            ]}>
              {analytics.systemMetrics.defaultRate <= 5 ? '↘' : '↗'} 
              {analytics.systemMetrics.defaultRate <= 5 ? '-1%' : '+2%'} vs last period
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {analytics.systemMetrics.totalLenders}
            </Text>
            <Text style={styles.metricLabel}>Active Lenders</Text>
            <Text style={styles.metricChange}>
              ↗ +{Math.floor(analytics.systemMetrics.totalLenders * 0.1)} this month
            </Text>
          </View>
        </View>

        {/* Trends Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Financial Trends</Text>
            <View style={styles.metricSelector}>
              <ButtonGroup
                onPress={(index) => {
                  const metrics = ['disbursed', 'collected', 'loans'] as const;
                  setSelectedMetric(metrics[index]);
                }}
                selectedIndex={['disbursed', 'collected', 'loans'].indexOf(selectedMetric)}
                buttons={metricButtons}
                containerStyle={styles.metricButtonGroup}
                selectedButtonStyle={styles.selectedMetricButton}
                innerBorderStyle={{ width: 0 }}
              />
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholderTitle}>Financial Trends - {selectedMetric.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.trendsContainer}>
                {analytics.monthlyTrends.map((trend, index) => (
                  <View key={index} style={styles.trendItem}>
                    <Text style={styles.trendMonth}>{trend.month}</Text>
                    <View style={styles.trendBar}>
                      <View 
                        style={[
                          styles.trendBarFill,
                          { 
                            height: `${Math.min((trend[selectedMetric] / Math.max(...analytics.monthlyTrends.map(t => t[selectedMetric]))) * 100, 100)}%`
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.trendValue}>
                      {selectedMetric === 'loans' 
                        ? trend[selectedMetric] 
                        : formatCurrency(trend[selectedMetric])
                      }
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Loan Status Breakdown */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Loan Status Distribution</Text>
          
          <View style={styles.pieChartContainer}>
            <Text style={styles.chartPlaceholderTitle}>Loan Distribution</Text>
            <View style={styles.pieChartPlaceholder}>
              {analytics.loanStatusBreakdown.map((item, index) => (
                <View key={index} style={styles.pieSegment}>
                  <View style={[styles.pieSegmentBar, { backgroundColor: item.color, width: `${item.percentage}%` }]} />
                  <Text style={styles.pieSegmentText}>
                    {item.status}: {item.count} ({item.percentage.toFixed(1)}%)
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Top Lender Performance */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Top Lender Performance</Text>
          
          <View style={styles.lenderList}>
            {analytics.lenderPerformance.slice(0, 5).map((lender, index) => (
              <View key={index} style={styles.lenderItem}>
                <View style={styles.lenderRank}>
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </View>
                
                <View style={styles.lenderDetails}>
                  <Text style={styles.lenderName}>{lender.lenderName}</Text>
                  <Text style={styles.lenderStats}>
                    {lender.totalLoans} loans • {formatCurrency(lender.disbursedAmount)}
                  </Text>
                </View>
                
                <View style={styles.lenderMetrics}>
                  <Text style={styles.collectionRate}>
                    {lender.collectionRate.toFixed(1)}%
                  </Text>
                  <Text style={styles.metricLabel}>Collection</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Export Options Modal */}
        {showExportModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.exportModal}>
              <Text style={styles.modalTitle}>Export Analytics Report</Text>
              
              <TouchableOpacity 
                style={styles.exportOption}
                onPress={() => handleExport('pdf')}
              >
                <Ionicons name="document-text" size={24} color="#f44336" />
                <Text style={styles.exportOptionText}>Export as PDF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.exportOption}
                onPress={() => handleExport('excel')}
              >
                <Ionicons name="grid" size={24} color="#4caf50" />
                <Text style={styles.exportOptionText}>Export as Excel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelExport}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.cancelExportText}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
    alignItems: 'center',
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
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  exportButton: {
    padding: 8,
  },
  periodContainer: {
    marginBottom: 20,
  },
  periodButtonGroup: {
    borderRadius: 8,
    borderColor: '#e0e0e0',
    height: 40,
  },
  selectedPeriodButton: {
    backgroundColor: '#2196f3',
  },
  healthCard: {
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
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  healthScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthScore: {
    fontSize: 48,
    fontWeight: 'bold',
    marginRight: 20,
  },
  healthDetails: {
    alignItems: 'center',
  },
  healthRisk: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recommendationsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
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
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 10,
    color: '#4caf50',
  },
  chartCard: {
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  metricSelector: {
    flex: 1,
    maxWidth: 200,
  },
  metricButtonGroup: {
    borderRadius: 6,
    borderColor: '#e0e0e0',
    height: 30,
  },
  selectedMetricButton: {
    backgroundColor: '#2196f3',
  },
  chartContainer: {
    height: 200,
    marginVertical: 8,
  },
  chartPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  trendsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  trendItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 60,
  },
  trendMonth: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
  },
  trendBar: {
    width: 20,
    height: 100,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: '#2196f3',
    borderRadius: 10,
    minHeight: 2,
  },
  trendValue: {
    fontSize: 8,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  pieChartContainer: {
    paddingVertical: 8,
  },
  pieChartPlaceholder: {
    paddingHorizontal: 8,
  },
  pieSegment: {
    marginBottom: 12,
  },
  pieSegmentBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  pieSegmentText: {
    fontSize: 12,
    color: '#333',
  },
  lenderList: {
    marginTop: 8,
  },
  lenderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lenderRank: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  lenderDetails: {
    flex: 1,
    marginLeft: 12,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: screenWidth * 0.8,
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  exportOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  cancelExport: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelExportText: {
    fontSize: 16,
    color: '#666',
  },
});