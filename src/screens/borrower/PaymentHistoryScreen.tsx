// src/screens/borrower/PaymentHistoryScreen.tsx
// Enterprise payment history tracker with comprehensive filtering and export
// Complete payment lifecycle visibility for borrower financial management

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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User, Payment, BorrowerStackParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type - FIXED: Using proper navigation type for stack screen
type PaymentHistoryNavigationProp = StackNavigationProp<BorrowerStackParamList, 'PaymentHistory'>;

// Filter options
const DATE_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 3 Months', value: '3m' },
  { label: 'Last 6 Months', value: '6m' },
  { label: 'This Year', value: 'year' }
];

const PAYMENT_METHODS = [
  { label: 'All Methods', value: 'all' },
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'UPI', value: 'upi' },
  { label: 'Cheque', value: 'cheque' }
];

// FIXED: Using Omit to avoid property conflicts, similar to EMIWithLoan pattern
interface PaymentWithLoan extends Omit<Payment, 'loan'> {
  loan: {
    loan_number: string;
    principal_amount: number;
  };
}

export const PaymentHistoryScreen: React.FC = () => {
  const navigation = useNavigation<PaymentHistoryNavigationProp>();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch payment history
  const { 
    data: paymentsResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['paymentHistory', currentUser?.id, selectedDateFilter, selectedMethodFilter, searchQuery],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return getPaymentHistory(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
  });

  /**
   * Get payment history for borrower - FIXED: Handle missing borrower records gracefully
   */
  const getPaymentHistory = async (userId: string) => {
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

      // Get all payments for this borrower's loans
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          loan:loans!payments_loan_id_fkey(
            id,
            loan_number,
            principal_amount,
            borrower_id
          )
        `)
        .eq('loan.borrower_id', borrowerData.id)
        .order('payment_date', { ascending: false });

      if (paymentsError) {
        console.error('Get payments error:', paymentsError);
        return { success: false, data: [] };
      }

      let filteredPayments = payments || [];

      // Apply date filter
      if (selectedDateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (selectedDateFilter) {
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '3m':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '6m':
            startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0);
        }

        filteredPayments = filteredPayments.filter(payment => 
          new Date(payment.payment_date) >= startDate
        );
      }

      // Apply payment method filter
      if (selectedMethodFilter !== 'all') {
        filteredPayments = filteredPayments.filter(payment => 
          payment.payment_method === selectedMethodFilter
        );
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filteredPayments = filteredPayments.filter(payment =>
          payment.loan?.loan_number?.toLowerCase().includes(searchLower) ||
          payment.reference_number?.toLowerCase().includes(searchLower) ||
          payment.notes?.toLowerCase().includes(searchLower)
        );
      }

      return {
        success: true,
        data: filteredPayments as PaymentWithLoan[]
      };

    } catch (error) {
      console.error('Get payment history error:', error);
      return { success: false, data: [] };
    }
  };

  /**
   * Get payment method display info
   */
  const getPaymentMethodInfo = (method: string) => {
    const methodConfig = {
      'cash': { icon: 'cash', label: 'Cash', color: '#4caf50' },
      'bank_transfer': { icon: 'card', label: 'Bank Transfer', color: '#2196f3' },
      'upi': { icon: 'phone-portrait', label: 'UPI', color: '#ff9800' },
      'cheque': { icon: 'document-text', label: 'Cheque', color: '#9c27b0' }
    };
    
    return methodConfig[method as keyof typeof methodConfig] || 
           { icon: 'cash', label: method, color: '#666' };
  };

  /**
   * Calculate payment summary
   */
  const calculateSummary = (payments: PaymentWithLoan[]) => {
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const paymentCount = payments.length;
    const averagePayment = paymentCount > 0 ? totalAmount / paymentCount : 0;
    
    // Group by month for trend analysis
    const monthlyTotals: { [key: string]: number } = {};
    payments.forEach(payment => {
      const monthKey = new Date(payment.payment_date).toISOString().slice(0, 7);
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + payment.amount;
    });

    return {
      totalAmount,
      paymentCount,
      averagePayment,
      monthlyTotals
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
   * Handle export functionality (placeholder)
   */
  const handleExport = () => {
    Alert.alert(
      'Export Payment History',
      'Export functionality will be available in the next update. You will be able to export your payment history as PDF or Excel.',
      [{ text: 'OK' }]
    );
  };

  /**
   * Render payment item
   */
  const renderPaymentItem = ({ item: payment }: { item: PaymentWithLoan }) => {
    const methodInfo = getPaymentMethodInfo(payment.payment_method);
    
    return (
      <View style={styles.paymentCard}>
        <View style={styles.paymentHeader}>
          <View style={styles.paymentTitleSection}>
            <View style={styles.paymentMethodIcon}>
              <Ionicons name={methodInfo.icon as any} size={20} color={methodInfo.color} />
            </View>
            <View style={styles.paymentTitleDetails}>
              <Text style={styles.loanNumber}>{payment.loan?.loan_number}</Text>
              <Text style={styles.paymentMethod}>{methodInfo.label}</Text>
            </View>
          </View>
          <View style={styles.paymentAmountSection}>
            <Text style={styles.paymentAmount}>
              {formatCurrency(payment.amount)}
            </Text>
            <Badge 
              value="Paid" 
              badgeStyle={{ backgroundColor: '#4caf50' }}
              textStyle={{ fontSize: 10 }}
            />
          </View>
        </View>

        <View style={styles.paymentDetails}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date:</Text>
            <Text style={styles.paymentValue}>
              {formatDate(new Date(payment.payment_date), 'long')}
            </Text>
          </View>
          
          {payment.reference_number && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Reference:</Text>
              <Text style={styles.paymentValue}>{payment.reference_number}</Text>
            </View>
          )}
          
          {payment.notes && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Notes:</Text>
              <Text style={styles.paymentValue}>{payment.notes}</Text>
            </View>
          )}
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Loan Amount:</Text>
            <Text style={styles.paymentValue}>
              {formatCurrency(payment.loan?.principal_amount || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentFooter}>
          <Text style={styles.paymentId}>
            Payment ID: {payment.id.slice(-8)}
          </Text>
          <TouchableOpacity
            style={styles.receiptButton}
            onPress={() => Alert.alert('Receipt', 'Digital receipt feature coming soon!')}
          >
            <Ionicons name="receipt" size={14} color="#2196f3" />
            <Text style={styles.receiptButtonText}>Receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading state
  if (isLoading && !paymentsResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="receipt" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Payment History...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (paymentsResponse && !paymentsResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load payment history</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const payments = paymentsResponse?.data || [];
  const summary = calculateSummary(payments);

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
          <Text style={styles.headerTitle}>Payment History</Text>
          <Text style={styles.headerSubtitle}>
            {payments.length} payment{payments.length !== 1 ? 's' : ''} found
          </Text>
        </View>
        <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
          <Ionicons name="download" size={20} color="#2196f3" />
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      {payments.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <Divider style={styles.summaryDivider} />
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.totalAmount)}
              </Text>
              <Text style={styles.summaryLabel}>Total Paid</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.paymentCount}</Text>
              <Text style={styles.summaryLabel}>Payments Made</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.averagePayment)}
              </Text>
              <Text style={styles.summaryLabel}>Average Payment</Text>
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search payments..."
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

        {/* Date Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollContainer}
        >
          {DATE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                selectedDateFilter === filter.value && styles.filterButtonActive
              ]}
              onPress={() => setSelectedDateFilter(filter.value)}
            >
              <Text style={[
                styles.filterText,
                selectedDateFilter === filter.value && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Method Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollContainer}
        >
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.value}
              style={[
                styles.filterButton,
                selectedMethodFilter === method.value && styles.filterButtonActive
              ]}
              onPress={() => setSelectedMethodFilter(method.value)}
            >
              <Text style={[
                styles.filterText,
                selectedMethodFilter === method.value && styles.filterTextActive
              ]}>
                {method.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Payments List */}
      {payments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={64} color="#9e9e9e" />
          <Text style={styles.emptyStateText}>No payments found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery || selectedDateFilter !== 'all' || selectedMethodFilter !== 'all'
              ? 'Try adjusting your search or filters' 
              : 'Your payment history will appear here'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={renderPaymentItem}
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
  exportButton: {
    padding: 8,
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
  filterScrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  paymentCard: {
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
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentTitleDetails: {
    flex: 1,
  },
  loanNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentAmountSection: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 4,
  },
  paymentDetails: {
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  paymentValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentId: {
    fontSize: 10,
    color: '#999',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  receiptButtonText: {
    fontSize: 10,
    color: '#2196f3',
    marginLeft: 4,
    fontWeight: '500',
  },
});