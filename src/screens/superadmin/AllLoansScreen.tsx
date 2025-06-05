// src/screens/superadmin/AllLoansScreen.tsx
// Enterprise Super Admin All Loans Management - System-wide loan oversight
// Provides comprehensive loan monitoring across all lenders with advanced filtering

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal
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

import { LoanService } from '../../services/loans/loanService';
import { UserService } from '../../services/users/userService';
import { Loan, LoanStatus, User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface LoanFilters {
  status?: LoanStatus;
  lender_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

interface LenderOption {
  id: string;
  name: string;
}

export const AllLoansScreen: React.FC = () => {
  const queryClient = useQueryClient();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<LoanFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLender, setSelectedLender] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Filter options
  const statusOptions = ['All Status', 'Active', 'Completed', 'Defaulted', 'Pending Approval'];
  const viewModeButtons = ['List View', 'Grid View'];

  // Fetch all lenders for filter dropdown
  const { data: lendersResponse } = useQuery({
    queryKey: ['allLenders'],
    queryFn: () => UserService.getUsers(1, 100, { role: 'lender' }),
    staleTime: 300000, // 5 minutes
  });

  // Fetch loans with advanced filtering
  const { 
    data: loansResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['allLoans', currentPage, filters, searchQuery],
    queryFn: async () => {
      const queryFilters: any = { ...filters };
      
      // Add search query if present
      if (searchQuery.trim()) {
        queryFilters.search = searchQuery.trim();
      }
      
      return LoanService.getLoans(currentPage, 20, queryFilters);
    },
    refetchInterval: 30000, // Real-time updates every 30 seconds
  });

  // Get lender options for filter
  const lenderOptions: LenderOption[] = [
    { id: '', name: 'All Lenders' },
    ...(lendersResponse?.data?.data?.map(lender => ({
      id: lender.id,
      name: lender.full_name
    })) || [])
  ];

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['allLoans'] });
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Apply filters to loan query
   */
  const applyFilters = () => {
    const newFilters: LoanFilters = {};
    
    if (selectedStatus && selectedStatus !== 'All Status') {
      newFilters.status = selectedStatus.toLowerCase().replace(' ', '_') as LoanStatus;
    }
    
    if (selectedLender) {
      newFilters.lender_id = selectedLender;
    }
    
    setFilters(newFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  /**
   * Reset all filters
   */
  const resetFilters = () => {
    setFilters({});
    setSelectedStatus('');
    setSelectedLender('');
    setSearchQuery('');
    setCurrentPage(1);
    setShowFilters(false);
  };

  /**
   * Get status badge for loan
   */
  const getLoanStatusBadge = (status: LoanStatus) => {
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
   * Calculate loan progress
   */
  const calculateLoanProgress = (loan: Loan): { progress: number; status: string } => {
    const emis = (loan as any).emis || [];
    const payments = (loan as any).payments || [];
    
    if (emis.length === 0) {
      return { progress: 0, status: 'No EMIs' };
    }
    
    const totalAmount = loan.principal_amount;
    const totalPaid = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const progress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
    
    const paidEMIs = emis.filter((emi: any) => emi.status === 'paid').length;
    const overdueEMIs = emis.filter((emi: any) => emi.status === 'overdue').length;
    
    let status = 'On Track';
    if (overdueEMIs > 0) status = 'Overdue';
    if (progress >= 100) status = 'Completed';
    
    return { 
      progress: Math.min(progress, 100), 
      status: `${paidEMIs}/${emis.length} EMIs • ${status}` 
    };
  };

  /**
   * Handle loan detail view
   */
  const handleLoanDetails = (loan: Loan) => {
    Alert.alert(
      'Loan Details',
      `Loan: ${loan.loan_number}\nBorrower: ${(loan as any).borrower?.user?.full_name || 'Unknown'}\nAmount: ${formatCurrency(loan.principal_amount)}\nStatus: ${loan.status}`,
      [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'View Full Details', 
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Detailed loan view will be available in the next update.');
          }
        }
      ]
    );
  };

  /**
   * Load more loans (pagination)
   */
  const loadMoreLoans = () => {
    if (loansResponse?.data && currentPage < loansResponse.data.total_pages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  /**
   * Render loan card for list view
   */
  const renderLoanCard = (loan: Loan) => {
    const { progress, status } = calculateLoanProgress(loan);
    const borrower = (loan as any).borrower;
    const lenderName = borrower?.lender?.full_name || 'Unknown Lender';
    
    return (
      <TouchableOpacity 
        key={loan.id} 
        style={styles.loanCard}
        onPress={() => handleLoanDetails(loan)}
      >
        <View style={styles.loanHeader}>
          <View style={styles.loanInfo}>
            <Text style={styles.loanNumber}>{loan.loan_number}</Text>
            <Text style={styles.borrowerName}>
              {borrower?.user?.full_name || 'Unknown Borrower'}
            </Text>
            <Text style={styles.lenderName}>Lender: {lenderName}</Text>
          </View>
          <View style={styles.loanMetrics}>
            <Text style={styles.loanAmount}>
              {formatCurrency(loan.principal_amount)}
            </Text>
            {getLoanStatusBadge(loan.status)}
          </View>
        </View>
        
        <View style={styles.loanProgress}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>{status}</Text>
            <Text style={styles.progressPercentage}>{progress.toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${progress}%`,
                  backgroundColor: progress >= 100 ? '#4caf50' : progress >= 50 ? '#ff9800' : '#2196f3'
                }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.loanFooter}>
          <Text style={styles.loanDate}>
            Created: {formatDate(new Date(loan.created_at), 'short')}
          </Text>
          <Text style={styles.loanTenure}>
            {loan.tenure_months} months • {loan.interest_rate}% APR
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render loan grid item
   */
  const renderLoanGridItem = (loan: Loan) => {
    const { progress } = calculateLoanProgress(loan);
    const borrower = (loan as any).borrower;
    
    return (
      <TouchableOpacity 
        key={loan.id} 
        style={styles.gridItem}
        onPress={() => handleLoanDetails(loan)}
      >
        <View style={styles.gridHeader}>
          <Text style={styles.gridLoanNumber} numberOfLines={1}>
            {loan.loan_number}
          </Text>
          {getLoanStatusBadge(loan.status)}
        </View>
        
        <Text style={styles.gridBorrowerName} numberOfLines={1}>
          {borrower?.user?.full_name || 'Unknown'}
        </Text>
        
        <Text style={styles.gridAmount}>
          {formatCurrency(loan.principal_amount)}
        </Text>
        
        <View style={styles.gridProgressBar}>
          <View 
            style={[
              styles.gridProgressFill, 
              { 
                width: `${progress}%`,
                backgroundColor: progress >= 100 ? '#4caf50' : '#2196f3'
              }
            ]} 
          />
        </View>
        
        <Text style={styles.gridProgress}>{progress.toFixed(0)}%</Text>
      </TouchableOpacity>
    );
  };

  // Show loading state
  if (isLoading && !loansResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="document-text" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading All Loans...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !loansResponse?.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load loans</Text>
        <Text style={styles.errorSubtext}>
          {loansResponse?.error || 'Please check your connection and try again'}
        </Text>
        <Button
          title="Retry"
          onPress={() => refetch()}
          buttonStyle={styles.retryButton}
        />
      </View>
    );
  }

  const loans = loansResponse.data?.data || [];
  const totalLoans = loansResponse.data?.count || 0;
  const activeFiltersCount = Object.keys(filters).length + (searchQuery ? 1 : 0);

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>All Loans</Text>
          <Text style={styles.headerSubtitle}>
            {totalLoans} loan{totalLoans !== 1 ? 's' : ''} total
            {activeFiltersCount > 0 && (
              <Text style={styles.filterCount}> • {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} applied</Text>
            )}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color="#2196f3" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search and View Toggle */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by loan number or borrower..."
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
        
        <View style={styles.viewToggle}>
          <ButtonGroup
            onPress={(index) => setViewMode(index === 0 ? 'list' : 'grid')}
            selectedIndex={viewMode === 'list' ? 0 : 1}
            buttons={[
              <Ionicons name="list" size={16} color={viewMode === 'list' ? 'white' : '#666'} />,
              <Ionicons name="grid" size={16} color={viewMode === 'grid' ? 'white' : '#666'} />
            ]}
            containerStyle={styles.viewToggleContainer}
            selectedButtonStyle={styles.selectedViewButton}
            innerBorderStyle={{ width: 0 }}
          />
        </View>
      </View>

      {/* Loans List/Grid */}
      <ScrollView 
        style={styles.loansContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#9e9e9e" />
            <Text style={styles.emptyStateText}>No loans found</Text>
            <Text style={styles.emptyStateSubtext}>
              {activeFiltersCount > 0 
                ? 'Try adjusting your filters or search criteria'
                : 'Loans will appear here once created by lenders'
              }
            </Text>
            {activeFiltersCount > 0 && (
              <Button
                title="Clear Filters"
                type="outline"
                buttonStyle={styles.clearFiltersButton}
                onPress={resetFilters}
              />
            )}
          </View>
        ) : (
          <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
            {viewMode === 'list' 
              ? loans.map(renderLoanCard)
              : loans.map(renderLoanGridItem)
            }
          </View>
        )}

        {/* Load More Button */}
        {loansResponse?.data && currentPage < loansResponse.data.total_pages && (
          <View style={styles.loadMoreContainer}>
            <Button
              title={`Load More (${totalLoans - loans.length} remaining)`}
              type="outline"
              buttonStyle={styles.loadMoreButton}
              onPress={loadMoreLoans}
            />
          </View>
        )}
      </ScrollView>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Loans</Text>
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.modalReset}>Reset</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Loan Status</Text>
              <ButtonGroup
                onPress={(index) => setSelectedStatus(statusOptions[index])}
                selectedIndex={statusOptions.indexOf(selectedStatus) >= 0 ? statusOptions.indexOf(selectedStatus) : 0}
                buttons={statusOptions}
                containerStyle={styles.statusButtonGroup}
                selectedButtonStyle={styles.selectedFilterButton}
                vertical
              />
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Lender</Text>
              <ButtonGroup
                onPress={(index) => setSelectedLender(lenderOptions[index].id)}
                selectedIndex={lenderOptions.findIndex(l => l.id === selectedLender)}
                buttons={lenderOptions.map(l => l.name)}
                containerStyle={styles.lenderButtonGroup}
                selectedButtonStyle={styles.selectedFilterButton}
                vertical
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Apply Filters"
              buttonStyle={styles.applyFiltersButton}
              onPress={applyFilters}
            />
          </View>
        </View>
      </Modal>

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
  filterCount: {
    color: '#2196f3',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#f44336',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    marginRight: 12,
  },
  searchInputWrapper: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  searchInputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
    height: 40,
  },
  viewToggle: {
    width: 80,
  },
  viewToggleContainer: {
    height: 40,
    borderRadius: 8,
    borderColor: '#e0e0e0',
  },
  selectedViewButton: {
    backgroundColor: '#2196f3',
  },
  loansContainer: {
    flex: 1,
    padding: 16,
  },
  listContainer: {
    // No special styling needed for list
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearFiltersButton: {
    marginTop: 16,
    borderColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 20,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  loanInfo: {
    flex: 1,
  },
  loanNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  borrowerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  lenderName: {
    fontSize: 12,
    color: '#999',
  },
  loanMetrics: {
    alignItems: 'flex-end',
  },
  loanAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  loanProgress: {
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  loanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanDate: {
    fontSize: 12,
    color: '#999',
  },
  loanTenure: {
    fontSize: 12,
    color: '#666',
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridLoanNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  gridBorrowerName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  gridAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  gridProgressBar: {
    height: 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  gridProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  gridProgress: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    borderColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalReset: {
    fontSize: 16,
    color: '#f44336',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusButtonGroup: {
    borderRadius: 8,
    borderColor: '#e0e0e0',
  },
  lenderButtonGroup: {
    borderRadius: 8,
    borderColor: '#e0e0e0',
    maxHeight: 200,
  },
  selectedFilterButton: {
    backgroundColor: '#2196f3',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  applyFiltersButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 12,
  },
});