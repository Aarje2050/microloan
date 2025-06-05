// src/screens/lender/ManageBorrowersScreen.tsx
// PROFESSIONAL ENTERPRISE VERSION: Clean design + Fixed assignment logic
// Based on real banking/fintech app patterns

import React, { useState } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { 
  Avatar, 
  Badge
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LoanService, CreateBorrowerForm } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { Borrower, User, ApiResponse, LenderStackParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

type ManageBorrowersNavigationProp = StackNavigationProp<LenderStackParamList, 'CreateLoanWizard'>;

interface BorrowerFormData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  credit_score: string;
  employment_type: string;
  monthly_income: string;
}

interface EmailSearchResult {
  status: 'not_found' | 'can_assign' | 'already_yours' | 'taken';
  userData?: any;
  borrowerData?: any;
  message: string;
  actionText: string;
  canProceed: boolean;
}

export const ManageBorrowersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const navigation = useNavigation<ManageBorrowersNavigationProp>();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [emailToSearch, setEmailToSearch] = useState('');
  const [searchResult, setSearchResult] = useState<EmailSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState<BorrowerFormData>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    credit_score: '',
    employment_type: '',
    monthly_income: ''
  });

  // Get current user
  React.useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch borrowers list
  const { 
    data: borrowersResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ApiResponse<Borrower[]>>({
    queryKey: ['borrowers', currentUser?.id, searchQuery],
    queryFn: async (): Promise<ApiResponse<Borrower[]>> => {
      if (!currentUser?.id) {
        return { success: false, data: [], error: 'No user ID available' };
      }
      return LoanService.getBorrowersByLender(currentUser.id, searchQuery || undefined);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
  });

  // FIXED: Properly separated assignment vs creation
  const processBorrowerMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error('No current user');
      
      if (searchResult?.status === 'not_found') {
        // Create completely new borrower (new user + borrower record)
        const borrowerData: CreateBorrowerForm = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          credit_score: formData.credit_score ? Number(formData.credit_score) : undefined,
          employment_type: formData.employment_type,
          monthly_income: Number(formData.monthly_income),
          lender_id: currentUser.id
        };
        return LoanService.createBorrower(borrowerData);
      } 
      
      if (searchResult?.status === 'can_assign') {
        if (searchResult.borrowerData?.id) {
          // CASE 1: Existing borrower record, just update lender_id
          const { data, error } = await supabase
            .from('borrowers')
            .update({ 
              lender_id: currentUser.id,
              // Also update other fields from form
              monthly_income: Number(formData.monthly_income),
              employment_type: formData.employment_type,
              credit_score: formData.credit_score ? Number(formData.credit_score) : undefined
            })
            .eq('id', searchResult.borrowerData.id)
            .select()
            .single();

          if (error) throw error;
          return { success: true, data };
        } else {
          // CASE 2: User exists but no borrower record, create borrower record only
          const { data, error } = await supabase
            .from('borrowers')
            .insert({
              user_id: searchResult.userData.id,
              lender_id: currentUser.id,
              monthly_income: Number(formData.monthly_income),
              employment_type: formData.employment_type,
              credit_score: formData.credit_score ? Number(formData.credit_score) : undefined
            })
            .select()
            .single();

          if (error) throw error;
          return { success: true, data };
        }
      }
      
      throw new Error('Invalid operation');
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ['borrowers'] });
        setShowAddModal(false);
        resetForm();
        Alert.alert('Success', 
          searchResult?.status === 'not_found' 
            ? 'New borrower created successfully!'
            : 'Borrower assigned to you successfully!'
        );
      } else {
        Alert.alert('Error', (result as ApiResponse<Borrower>).error || 'Operation failed');
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Operation failed');
    }
  });

  /**
   * SIMPLIFIED: Search email function
   */
  const handleEmailSearch = async () => {
    if (!emailToSearch.trim() || !currentUser?.id) return;
    
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const email = emailToSearch.toLowerCase().trim();
      
      // Check if user exists
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('role', 'borrower')
        .maybeSingle();

      if (!userData) {
        setSearchResult({
          status: 'not_found',
          message: 'Email not found. You can create a new borrower.',
          actionText: 'Create New Borrower',
          canProceed: true
        });
        setFormData(prev => ({ ...prev, email: emailToSearch }));
        return;
      }

      // Check if borrower record exists
      const { data: borrowerData } = await supabase
        .from('borrowers')
        .select(`
          *,
          lender:users!borrowers_lender_id_fkey(full_name)
        `)
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!borrowerData) {
        // User exists but no borrower record
        setSearchResult({
          status: 'can_assign',
          userData,
          message: 'User found! They can be assigned to you.',
          actionText: 'Assign to Me',
          canProceed: true
        });
        setFormData(prev => ({ 
          ...prev, 
          email: emailToSearch,
          full_name: userData.full_name || '',
          phone: userData.phone || ''
        }));
        return;
      }

      if (!borrowerData.lender_id) {
        // Unassigned borrower
        setSearchResult({
          status: 'can_assign',
          userData,
          borrowerData,
          message: 'Borrower found and available for assignment.',
          actionText: 'Assign to Me',
          canProceed: true
        });
        setFormData(prev => ({ 
          ...prev, 
          email: emailToSearch,
          full_name: userData.full_name || '',
          phone: userData.phone || ''
        }));
      } else if (borrowerData.lender_id === currentUser.id) {
        // Already assigned to current lender
        setSearchResult({
          status: 'already_yours',
          userData,
          borrowerData,
          message: 'This borrower is already assigned to you.',
          actionText: 'Already Assigned',
          canProceed: false
        });
      } else {
        // Assigned to another lender
        const lenderName = (borrowerData as any).lender?.full_name || 'another lender';
        setSearchResult({
          status: 'taken',
          userData,
          borrowerData,
          message: `This borrower is managed by ${lenderName}.`,
          actionText: 'Not Available',
          canProceed: false
        });
      }

    } catch (error) {
      console.error('Email search error:', error);
      Alert.alert('Error', 'Failed to search email. Please try again.');
    } finally {
      setIsSearching(false);
    }
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
   * Reset form data
   */
  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      credit_score: '',
      employment_type: '',
      monthly_income: ''
    });
    setEmailToSearch('');
    setSearchResult(null);
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    if (!formData.full_name.trim()) {
      Alert.alert('Error', 'Full name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return false;
    }
    if (!formData.address.trim()) {
      Alert.alert('Error', 'Address is required');
      return false;
    }
    if (!formData.employment_type.trim()) {
      Alert.alert('Error', 'Employment type is required');
      return false;
    }
    if (!formData.monthly_income.trim() || Number(formData.monthly_income) <= 0) {
      Alert.alert('Error', 'Valid monthly income is required');
      return false;
    }
    return true;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    const actionText = searchResult?.status === 'not_found' ? 'create' : 'assign';
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${actionText} this borrower?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => processBorrowerMutation.mutate() }
      ]
    );
  };

  /**
   * Get borrower status badge
   */
  const getBorrowerStatus = (borrower: Borrower): { text: string; color: string } => {
    const loans = (borrower as any).loans || [];
    const activeLoans = loans.filter((loan: any) => loan.status === 'active');
    
    if (activeLoans.length > 0) {
      return { text: `${activeLoans.length} Active`, color: '#10b981' };
    } else if (loans.length > 0) {
      return { text: 'Past Customer', color: '#3b82f6' };
    } else {
      return { text: 'New Customer', color: '#6b7280' };
    }
  };

  /**
   * Calculate total loan amount
   */
  const getTotalLoanAmount = (borrower: Borrower): number => {
    const loans = (borrower as any).loans || [];
    return loans.reduce((total: number, loan: any) => {
      if (loan.status === 'active') {
        return total + loan.principal_amount;
      }
      return total;
    }, 0);
  };

  // Show loading state
  if (isLoading && !borrowersResponse) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="people" size={48} color="#3b82f6" />
          <Text style={styles.loadingText}>Loading Borrowers...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error || (borrowersResponse && !borrowersResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load borrowers</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const borrowers: Borrower[] = borrowersResponse?.data || [];

  return (
    <View style={styles.container}>
      
      {/* Professional Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Borrowers</Text>
          <Text style={styles.headerSubtitle}>
            {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''} • Manage your portfolio
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Professional Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search borrowers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Borrowers List */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {borrowers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={64} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No borrowers yet</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No borrowers match your search' : 'Add your first borrower to get started'}
            </Text>
          </View>
        ) : (
          <View style={styles.borrowersList}>
            {borrowers.map((borrower: Borrower) => {
              const status = getBorrowerStatus(borrower);
              const totalLoanAmount = getTotalLoanAmount(borrower);
              const user = (borrower as any).user;

              return (
                <View key={borrower.id} style={styles.borrowerCard}>
                  <View style={styles.borrowerMain}>
                    <Avatar
                      size={48}
                      rounded
                      title={user?.full_name?.charAt(0)?.toUpperCase() || 'B'}
                      overlayContainerStyle={{ backgroundColor: '#3b82f6' }}
                    />
                    <View style={styles.borrowerInfo}>
                      <View style={styles.borrowerHeader}>
                        <Text style={styles.borrowerName}>{user?.full_name}</Text>
                        <Badge
                          value={status.text}
                          badgeStyle={[styles.statusBadge, { backgroundColor: status.color }]}
                          textStyle={styles.statusText}
                        />
                      </View>
                      <Text style={styles.borrowerEmail}>{user?.email}</Text>
                      <Text style={styles.borrowerPhone}>{user?.phone}</Text>
                      <View style={styles.borrowerMetrics}>
                        <Text style={styles.incomeText}>
                          Income : ₹{(borrower.monthly_income || 0).toLocaleString()}/month
                        </Text>
                        {totalLoanAmount > 0 && (
                          <Text style={styles.loanText}>
                            Active Loan: {formatCurrency(totalLoanAmount)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.borrowerActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="eye-outline" size={18} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.primaryAction]}
                      onPress={() => navigation.navigate('CreateLoanWizard', { borrowerId: borrower.id })}
                    >
                      <Ionicons name="add" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* PROFESSIONAL: Add Borrower Modal with FIXED Input Handling */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowAddModal(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Borrower</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContentContainer}
          >
            
            {/* Email Search Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email Lookup</Text>
              <Text style={styles.sectionDescription}>
                Check if the borrower is already in the system
              </Text>
              
              <View style={styles.emailSearchRow}>
                <View style={styles.emailInputContainer}>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Enter email address"
                    value={emailToSearch}
                    onChangeText={setEmailToSearch}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#9ca3af"
                    returnKeyType="search"
                    onSubmitEditing={handleEmailSearch}
                    blurOnSubmit={false}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.searchButton, (!emailToSearch.trim() || isSearching) && styles.searchButtonDisabled]}
                  onPress={handleEmailSearch}
                  disabled={!emailToSearch.trim() || isSearching}
                >
                  {isSearching ? (
                    <Text style={styles.searchButtonText}>...</Text>
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* Search Result */}
              {searchResult && (
                <View style={[styles.resultContainer, styles[`result_${searchResult.status}`]]}>
                  <Ionicons 
                    name={
                      searchResult.status === 'not_found' ? 'person-add' :
                      searchResult.status === 'can_assign' ? 'checkmark-circle' :
                      searchResult.status === 'already_yours' ? 'information-circle' : 'warning'
                    }
                    size={20} 
                    color={
                      searchResult.status === 'not_found' ? '#10b981' :
                      searchResult.status === 'can_assign' ? '#10b981' :
                      searchResult.status === 'already_yours' ? '#3b82f6' : '#ef4444'
                    }
                  />
                  <Text style={styles.resultText}>{searchResult.message}</Text>
                </View>
              )}
            </View>

            {/* Form Section */}
            {searchResult && searchResult.canProceed && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Borrower Details</Text>
                <Text style={styles.sectionDescription}>
                  {searchResult.status === 'not_found' 
                    ? 'Complete the form to create a new borrower'
                    : 'Fill in the remaining details to assign this borrower'
                  }
                </Text>

                <View style={styles.formGrid}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.full_name}
                      onChangeText={(value) => setFormData({...formData, full_name: value})}
                      placeholder="Enter full name"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address *</Text>
                    <TextInput
                      style={[styles.input, styles.inputDisabled]}
                      value={formData.email}
                      editable={false}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.phone}
                      onChangeText={(value) => setFormData({...formData, phone: value})}
                      placeholder="Enter phone number"
                      keyboardType="phone-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Address *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.address}
                      onChangeText={(value) => setFormData({...formData, address: value})}
                      placeholder="Enter address"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Employment Type *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.employment_type}
                      onChangeText={(value) => setFormData({...formData, employment_type: value})}
                      placeholder="e.g., Salaried, Self-employed"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monthly Income (₹) *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.monthly_income}
                      onChangeText={(value) => setFormData({...formData, monthly_income: value})}
                      placeholder="e.g., 50000"
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Credit Score (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.credit_score}
                      onChangeText={(value) => setFormData({...formData, credit_score: value})}
                      placeholder="300-850"
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal Footer */}
          {searchResult && searchResult.canProceed && (
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, processBorrowerMutation.isPending && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={processBorrowerMutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {processBorrowerMutation.isPending ? 'Processing...' : searchResult.actionText}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  // Search Styles
  searchSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 8,
  },
  // Content Styles
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  borrowersList: {
    padding: 20,
    gap: 12,
  },
  borrowerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  borrowerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  borrowerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  borrowerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  borrowerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  borrowerEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  borrowerPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  borrowerMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  incomeText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  loanText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
  },
  borrowerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    backgroundColor: '#eff6ff',
  },
  // Loading & Error Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 20,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  emailSearchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  emailInputContainer: {
    flex: 1,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  result_not_found: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  result_can_assign: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  result_already_yours: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  result_taken: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  resultText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  formGrid: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});