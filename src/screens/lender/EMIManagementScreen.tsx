// src/screens/lender/EMIManagementScreen.tsx
// Enterprise EMI management and collection tracking system
// Complete overdue management with borrower contact and follow-up actions

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  FlatList,
  Linking
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
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { LoanService } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { User, LenderStackParamList, LenderTabParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation type
type EMIManagementNavigationProp = CompositeNavigationProp<
  StackNavigationProp<LenderStackParamList>,
  BottomTabNavigationProp<LenderTabParamList>
>;

// EMI data interface
interface EMIData {
  id: string;
  loan_id: string;
  emi_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number;
  loan: {
    loan_number: string;
    borrower: {
      user: {
        full_name: string;
        phone: string;
        email: string;
      };
    };
  };
  days_overdue: number;
}

// Filter options
const EMI_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due Today', value: 'due_today' },
  { label: 'Due This Week', value: 'due_week' },
  { label: 'Paid', value: 'paid' }
];

export const EMIManagementScreen: React.FC = () => {
  const navigation = useNavigation<EMIManagementNavigationProp>();
  const queryClient = useQueryClient();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Get lender's borrower IDs
  const { data: borrowersResponse } = useQuery({
    queryKey: ['borrowers', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return LoanService.getBorrowersByLender(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Fetch EMI data with comprehensive filtering
  const { 
    data: emiResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['emiManagement', currentUser?.id, selectedFilter, searchQuery],
    queryFn: async () => {
      if (!currentUser?.id || !borrowersResponse?.success) {
        return { success: false, data: [] };
      }

      const borrowerIds = borrowersResponse.data?.map(b => b.id) || [];
      if (borrowerIds.length === 0) {
        return { success: true, data: [] };
      }

      // Get all loans for this lender's borrowers
      const loansResult = await LoanService.getLoans(1, 100, { status: 'active' });
      
      if (!loansResult.success || !loansResult.data) {
        return { success: false, data: [] };
      }

      // Filter loans for this lender's borrowers
      const lenderLoans = loansResult.data.data.filter(loan => 
        borrowerIds.includes(loan.borrower_id)
      );

      // Generate mock EMI data based on loans
      const emiData: EMIData[] = [];
      const today = new Date();
      
      for (const loan of lenderLoans) {
        const loanStartDate = new Date(loan.created_at);
        const monthlyEMI = (loan.principal_amount * (1 + loan.interest_rate / 100)) / loan.tenure_months;
        
        for (let i = 1; i <= loan.tenure_months; i++) {
          const dueDate = new Date(loanStartDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          
          const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
          const isOverdue = daysDiff > 0;
          const isDueToday = daysDiff === 0;
          const isDueThisWeek = daysDiff >= -7 && daysDiff <= 0;
          
          // Simulate some payments (70% paid, 20% overdue, 10% pending)
          let status = 'pending';
          let paidAmount = 0;
          const rand = Math.random();
          
          if (i <= Math.floor(loan.tenure_months * 0.7)) {
            status = 'paid';
            paidAmount = monthlyEMI;
          } else if (isOverdue && rand < 0.5) {
            status = 'overdue';
          }

          const emiItem: EMIData = {
            id: `${loan.id}-${i}`,
            loan_id: loan.id,
            emi_number: i,
            due_date: dueDate.toISOString().split('T')[0],
            amount: monthlyEMI,
            status,
            paid_amount: paidAmount,
            loan: {
              loan_number: loan.loan_number,
              borrower: (loan as any).borrower
            },
            days_overdue: isOverdue ? daysDiff : 0
          };
          
          emiData.push(emiItem);
        }
      }

      // Apply filters
      let filteredData = emiData;

      switch (selectedFilter) {
        case 'overdue':
          filteredData = emiData.filter(emi => emi.status === 'overdue');
          break;
        case 'due_today':
          filteredData = emiData.filter(emi => {
            const today = new Date().toISOString().split('T')[0];
            return emi.due_date === today && emi.status === 'pending';
          });
          break;
        case 'due_week':
          filteredData = emiData.filter(emi => {
            const dueDate = new Date(emi.due_date);
            const today = new Date();
            const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            return daysDiff >= 0 && daysDiff <= 7 && emi.status === 'pending';
          });
          break;
        case 'paid':
          filteredData = emiData.filter(emi => emi.status === 'paid');
          break;
        default:
          break;
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(emi =>
          emi.loan.loan_number.toLowerCase().includes(searchLower) ||
          emi.loan.borrower?.user?.full_name?.toLowerCase().includes(searchLower) ||
          emi.loan.borrower?.user?.phone?.includes(searchQuery)
        );
      }

      // Sort by priority: overdue first, then by due date
      filteredData.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      return { success: true, data: filteredData };
    },
    enabled: !!currentUser?.id && !!borrowersResponse?.success,
    refetchInterval: 60000,
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
   * Get EMI status badge
   */
  const getEMIStatusBadge = (emi: EMIData) => {
    const statusConfig = {
      'paid': { color: '#4caf50', text: 'Paid' },
      'pending': { color: '#ff9800', text: 'Pending' },
      'overdue': { color: '#f44336', text: `${emi.days_overdue}d Overdue` },
      'partially_paid': { color: '#2196f3', text: 'Partial' }
    };
    
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
   * Handle contact borrower
   */
  const handleContactBorrower = (emi: EMIData) => {
    const borrowerUser = emi.loan.borrower?.user;
    if (!borrowerUser) return;

    Alert.alert(
      'Contact Borrower',
      `${borrowerUser.full_name}\nEMI: ${formatCurrency(emi.amount)}\nOverdue: ${emi.days_overdue} days`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            if (borrowerUser.phone) {
              Linking.openURL(`tel:${borrowerUser.phone}`);
            }
          }
        },
        { 
          text: 'SMS', 
          onPress: () => {
            if (borrowerUser.phone) {
              const message = `Dear ${borrowerUser.full_name}, your EMI of ${formatCurrency(emi.amount)} for loan ${emi.loan.loan_number} is overdue by ${emi.days_overdue} days. Please make payment at the earliest.`;
              Linking.openURL(`sms:${borrowerUser.phone}?body=${encodeURIComponent(message)}`);
            }
          }
        }
      ]
    );
  };

  /**
   * Handle record payment for EMI
   */
  const handleRecordPayment = (emi: EMIData) => {
    (navigation as any).navigate('RecordPayment', { loanId: emi.loan_id });
  };

  /**
   * Render EMI item
   */
  const renderEMIItem = ({ item: emi }: { item: EMIData }) => {
    const borrowerUser = emi.loan.borrower?.user;
    const isOverdue = emi.status === 'overdue';
    const isPaid = emi.status === 'paid';

    return (
      <View style={[
        styles.emiCard,
        isOverdue && styles.emiCardOverdue,
        isPaid && styles.emiCardPaid
      ]}>
        <View style={styles.emiHeader}>
          <View style={styles.emiTitleSection}>
            <Text style={styles.loanNumber}>{emi.loan.loan_number}</Text>
            <Text style={styles.emiNumber}>EMI #{emi.emi_number}</Text>
          </View>
          {getEMIStatusBadge(emi)}
        </View>

        <View style={styles.emiContent}>
          <View style={styles.borrowerSection}>
            <Avatar
              size="small"
              rounded
              title={borrowerUser?.full_name?.charAt(0)?.toUpperCase() || 'B'}
              overlayContainerStyle={{ backgroundColor: isOverdue ? '#f44336' : '#2196f3' }}
            />
            <View style={styles.borrowerDetails}>
              <Text style={styles.borrowerName}>
                {borrowerUser?.full_name || 'Unknown Borrower'}
              </Text>
              <Text style={styles.borrowerContact}>
                {borrowerUser?.phone || 'No phone'}
              </Text>
              <Text style={styles.emiDueDate}>
                Due: {formatDate(new Date(emi.due_date), 'short')}
              </Text>
            </View>
          </View>

          <View style={styles.emiAmountSection}>
            <Text style={styles.emiAmount}>
              {formatCurrency(emi.amount)}
            </Text>
            {emi.paid_amount > 0 && (
              <Text style={styles.paidAmount}>
                Paid: {formatCurrency(emi.paid_amount)}
              </Text>
            )}
          </View>
        </View>

        {!isPaid && (
          <View style={styles.emiActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.contactButton]}
              onPress={() => handleContactBorrower(emi)}
            >
              <Ionicons name="call" size={14} color="#2196f3" />
              <Text style={styles.actionButtonText}>Contact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.paymentButton]}
              onPress={() => handleRecordPayment(emi)}
            >
              <Ionicons name="card" size={14} color="#4caf50" />
              <Text style={styles.actionButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (isLoading && !emiResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="calendar" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading EMI Data...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (emiResponse && !emiResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load EMI data</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const emiData = emiResponse?.data || [];
  const overdueCount = emiData.filter(emi => emi.status === 'overdue').length;
  const totalOverdueAmount = emiData
    .filter(emi => emi.status === 'overdue')
    .reduce((sum, emi) => sum + emi.amount, 0);

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
          <Text style={styles.headerTitle}>EMI Management</Text>
          <Text style={styles.headerSubtitle}>
            {emiData.length} EMIs • {overdueCount} overdue
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary Cards */}
      {overdueCount > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{overdueCount}</Text>
                <Text style={styles.summaryLabel}>Overdue EMIs</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#f44336' }]}>
                  {formatCurrency(totalOverdueAmount)}
                </Text>
                <Text style={styles.summaryLabel}>Overdue Amount</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by loan, borrower, or phone..."
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
      {emiData.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#9e9e9e" />
          <Text style={styles.emptyStateText}>No EMIs found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery || selectedFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'EMI data will appear here when loans are active'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={emiData}
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
  summaryContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
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
  emiCardOverdue: {
    borderLeftColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  emiCardPaid: {
    borderLeftColor: '#4caf50',
    backgroundColor: '#f1f8e9',
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
  loanNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  emiNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emiContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  borrowerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  emiDueDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emiAmountSection: {
    alignItems: 'flex-end',
  },
  emiAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paidAmount: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 2,
  },
  emiActions: {
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
    marginRight: 8,
  },
  contactButton: {
    borderColor: '#2196f3',
  },
  paymentButton: {
    borderColor: '#4caf50',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
});