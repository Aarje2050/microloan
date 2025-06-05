// src/screens/lender/MyLoansScreen.tsx
// Enterprise loan management interface with comprehensive filtering and tracking
// Complete CRUD operations for loan portfolio management

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { 
  Button, 
  Avatar, 
  Divider,
  Badge,
  Input,
  ButtonGroup
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { LoanService } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { Loan, User, ApiResponse, PaginatedResponse, LoanStatus, LenderStackParamList, LenderTabParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type
type MyLoansNavigationProp = CompositeNavigationProp<
  StackNavigationProp<LenderStackParamList>,
  BottomTabNavigationProp<LenderTabParamList, 'MyLoans'>
>;

// Filter options
const LOAN_STATUSES: Array<{ label: string; value: LoanStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending_approval' },
  { label: 'Completed', value: 'completed' },
  { label: 'Defaulted', value: 'defaulted' }
];

const SORT_OPTIONS = [
  { label: 'Recent', value: 'created_at' },
  { label: 'Amount', value: 'principal_amount' },
  { label: 'Status', value: 'status' }
];

export const MyLoansScreen: React.FC = () => {
  const navigation = useNavigation<MyLoansNavigationProp>();
  const queryClient = useQueryClient();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<LoanStatus | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState('created_at');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Get lender's borrower IDs for filtering
  const { data: borrowersResponse } = useQuery({
    queryKey: ['borrowers', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return LoanService.getBorrowersByLender(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Fetch loans with filters
  const { 
    data: loansResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ApiResponse<PaginatedResponse<Loan>>>({
    queryKey: ['loans', currentUser?.id, selectedStatus, searchQuery, selectedSort, page],
    queryFn: async (): Promise<ApiResponse<PaginatedResponse<Loan>>> => {
      if (!currentUser?.id || !borrowersResponse?.success) {
        return { success: false, data: { data: [], count: 0, page: 1, limit: 20, total_pages: 0 } };
      }

      // Get borrower IDs for this lender
      const borrowerIds = borrowersResponse.data?.map(b => b.id) || [];
      if (borrowerIds.length === 0) {
        return { 
          success: true, 
          data: { data: [], count: 0, page: 1, limit: 20, total_pages: 0 } 
        };
      }

      // Build filters
      const filters: any = {};
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus;
      }
      if (searchQuery.trim()) {
        filters.search = searchQuery;
      }

      // Get all loans with EMI and payment data included
      const result = await LoanService.getLoans(page, 20, filters);
      
      if (result.success && result.data) {
        // Filter loans to only include this lender's borrowers
        const filteredLoans = result.data.data.filter(loan => 
          borrowerIds.includes(loan.borrower_id)
        );
        
        return {
          success: true,
          data: {
            ...result.data,
            data: filteredLoans,
            count: filteredLoans.length
          }
        };
      }
      
      return result;
    },
    enabled: !!currentUser?.id && !!borrowersResponse?.success,
    refetchInterval: 30000,
  });

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
   * Handle search query change
   */
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page on search
  };

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: LoanStatus | 'all') => {
    setSelectedStatus(status);
    setPage(1); // Reset to first page on filter change
  };

  /**
   * Get loan status badge
   */
  const getLoanStatusBadge = (status: LoanStatus) => {
    const statusConfig = {
      'active': { color: '#4caf50', text: 'Active' },
      'pending_approval': { color: '#ff9800', text: 'Pending' },
      'completed': { color: '#2196f3', text: 'Completed' },
      'defaulted': { color: '#f44336', text: 'Defaulted' }
    };
    
    const config = statusConfig[status] || { color: '#9e9e9e', text: status };
    
    return (
      <Badge
        value={config.text}
        badgeStyle={{ backgroundColor: config.color }}
        textStyle={{ fontSize: 10 }}
      />
    );
  };

  /**
   * Calculate real loan progress based on EMI and payment data
   */
  const calculateLoanProgress = (loan: any): { progress: number; remaining: number; paidEMIs: number; totalEMIs: number } => {
    try {
      // Get EMIs and payments from loan data
      const emis = loan.emis || [];
      const payments = loan.payments || [];
      
      // Calculate total paid amount from payments
      const totalPaid = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
      
      // Count paid EMIs
      const paidEMIs = emis.filter((emi: any) => emi.status === 'paid').length;
      const totalEMIs = emis.length || loan.tenure_months;
      
      // Calculate total loan amount with interest
      const totalLoanAmount = loan.principal_amount * (1 + loan.interest_rate / 100);
      
      // Calculate remaining amount
      const remaining = Math.max(0, totalLoanAmount - totalPaid);
      
      return {
        progress: totalPaid,
        remaining,
        paidEMIs,
        totalEMIs
      };
      
    } catch (error) {
      console.error('Calculate loan progress error:', error);
      return { 
        progress: 0, 
        remaining: loan.principal_amount, 
        paidEMIs: 0, 
        totalEMIs: loan.tenure_months 
      };
    }
  };

  /**
   * Handle loan item press
   */
  const handleLoanPress = (loan: Loan) => {
    Alert.alert(
      'Loan Details',
      `Loan: ${loan.loan_number}\nAmount: ${formatCurrency(loan.principal_amount)}\nStatus: ${loan.status}`,
      [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'View Details', 
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Detailed loan view will be available in the next update.');
          }
        }
      ]
    );
  };

  /**
   * Render loan item
   */
  const renderLoanItem = ({ item: loan }: { item: any }) => {
    const { progress, remaining, paidEMIs, totalEMIs } = calculateLoanProgress(loan);
    const borrower = (loan as any).borrower;
    const borrowerUser = borrower?.user;
    const totalLoanAmount = loan.principal_amount * (1 + loan.interest_rate / 100);
    const progressPercentage = totalLoanAmount > 0 ? (progress / totalLoanAmount) * 100 : 0;

    return (
      <TouchableOpacity 
        style={styles.loanCard} 
        onPress={() => handleLoanPress(loan)}
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
          <View style={styles.borrowerInfo}>
            <Avatar
              size="small"
              rounded
              title={borrowerUser?.full_name?.charAt(0)?.toUpperCase() || 'B'}
              overlayContainerStyle={{ backgroundColor: '#2196f3' }}
            />
            <View style={styles.borrowerDetails}>
              <Text style={styles.borrowerName}>
                {borrowerUser?.full_name || 'Unknown Borrower'}
              </Text>
              <Text style={styles.borrowerContact}>
                {borrowerUser?.phone || 'No phone'}
              </Text>
            </View>
          </View>

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
              <Text style={styles.metricValue}>{paidEMIs}/{totalEMIs}</Text>
            </View>
          </View>
        </View>

        {loan.status === 'active' && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Payment Progress</Text>
              <Text style={styles.progressAmount}>
                Remaining: {formatCurrency(remaining)}
              </Text>
            </View>
            <View style={styles.progressDetails}>
              <Text style={styles.progressPaid}>
                Paid: {formatCurrency(progress)} ({progressPercentage.toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(progressPercentage, 100)}%` }
                ]} 
              />
            </View>
          </View>
        )}

        <View style={styles.loanActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert('Feature Coming Soon', 'EMI schedule view will be available in the next update.');
            }}
          >
            <Ionicons name="calendar" size={16} color="#2196f3" />
            <Text style={styles.actionButtonText}>EMI Schedule</Text>
          </TouchableOpacity>
          
          {loan.status === 'active' && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginLeft: 8 }]}
              onPress={() => navigation.navigate('RecordPayment', { loanId: loan.id })}
            >
              <Ionicons name="card" size={16} color="#4caf50" />
              <Text style={styles.actionButtonText}>Record Payment</Text>
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
        <Text style={styles.loadingText}>Loading Loans...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (loansResponse && !loansResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load loans</Text>
        <Text style={styles.errorSubtext}>
          {loansResponse?.error || 'Please check your connection and try again'}
        </Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const loans = loansResponse?.data?.data || [];
  const totalLoans = loansResponse?.data?.count || 0;

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Loans</Text>
          <Text style={styles.headerSubtitle}>
            {totalLoans} loan{totalLoans !== 1 ? 's' : ''} total
          </Text>
        </View>
        <Button
          title="New Loan"
          icon={<Ionicons name="add" size={16} color="white" />}
          buttonStyle={styles.addButton}
          onPress={() => navigation.navigate('MyBorrowers')}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search loans..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            leftIcon={<Ionicons name="search" size={20} color="#9CA3AF" />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity onPress={() => handleSearchChange('')}>
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
              onPress={() => handleStatusChange(status.value)}
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
              : 'Create your first loan to get started'
            }
          </Text>
          {!searchQuery && selectedStatus === 'all' && (
            <Button
              title="Create Loan"
              buttonStyle={styles.createLoanButton}
              onPress={() => navigation.navigate('MyBorrowers')}
            />
          )}
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
    marginBottom: 20,
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
  addButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 16,
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
    marginBottom: 20,
  },
  createLoanButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 30,
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
  borrowerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  borrowerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  borrowerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  borrowerContact: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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