// src/screens/lender/RecordPaymentScreen.tsx
// Enterprise payment recording system with EMI status updates and validation
// Complete payment lifecycle management for loan collections

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  Alert,
  TouchableOpacity,
  Modal
} from 'react-native';
import { 
  Button, 
  Input,
  ButtonGroup,
  Card,
  Avatar,
  Badge,
  Divider
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LoanService, RecordPaymentForm } from '../../services/loans/loanService';
import { AuthService } from '../../services/auth/authService';
import { Loan, User, ApiResponse, PaymentMethod, LenderStackParamList } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation types
type RecordPaymentRouteProp = RouteProp<LenderStackParamList, 'RecordPayment'>;
type RecordPaymentNavigationProp = StackNavigationProp<LenderStackParamList, 'RecordPayment'>;

// Payment method options
const PAYMENT_METHODS: Array<{ label: string; value: PaymentMethod; icon: string }> = [
  { label: 'Cash', value: 'cash', icon: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer', icon: 'card' },
  { label: 'UPI', value: 'upi', icon: 'phone-portrait' },
  { label: 'Cheque', value: 'cheque', icon: 'document-text' }
];

interface PaymentFormData {
  loan_id: string;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string;
  notes: string;
}

interface PaymentFormErrors {
  loan_id?: string;
  amount?: string;
  payment_date?: string;
  payment_method?: string;
  reference_number?: string;
}

export const RecordPaymentScreen: React.FC = () => {
  const navigation = useNavigation<RecordPaymentNavigationProp>();
  const route = useRoute<RecordPaymentRouteProp>();
  const queryClient = useQueryClient();

  // State management
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoanSelector, setShowLoanSelector] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    loan_id: route.params?.loanId || '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState<PaymentFormErrors>({});

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Pre-select loan if passed via route params
  useEffect(() => {
    if (route.params?.loanId) {
      setFormData(prev => ({ ...prev, loan_id: route.params.loanId! }));
    }
  }, [route.params?.loanId]);

  // Get lender's borrower IDs for filtering loans
  const { data: borrowersResponse } = useQuery({
    queryKey: ['borrowers', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return LoanService.getBorrowersByLender(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Fetch active loans for payment recording
  const { data: loansResponse, isLoading: loansLoading } = useQuery({
    queryKey: ['activeLoans', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !borrowersResponse?.success) {
        return { success: false, data: { data: [], count: 0, page: 1, limit: 50, total_pages: 0 } };
      }

      const borrowerIds = borrowersResponse.data?.map(b => b.id) || [];
      if (borrowerIds.length === 0) {
        return { 
          success: true, 
          data: { data: [], count: 0, page: 1, limit: 50, total_pages: 0 } 
        };
      }

      // Get active loans only
      const result = await LoanService.getLoans(1, 50, { status: 'active' });
      
      if (result.success && result.data) {
        const filteredLoans = result.data.data.filter(loan => 
          borrowerIds.includes(loan.borrower_id)
        );
        
        return {
          success: true,
          data: {
            ...result.data,
            data: filteredLoans
          }
        };
      }
      
      return result;
    },
    enabled: !!currentUser?.id && !!borrowersResponse?.success,
  });

  // Find selected loan details
  useEffect(() => {
    if (formData.loan_id && loansResponse?.success) {
      const loan = loansResponse.data?.data.find(l => l.id === formData.loan_id);
      setSelectedLoan(loan || null);
    }
  }, [formData.loan_id, loansResponse]);

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: RecordPaymentForm) => {
      if (!currentUser?.id) {
        throw new Error('No current user');
      }
      return LoanService.recordPayment(paymentData, currentUser.id);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['activeLoans'] });
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        queryClient.invalidateQueries({ queryKey: ['lenderAnalytics'] });
        
        Alert.alert(
          'Payment Recorded',
          `Payment of ${formatCurrency(Number(formData.amount))} recorded successfully!`,
          [
            {
              text: 'Record Another',
              onPress: () => resetForm()
            },
            {
              text: 'Done',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to record payment');
      }
    },
    onError: (error) => {
      Alert.alert('Error', 'An unexpected error occurred while recording payment');
      console.error('Record payment error:', error);
    }
  });

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormData({
      loan_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      reference_number: '',
      notes: ''
    });
    setSelectedLoan(null);
    setFormErrors({});
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: PaymentFormErrors = {};

    if (!formData.loan_id) {
      errors.loan_id = 'Please select a loan';
    }

    if (!formData.amount.trim()) {
      errors.amount = 'Payment amount is required';
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    } else if (Number(formData.amount) > 10000000) {
      errors.amount = 'Amount cannot exceed ₹1,00,00,000';
    }

    if (!formData.payment_date) {
      errors.payment_date = 'Payment date is required';
    }

    if (!formData.payment_method) {
      errors.payment_method = 'Payment method is required';
    }

    if (['bank_transfer', 'upi', 'cheque'].includes(formData.payment_method) && !formData.reference_number.trim()) {
      errors.reference_number = 'Reference number is required for this payment method';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle payment submission
   */
  const handleSubmitPayment = () => {
    if (!validateForm() || !currentUser?.id) return;

    const paymentData: RecordPaymentForm = {
      loan_id: formData.loan_id,
      amount: Number(formData.amount),
      payment_date: formData.payment_date,
      payment_method: formData.payment_method,
      reference_number: formData.reference_number.trim() || undefined,
      notes: formData.notes.trim() || undefined
    };

    Alert.alert(
      'Confirm Payment',
      `Record payment of ${formatCurrency(paymentData.amount)} for loan ${selectedLoan?.loan_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Record Payment', 
          onPress: () => recordPaymentMutation.mutate(paymentData)
        }
      ]
    );
  };

  /**
   * Render loan selector item
   */
  const renderLoanItem = (loan: Loan) => {
    const borrower = (loan as any).borrower;
    const borrowerUser = borrower?.user;

    return (
      <TouchableOpacity
        key={loan.id}
        style={[
          styles.loanSelectorItem,
          formData.loan_id === loan.id && styles.loanSelectorItemSelected
        ]}
        onPress={() => {
          setFormData({ ...formData, loan_id: loan.id });
          setShowLoanSelector(false);
        }}
      >
        <View style={styles.loanSelectorInfo}>
          <Avatar
            size="small"
            rounded
            title={borrowerUser?.full_name?.charAt(0)?.toUpperCase() || 'B'}
            overlayContainerStyle={{ backgroundColor: '#2196f3' }}
          />
          <View style={styles.loanSelectorDetails}>
            <Text style={styles.loanSelectorNumber}>{loan.loan_number}</Text>
            <Text style={styles.loanSelectorBorrower}>
              {borrowerUser?.full_name || 'Unknown Borrower'}
            </Text>
            <Text style={styles.loanSelectorAmount}>
              {formatCurrency(loan.principal_amount)} • {loan.interest_rate}% • {loan.tenure_months}m
            </Text>
          </View>
        </View>
        {formData.loan_id === loan.id && (
          <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
        )}
      </TouchableOpacity>
    );
  };

  const activeLoans = loansResponse?.data?.data || [];

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
          <Text style={styles.headerTitle}>Record Payment</Text>
          <Text style={styles.headerSubtitle}>Update loan payment details</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Selected Loan Card */}
        {selectedLoan && (
          <View style={styles.selectedLoanCard}>
            <View style={styles.selectedLoanHeader}>
              <Text style={styles.selectedLoanLabel}>Selected Loan</Text>
              <Badge value="Active" badgeStyle={{ backgroundColor: '#4caf50' }} />
            </View>
            <View style={styles.selectedLoanInfo}>
              <Text style={styles.selectedLoanNumber}>{selectedLoan.loan_number}</Text>
              <Text style={styles.selectedLoanBorrower}>
                {((selectedLoan as any).borrower?.user?.full_name) || 'Unknown Borrower'}
              </Text>
              <Text style={styles.selectedLoanDetails}>
                {formatCurrency(selectedLoan.principal_amount)} • {selectedLoan.interest_rate}% • {selectedLoan.tenure_months} months
              </Text>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.formContainer}>
          
          {/* Loan Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Select Loan *</Text>
            <TouchableOpacity
              style={[
                styles.loanSelectButton,
                formErrors.loan_id && styles.inputError
              ]}
              onPress={() => setShowLoanSelector(true)}
            >
              <Text style={[
                styles.loanSelectText,
                !selectedLoan && styles.loanSelectPlaceholder
              ]}>
                {selectedLoan 
                  ? `${selectedLoan.loan_number} - ${((selectedLoan as any).borrower?.user?.full_name) || 'Unknown'}`
                  : 'Select a loan to record payment'
                }
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {formErrors.loan_id && (
              <Text style={styles.errorText}>{formErrors.loan_id}</Text>
            )}
          </View>

          {/* Payment Amount */}
          <Input
            label="Payment Amount (₹) *"
            value={formData.amount}
            onChangeText={(value) => setFormData({...formData, amount: value})}
            errorMessage={formErrors.amount}
            keyboardType="numeric"
            placeholder="e.g., 5000"
            leftIcon={<Ionicons name="cash" size={20} color="#9CA3AF" />}
            containerStyle={styles.inputContainer}
          />

          {/* Payment Date */}
          <Input
            label="Payment Date *"
            value={formData.payment_date}
            onChangeText={(value) => setFormData({...formData, payment_date: value})}
            errorMessage={formErrors.payment_date}
            placeholder="YYYY-MM-DD"
            leftIcon={<Ionicons name="calendar" size={20} color="#9CA3AF" />}
            containerStyle={styles.inputContainer}
          />

          {/* Payment Method */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Payment Method *</Text>
            <View style={styles.paymentMethodGrid}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethodButton,
                    formData.payment_method === method.value && styles.paymentMethodButtonActive
                  ]}
                  onPress={() => setFormData({...formData, payment_method: method.value})}
                >
                  <Ionicons 
                    name={method.icon as any} 
                    size={20} 
                    color={formData.payment_method === method.value ? '#2196f3' : '#666'} 
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    formData.payment_method === method.value && styles.paymentMethodTextActive
                  ]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reference Number */}
          <Input
            label={`Reference Number ${['bank_transfer', 'upi', 'cheque'].includes(formData.payment_method) ? '*' : '(Optional)'}`}
            value={formData.reference_number}
            onChangeText={(value) => setFormData({...formData, reference_number: value})}
            errorMessage={formErrors.reference_number}
            placeholder="Transaction ID, Cheque No., etc."
            leftIcon={<Ionicons name="document-text" size={20} color="#9CA3AF" />}
            containerStyle={styles.inputContainer}
          />

          {/* Notes */}
          <Input
            label="Notes (Optional)"
            value={formData.notes}
            onChangeText={(value) => setFormData({...formData, notes: value})}
            placeholder="Additional payment details"
            multiline
            leftIcon={<Ionicons name="chatbox" size={20} color="#9CA3AF" />}
            containerStyle={styles.inputContainer}
          />

          {/* Payment Summary */}
          {selectedLoan && formData.amount && !isNaN(Number(formData.amount)) && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Payment Summary</Text>
              <Divider style={styles.summaryDivider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Loan:</Text>
                <Text style={styles.summaryValue}>{selectedLoan.loan_number}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Borrower:</Text>
                <Text style={styles.summaryValue}>
                  {((selectedLoan as any).borrower?.user?.full_name) || 'Unknown'}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Amount:</Text>
                <Text style={styles.summaryValueBold}>
                  {formatCurrency(Number(formData.amount))}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Method:</Text>
                <Text style={styles.summaryValue}>
                  {PAYMENT_METHODS.find(m => m.value === formData.payment_method)?.label}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date:</Text>
                <Text style={styles.summaryValue}>{formData.payment_date}</Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <Button
          title="Record Payment"
          buttonStyle={styles.submitButton}
          titleStyle={styles.submitButtonText}
          loading={recordPaymentMutation.isPending}
          disabled={!selectedLoan || !formData.amount || recordPaymentMutation.isPending}
          onPress={handleSubmitPayment}
          icon={<Ionicons name="checkmark" size={20} color="white" />}
        />
      </View>

      {/* Loan Selector Modal */}
      <Modal
        visible={showLoanSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLoanSelector(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Loan</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {loansLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading active loans...</Text>
              </View>
            ) : activeLoans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#9e9e9e" />
                <Text style={styles.emptyStateText}>No active loans found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Create active loans to record payments
                </Text>
              </View>
            ) : (
              activeLoans.map(renderLoanItem)
            )}
          </ScrollView>
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
  content: {
    flex: 1,
  },
  selectedLoanCard: {
    backgroundColor: '#e8f5e8',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  selectedLoanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedLoanLabel: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '500',
  },
  selectedLoanInfo: {
    marginTop: 4,
  },
  selectedLoanNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  selectedLoanBorrower: {
    fontSize: 14,
    color: '#2e7d32',
    marginTop: 2,
  },
  selectedLoanDetails: {
    fontSize: 12,
    color: '#388e3c',
    marginTop: 4,
  },
  formContainer: {
    padding: 16,
    paddingTop: 0,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#86939e',
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 8,
  },
  loanSelectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loanSelectText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  loanSelectPlaceholder: {
    color: '#9CA3AF',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
    marginLeft: 4,
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  paymentMethodButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentMethodButtonActive: {
    borderColor: '#2196f3',
    backgroundColor: '#f3f8ff',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  paymentMethodTextActive: {
    color: '#2196f3',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryDivider: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  summaryValueBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  submitContainer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  },
  loanSelectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loanSelectorItemSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#f3f8ff',
  },
  loanSelectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loanSelectorDetails: {
    marginLeft: 12,
    flex: 1,
  },
  loanSelectorNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loanSelectorBorrower: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loanSelectorAmount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});