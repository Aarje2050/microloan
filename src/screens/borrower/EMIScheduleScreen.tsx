// src/screens/borrower/EMIScheduleScreen.tsx
// Enterprise EMI schedule viewer with payment tracking and calendar integration
// Complete installment management for borrower financial planning

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  TouchableOpacity,
  FlatList,
  Alert
} from 'react-native';
import { 
  Button, 
  Divider,
  Badge,
  Input
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User, EMI, Loan, BorrowerStackParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation types
type EMIScheduleRouteProp = RouteProp<BorrowerStackParamList, 'EMISchedule'>;
type EMIScheduleNavigationProp = StackNavigationProp<BorrowerStackParamList, 'EMISchedule'>;

// Filter options
const EMI_FILTERS = [
  { label: 'All EMIs', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Upcoming', value: 'upcoming' }
];

// FIXED: Using intersection type instead of interface extension to avoid property conflicts
interface EMIWithLoan extends Omit<EMI, 'loan'> {
  loan: {
    loan_number: string;
    principal_amount: number;
    interest_rate: number;
    tenure_months: number;
  };
  days_until_due?: number;
  days_overdue?: number;
}

export const EMIScheduleScreen: React.FC = () => {
  const navigation = useNavigation<EMIScheduleNavigationProp>();
  const route = useRoute<EMIScheduleRouteProp>();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(route.params?.loanId || null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch EMI schedule
  const { 
    data: emisResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['emiSchedule', currentUser?.id, selectedLoan, selectedFilter],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return getEMISchedule(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
  });

  // Fetch borrower loans for filtering
  const { data: loansResponse } = useQuery({
    queryKey: ['borrowerLoansForEMI', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return getBorrowerLoans(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  /**
   * Get EMI schedule for borrower - FIXED: Handle missing borrower records gracefully
   */
  const getEMISchedule = async (userId: string) => {
    try {
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower error:', borrowerError);
        return { success: false, data: [] };
      }

      // FIXED: Return empty array if no borrower record exists
      if (!borrowerData) {
        return { success: true, data: [] };
      }

      // Build query for EMIs
      let query = supabase
        .from('emis')
        .select(`
          *,
          loan:loans!emis_loan_id_fkey(
            id,
            loan_number,
            principal_amount,
            interest_rate,
            tenure_months,
            borrower_id
          )
        `)
        .eq('loan.borrower_id', borrowerData.id)
        .order('due_date', { ascending: true });

      // Apply loan filter if specified
      if (selectedLoan) {
        query = query.eq('loan_id', selectedLoan);
      }

      const { data: emis, error: emisError } = await query;

      if (emisError) {
        console.error('Get EMIs error:', emisError);
        return { success: false, data: [] };
      }

      let filteredEMIs = emis || [];
      const today = new Date();

      // Calculate days until due / overdue for each EMI
      filteredEMIs = filteredEMIs.map(emi => {
        const dueDate = new Date(emi.due_date);
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        
        return {
          ...emi,
          days_until_due: daysDiff > 0 ? daysDiff : 0,
          days_overdue: daysDiff < 0 ? Math.abs(daysDiff) : 0
        };
      });

      // Apply status filter
      if (selectedFilter !== 'all') {
        switch (selectedFilter) {
          case 'pending':
            filteredEMIs = filteredEMIs.filter(emi => emi.status === 'pending');
            break;
          case 'paid':
            filteredEMIs = filteredEMIs.filter(emi => emi.status === 'paid');
            break;
          case 'overdue':
            filteredEMIs = filteredEMIs.filter(emi => 
              emi.status === 'overdue' || (emi.status === 'pending' && (emi.days_overdue || 0) > 0)
            );
            break;
          case 'upcoming':
            filteredEMIs = filteredEMIs.filter(emi => 
              emi.status === 'pending' && (emi.days_until_due || 0) <= 7 && (emi.days_until_due || 0) > 0
            );
            break;
        }
      }

      return {
        success: true,
        data: filteredEMIs as EMIWithLoan[]
      };

    } catch (error) {
      console.error('Get EMI schedule error:', error);
      return { success: false, data: [] };
    }
  };

  /**
   * Get borrower loans for dropdown - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerLoans = async (userId: string) => {
    try {
      // FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          id,
          loans(id, loan_number, status, principal_amount)
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

      return {
        success: true,
        data: borrowerData.loans || []
      };

    } catch (error) {
      console.error('Get borrower loans error:', error);
      return { success: false, data: [] };
    }
  };

  /**
   * Get EMI status badge
   */
  const getEMIStatusBadge = (emi: EMIWithLoan) => {
    let statusConfig = {
      'paid': { color: '#4caf50', text: 'Paid' },
      'pending': { color: '#ff9800', text: 'Pending' },
      'overdue': { color: '#f44336', text: 'Overdue' },
      'partially_paid': { color: '#2196f3', text: 'Partial' }
    };

    // Override for overdue EMIs
    if (emi.status === 'pending' && (emi.days_overdue || 0) > 0) {
      statusConfig.pending = { color: '#f44336', text: `${emi.days_overdue}d Overdue` };
    } else if (emi.status === 'pending' && (emi.days_until_due || 0) <= 3) {
      statusConfig.pending = { color: '#ff9800', text: `Due in ${emi.days_until_due}d` };
    }
    
    const config = statusConfig[emi.status as keyof typeof statusConfig] || 
                   { color: '#9e9e9e', text: emi.status };
    
    return (
      <Badge
        value={config.text}
        badgeStyle={{ backgroundColor: config.color }}
        textStyle={{ fontSize: 10 }}
      />
    );
  };

  /**
   * Calculate schedule summary
   */
  const calculateSummary = (emis: EMIWithLoan[]) => {
    const totalEMIs = emis.length;
    const paidEMIs = emis.filter(emi => emi.status === 'paid').length;
    const pendingEMIs = emis.filter(emi => emi.status === 'pending').length;
    const overdueEMIs = emis.filter(emi => 
      emi.status === 'overdue' || (emi.status === 'pending' && (emi.days_overdue || 0) > 0)
    ).length;
    
    const totalAmount = emis.reduce((sum, emi) => sum + emi.amount, 0);
    const paidAmount = emis
      .filter(emi => emi.status === 'paid')
      .reduce((sum, emi) => sum + emi.amount, 0);
    const pendingAmount = emis
      .filter(emi => emi.status === 'pending')
      .reduce((sum, emi) => sum + emi.amount, 0);

    return {
      totalEMIs,
      paidEMIs,
      pendingEMIs,
      overdueEMIs,
      totalAmount,
      paidAmount,
      pendingAmount,
      completionPercentage: totalEMIs > 0 ? (paidEMIs / totalEMIs) * 100 : 0
    };
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
   * Handle EMI payment
   */
  const handlePayEMI = (emi: EMIWithLoan) => {
    navigation.navigate('MakePayment', { emiId: emi.id, loanId: emi.loan_id });
  };

  /**
   * Render EMI item
   */
  const renderEMIItem = ({ item: emi }: { item: EMIWithLoan }) => {
    const isPaid = emi.status === 'paid';
    const isOverdue = emi.status === 'overdue' || (emi.status === 'pending' && (emi.days_overdue || 0) > 0);
    const isDueSoon = emi.status === 'pending' && (emi.days_until_due || 0) <= 3;

    return (
      <View style={[
        styles.emiCard,
        isPaid && styles.emiCardPaid,
        isOverdue && styles.emiCardOverdue,
        isDueSoon && styles.emiCardDueSoon
      ]}>
        <View style={styles.emiHeader}>
          <View style={styles.emiTitleSection}>
            <Text style={styles.emiNumber}>EMI #{emi.emi_number}</Text>
            <Text style={styles.loanNumber}>{emi.loan?.loan_number}</Text>
          </View>
          {getEMIStatusBadge(emi)}
        </View>

        <View style={styles.emiContent}>
          <View style={styles.emiDetails}>
            <View style={styles.emiRow}>
              <Text style={styles.emiLabel}>Due Date:</Text>
              <Text style={[
                styles.emiValue,
                isOverdue && { color: '#f44336' },
                isDueSoon && { color: '#ff9800' }
              ]}>
                {formatDate(new Date(emi.due_date), 'short')}
              </Text>
            </View>
            
            <View style={styles.emiRow}>
              <Text style={styles.emiLabel}>Amount:</Text>
              <Text style={styles.emiAmountText}>
                {formatCurrency(emi.amount)}
              </Text>
            </View>
            
            {emi.paid_amount && emi.paid_amount > 0 && (
              <View style={styles.emiRow}>
                <Text style={styles.emiLabel}>Paid:</Text>
                <Text style={[styles.emiValue, { color: '#4caf50' }]}>
                  {formatCurrency(emi.paid_amount)}
                </Text>
              </View>
            )}
            
            {emi.paid_date && (
              <View style={styles.emiRow}>
                <Text style={styles.emiLabel}>Paid Date:</Text>
                <Text style={[styles.emiValue, { color: '#4caf50' }]}>
                  {formatDate(new Date(emi.paid_date), 'short')}
                </Text>
              </View>
            )}
          </View>

          {!isPaid && (
            <View style={styles.emiActions}>
              <TouchableOpacity
                style={[
                  styles.payButton,
                  isOverdue && styles.payButtonUrgent,
                  isDueSoon && styles.payButtonSoon
                ]}
                onPress={() => handlePayEMI(emi)}
              >
                <Ionicons 
                  name="card" 
                  size={16} 
                  color="white" 
                />
                <Text style={styles.payButtonText}>
                  {isOverdue ? 'Pay Now' : 'Pay EMI'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {(isOverdue || isDueSoon) && (
          <View style={[
            styles.urgencyIndicator,
            isOverdue ? styles.urgencyOverdue : styles.urgencyDueSoon
          ]}>
            <Ionicons 
              name={isOverdue ? "alert-circle" : "time"} 
              size={14} 
              color="white" 
            />
            <Text style={styles.urgencyText}>
              {isOverdue 
                ? `${emi.days_overdue} days overdue` 
                : `Due in ${emi.days_until_due} days`
              }
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (isLoading && !emisResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="calendar" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading EMI Schedule...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (emisResponse && !emisResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load EMI schedule</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const emis = emisResponse?.data || [];
  const loans = loansResponse?.data || [];
  const summary = calculateSummary(emis);

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>EMI Schedule</Text>
          <Text style={styles.headerSubtitle}>
            {emis.length} installment{emis.length !== 1 ? 's' : ''} found
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary Card */}
      {emis.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Schedule Overview</Text>
          <Divider style={styles.summaryDivider} />
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.paidEMIs}</Text>
              <Text style={styles.summaryLabel}>Paid EMIs</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.pendingEMIs}</Text>
              <Text style={styles.summaryLabel}>Pending EMIs</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#f44336' }]}>
                {summary.overdueEMIs}
              </Text>
              <Text style={styles.summaryLabel}>Overdue EMIs</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Completion Progress</Text>
              <Text style={styles.progressPercentage}>
                {summary.completionPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(summary.completionPercentage, 100)}%` }
                ]} 
              />
            </View>
          </View>
        </View>
      )}

      {/* Loan Filter */}
      {loans.length > 1 && (
        <View style={styles.loanFilterContainer}>
          <Text style={styles.filterLabel}>Filter by Loan:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.loanFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.loanFilterButton,
                !selectedLoan && styles.loanFilterButtonActive
              ]}
              onPress={() => setSelectedLoan(null)}
            >
              <Text style={[
                styles.loanFilterText,
                !selectedLoan && styles.loanFilterTextActive
              ]}>
                All Loans
              </Text>
            </TouchableOpacity>
            {loans.map((loan: any) => (
              <TouchableOpacity
                key={loan.id}
                style={[
                  styles.loanFilterButton,
                  selectedLoan === loan.id && styles.loanFilterButtonActive
                ]}
                onPress={() => setSelectedLoan(loan.id)}
              >
                <Text style={[
                  styles.loanFilterText,
                  selectedLoan === loan.id && styles.loanFilterTextActive
                ]}>
                  {loan.loan_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Status Filter */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollContainer}
        >
          {EMI_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                selectedFilter === filter.value && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(filter.value)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === filter.value && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* EMI List */}
      {emis.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#9e9e9e" />
          <Text style={styles.emptyStateText}>No EMIs found</Text>
          <Text style={styles.emptyStateSubtext}>
            {selectedFilter !== 'all' || selectedLoan
              ? 'Try adjusting your filters' 
              : 'EMI schedule will appear here when loans are active'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={emis}
          keyExtractor={(item) => item.id}
          renderItem={renderEMIItem}
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryDivider: {
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressSection: {
    marginTop: 8,
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
  progressPercentage: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  loanFilterContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  loanFilterScroll: {
    flexDirection: 'row',
  },
  loanFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loanFilterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  loanFilterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loanFilterTextActive: {
    color: 'white',
  },
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
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
  emiCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  emiCardPaid: {
    borderLeftColor: '#4caf50',
    backgroundColor: '#f1f8e9',
  },
  emiCardOverdue: {
    borderLeftColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  emiCardDueSoon: {
    borderLeftColor: '#ff9800',
    backgroundColor: '#fff3e0',
  },
  emiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emiTitleSection: {
    flex: 1,
  },
  emiNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loanNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emiContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emiDetails: {
    flex: 1,
  },
  emiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emiLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  emiValue: {
    fontSize: 12,
    color: '#333',
  },
  emiAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  emiActions: {
    marginLeft: 16,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  payButtonUrgent: {
    backgroundColor: '#f44336',
  },
  payButtonSoon: {
    backgroundColor: '#ff9800',
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  urgencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  urgencyOverdue: {
    backgroundColor: '#f44336',
  },
  urgencyDueSoon: {
    backgroundColor: '#ff9800',
  },
  urgencyText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
});