// src/screens/borrower/BorrowerMyLoansScreen.tsx
// Enterprise borrower loan portfolio view with detailed loan tracking
// Complete loan lifecycle visibility from borrower perspective

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { 
  Avatar, 
  Divider,
  Badge,
  Input
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { LoanService } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User, Loan, BorrowerStackParamList, BorrowerTabParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type - FIXED: Using CompositeNavigationProp for screens used in both Tab and Stack
type BorrowerMyLoansNavigationProp = CompositeNavigationProp<
  StackNavigationProp<BorrowerStackParamList>,
  BottomTabNavigationProp<BorrowerTabParamList, 'MyLoans'>
>;

// Filter options
const LOAN_STATUSES = [
  { label: 'All Loans', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending_approval' }
];

export const BorrowerMyLoansScreen: React.FC = () => {
  const navigation = useNavigation<BorrowerMyLoansNavigationProp>();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch borrower's loans
  const { 
    data: loansResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['borrowerLoans', currentUser?.id, selectedStatus, searchQuery],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return getBorrowerLoans(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
  });

  /**
   * Get loans for current borrower - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerLoans = async (userId: string) => {
    try {
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          id,
          loans(*,
            emis(*),
            payments(*),
            borrower:borrowers(
              user:users!borrowers_user_id_fkey(*)
            )
          )
        `)
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower loans error:', borrowerError);
        return { success: false, data: [] };
      }

      // FIXED: Return empty array if no borrower record exists
      if (!borrowerData) {
        return { success: true, data: [] };
      }

      let loans = borrowerData.loans || [];

      // Apply status filter
      if (selectedStatus !== 'all') {
        loans = loans.filter((loan: any) => loan.status === selectedStatus);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        loans = loans.filter((loan: any) =>
          loan.loan_number.toLowerCase().includes(searchLower)
        );
      }

      return {
        success: true,
        data: loans
      };

    } catch (error) {
      console.error('Get borrower loans error:', error);
      return { success: false, data: [] };
    }
  };

  /**
   * Calculate loan progress
   */
  const calculateLoanProgress = (loan: any) => {
    const emis = loan.emis || [];
    const payments = loan.payments || [];
    
    const totalPaid = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const totalLoanAmount = loan.principal_amount * (1 + loan.interest_rate / 100);
    const remaining = Math.max(0, totalLoanAmount - totalPaid);
    const progressPercentage = totalLoanAmount > 0 ? (totalPaid / totalLoanAmount) * 100 : 0;
    
    const paidEMIs = emis.filter((emi: any) => emi.status === 'paid').length;
    const totalEMIs = emis.length || loan.tenure_months;

    return {
      totalPaid,
      remaining,
      progressPercentage,
      paidEMIs,
      totalEMIs,
      totalLoanAmount
    };
  };

  /**
   * Get next EMI due
   */
  const getNextEMI = (loan: any) => {
    const emis = loan.emis || [];
    const today = new Date();
    
    const nextEMI = emis
      .filter((emi: any) => emi.status === 'pending' && new Date(emi.due_date) >= today)
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    return nextEMI;
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

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Render loan item
   */
  const renderLoanItem = ({ item: loan }: { item: any }) => {
    const progress = calculateLoanProgress(loan);
    const nextEMI = getNextEMI(loan);
    const daysUntilNext = nextEMI ? Math.ceil((new Date(nextEMI.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;

    return (
      <TouchableOpacity 
        style={styles.loanCard} 
        onPress={() => navigation.navigate('LoanDetails', { loanId: loan.id })}
        activeOpacity={0.7}
      >
        <View style={styles.loanHeader}>
          <View style={styles.loanTitleSection}>
            <Text style={styles.loanNumber}>{loan.loan_number}</Text>
            {getLoanStatusBadge(loan.status)}
          </View>
          <Text style={styles.loanAmount}>
            {formatCurrency(loan.principal_amount)}
          </Text>
        </View>

        <View style={styles.loanDetails}>
          <View style={styles.loanMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Interest Rate</Text>
              <Text style={styles.metricValue}>{loan.interest_rate}%</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Tenure</Text>
              <Text style={styles.metricValue}>{loan.tenure_months}m</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>EMIs Paid</Text>
              <Text style={styles.metricValue}>{progress.paidEMIs}/{progress.totalEMIs}</Text>
            </View>
          </View>
        </View>

        {loan.status === 'active' && (
          <>
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Payment Progress</Text>
                <Text style={styles.progressAmount}>
                  Remaining: {formatCurrency(progress.remaining)}
                </Text>
              </View>
              <View style={styles.progressDetails}>
                <Text style={styles.progressPaid}>
                  Paid: {formatCurrency(progress.totalPaid)} ({progress.progressPercentage.toFixed(1)}%)
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(progress.progressPercentage, 100)}%` }
                  ]} 
                />
              </View>
            </View>

            {nextEMI && (
              <View style={styles.nextEMISection}>
                <View style={styles.nextEMIHeader}>
                  <Ionicons name="calendar" size={16} color="#ff9800" />
                  <Text style={styles.nextEMILabel}>Next EMI Due</Text>
                </View>
                <View style={styles.nextEMIDetails}>
                  <Text style={styles.nextEMIAmount}>
                    {formatCurrency(nextEMI.amount)}
                  </Text>
                  <Text style={styles.nextEMIDate}>
                    {formatDate(new Date(nextEMI.due_date), 'short')}
                  </Text>
                  {daysUntilNext !== null && (
                    <Badge
                      value={daysUntilNext <= 1 ? 'Due Today' : `${daysUntilNext} days left`}
                      badgeStyle={{ 
                        backgroundColor: daysUntilNext <= 1 ? '#f44336' : daysUntilNext <= 3 ? '#ff9800' : '#4caf50',
                        marginTop: 4
                      }}
                      textStyle={{ fontSize: 10 }}
                    />
                  )}
                </View>
              </View>
            )}
          </>
        )}

        <View style={styles.loanActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('EMISchedule', { loanId: loan.id })}
          >
            <Ionicons name="calendar" size={16} color="#2196f3" />
            <Text style={styles.actionButtonText}>EMI Schedule</Text>
          </TouchableOpacity>
          
          {loan.status === 'active' && nextEMI && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginLeft: 8 }]}
              onPress={() => navigation.navigate('MakePayment', { emiId: nextEMI.id, loanId: loan.id })}
            >
              <Ionicons name="card" size={16} color="#4caf50" />
              <Text style={styles.actionButtonText}>Pay EMI</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading state
  if (isLoading && !loansResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="document-text" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Your Loans...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (loansResponse && !loansResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load loans</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
      </View>
    );
  }

  const loans = loansResponse?.data || [];

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Loans</Text>
          <Text style={styles.headerSubtitle}>
            {loans.length} loan{loans.length !== 1 ? 's' : ''} in portfolio
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search loans..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Ionicons name="search" size={20} color="#9CA3AF" />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ) : undefined
            }
            containerStyle={styles.searchInputWrapper}
            inputContainerStyle={styles.searchInputContainer}
          />
        </View>

        {/* Status Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statusFilterContainer}
        >
          {LOAN_STATUSES.map((status) => (
            <TouchableOpacity
              key={status.value}
              style={[
                styles.statusFilterButton,
                selectedStatus === status.value && styles.statusFilterButtonActive
              ]}
              onPress={() => setSelectedStatus(status.value)}
            >
              <Text style={[
                styles.statusFilterText,
                selectedStatus === status.value && styles.statusFilterTextActive
              ]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loans List */}
      {loans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color="#9e9e9e" />
          <Text style={styles.emptyStateText}>No loans found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery || selectedStatus !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Your loan applications will appear here'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => item.id}
          renderItem={renderLoanItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputWrapper: {
    paddingHorizontal: 0,
  },
  searchInputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
  },
  statusFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statusFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statusFilterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  statusFilterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusFilterTextActive: {
    color: 'white',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  loanCard: {
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
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loanTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loanNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  loanDetails: {
    marginBottom: 12,
  },
  loanMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  progressAmount: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '500',
  },
  progressDetails: {
    marginBottom: 8,
  },
  progressPaid: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  nextEMISection: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffecb3',
  },
  nextEMIHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nextEMILabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f57c00',
    marginLeft: 4,
  },
  nextEMIDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextEMIAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
  },
  nextEMIDate: {
    fontSize: 12,
    color: '#f57c00',
  },
  loanActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
});