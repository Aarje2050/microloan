// src/screens/lender/CreateLoanWizardScreen.tsx
// Enterprise multi-step loan creation wizard with real-time EMI calculations
// Professional guided workflow for loan creation with comprehensive validation

import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
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
  CheckBox
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LoanService, CreateLoanForm } from '../../services/loans/loanService';
import { EMICalculationService, LoanParameters } from '../../services/calculations/emiCalculationService';
import { AuthService } from '../../services/auth/authService';
import { Borrower, User, ApiResponse, Loan } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

// Navigation types
type LenderStackParamList = {
  MyBorrowers: undefined;
  CreateLoanWizard: { borrowerId?: string };
};

type CreateLoanWizardRouteProp = RouteProp<LenderStackParamList, 'CreateLoanWizard'>;
type CreateLoanWizardNavigationProp = StackNavigationProp<LenderStackParamList, 'CreateLoanWizard'>;

// Wizard step enum
enum WizardStep {
  SELECT_BORROWER = 1,
  LOAN_PARAMETERS = 2,
  EMI_PREVIEW = 3,
  CONFIRMATION = 4
}

interface LoanFormData {
  borrower_id: string;
  principal_amount: string;
  interest_rate: string;
  tenure_months: string;
  purpose: string;
  collateral_details: string;
}

interface LoanFormErrors {
  borrower_id?: string;
  principal_amount?: string;
  interest_rate?: string;
  tenure_months?: string;
  purpose?: string;
}

export const CreateLoanWizardScreen: React.FC = () => {
  const navigation = useNavigation<CreateLoanWizardNavigationProp>();
  const route = useRoute<CreateLoanWizardRouteProp>();
  const queryClient = useQueryClient();

  // State management
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    route.params?.borrowerId ? WizardStep.LOAN_PARAMETERS : WizardStep.SELECT_BORROWER
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [formData, setFormData] = useState<LoanFormData>({
    borrower_id: route.params?.borrowerId || '',
    principal_amount: '',
    interest_rate: '12',
    tenure_months: '12',
    purpose: '',
    collateral_details: ''
  });
  const [formErrors, setFormErrors] = useState<LoanFormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Pre-select borrower if passed via route params
  useEffect(() => {
    if (route.params?.borrowerId) {
      setFormData(prev => ({ ...prev, borrower_id: route.params.borrowerId! }));
    }
  }, [route.params?.borrowerId]);

  // Fetch borrowers list
  const { data: borrowersResponse, isLoading: borrowersLoading } = useQuery<ApiResponse<Borrower[]>>({
    queryKey: ['borrowers', currentUser?.id],
    queryFn: async (): Promise<ApiResponse<Borrower[]>> => {
      if (!currentUser?.id) {
        return { success: false, data: [], error: 'No user ID available' };
      }
      return LoanService.getBorrowersByLender(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Find selected borrower
  useEffect(() => {
    if (formData.borrower_id && borrowersResponse?.success) {
      const borrower = borrowersResponse.data?.find(b => b.id === formData.borrower_id);
      setSelectedBorrower(borrower || null);
    }
  }, [formData.borrower_id, borrowersResponse]);

  // Create loan mutation
  const createLoanMutation = useMutation<ApiResponse<Loan>, Error, CreateLoanForm>({
    mutationFn: (loanData: CreateLoanForm) => {
      if (!currentUser?.id) {
        return Promise.reject(new Error('No current user'));
      }
      return LoanService.createLoan(loanData, currentUser.id);
    },
 // ✅ REPLACE WITH THIS FIXED VERSION:
onSuccess: (result) => {
  if (result.success) {
    queryClient.invalidateQueries({ queryKey: ['borrowers'] });
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    Alert.alert(
      'Success!', 
      `Loan ${result.data?.loan_number} created successfully!`,
      [
        {
          text: 'OK',
          onPress: () => {
            // Go back to previous screen (MyBorrowers)
            navigation.goBack();
          }
        }
      ]
    );
  } else {
    Alert.alert('Error', result.error || 'Failed to create loan');
  }
},
    onError: (error) => {
      Alert.alert('Error', 'An unexpected error occurred while creating the loan');
      console.error('Create loan error:', error);
    }
  });

  // Calculate EMI preview
  const emiCalculation = useMemo(() => {
    if (!formData.principal_amount || !formData.interest_rate || !formData.tenure_months) {
      return null;
    }

    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate);
    const tenure = parseInt(formData.tenure_months);

    if (isNaN(principal) || isNaN(rate) || isNaN(tenure) || principal <= 0 || rate < 0 || tenure <= 0) {
      return null;
    }

    const loanParams: LoanParameters = {
      principal,
      annualInterestRate: rate,
      tenureMonths: tenure
    };

    const validation = EMICalculationService.validateLoanParameters(loanParams);
    if (!validation.isValid) {
      return null;
    }

    return EMICalculationService.calculateEMI(loanParams);
  }, [formData.principal_amount, formData.interest_rate, formData.tenure_months]);

  /**
   * Validate current step data
   */
  const validateCurrentStep = (): boolean => {
    const errors: LoanFormErrors = {};

    switch (currentStep) {
      case WizardStep.SELECT_BORROWER:
        if (!formData.borrower_id) {
          errors.borrower_id = 'Please select a borrower';
        }
        break;

      case WizardStep.LOAN_PARAMETERS:
        if (!formData.principal_amount.trim()) {
          errors.principal_amount = 'Loan amount is required';
        } else if (isNaN(Number(formData.principal_amount)) || Number(formData.principal_amount) <= 0) {
          errors.principal_amount = 'Please enter a valid loan amount';
        } else if (Number(formData.principal_amount) > 10000000) {
          errors.principal_amount = 'Loan amount cannot exceed ₹1,00,00,000';
        }

        if (!formData.interest_rate.trim()) {
          errors.interest_rate = 'Interest rate is required';
        } else if (isNaN(Number(formData.interest_rate)) || Number(formData.interest_rate) < 0) {
          errors.interest_rate = 'Please enter a valid interest rate';
        } else if (Number(formData.interest_rate) > 50) {
          errors.interest_rate = 'Interest rate cannot exceed 50%';
        }

        if (!formData.tenure_months.trim()) {
          errors.tenure_months = 'Loan tenure is required';
        } else if (isNaN(Number(formData.tenure_months)) || Number(formData.tenure_months) <= 0) {
          errors.tenure_months = 'Please enter a valid tenure';
        } else if (Number(formData.tenure_months) > 360) {
          errors.tenure_months = 'Tenure cannot exceed 360 months';
        }
        break;

      case WizardStep.CONFIRMATION:
        if (!termsAccepted) {
          Alert.alert('Terms Required', 'Please accept the terms and conditions to proceed.');
          return false;
        }
        break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle next step
   */
  const handleNext = () => {
    if (!validateCurrentStep()) return;

    if (currentStep < WizardStep.CONFIRMATION) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCreateLoan();
    }
  };

  /**
   * Handle previous step
   */
  const handlePrevious = () => {
    if (currentStep > WizardStep.SELECT_BORROWER) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Handle loan creation
   */
  const handleCreateLoan = () => {
    if (!validateCurrentStep() || !selectedBorrower) return;

    const loanData: CreateLoanForm = {
      borrower_id: formData.borrower_id,
      principal_amount: Number(formData.principal_amount),
      interest_rate: Number(formData.interest_rate),
      tenure_months: Number(formData.tenure_months),
      purpose: formData.purpose.trim() || undefined,
      collateral_details: formData.collateral_details.trim() || undefined
    };

    createLoanMutation.mutate(loanData);
  };

  /**
   * Get step title
   */
  const getStepTitle = (): string => {
    switch (currentStep) {
      case WizardStep.SELECT_BORROWER: return 'Select Borrower';
      case WizardStep.LOAN_PARAMETERS: return 'Loan Details';
      case WizardStep.EMI_PREVIEW: return 'EMI Preview';
      case WizardStep.CONFIRMATION: return 'Confirmation';
      default: return 'Create Loan';
    }
  };

  /**
   * Render progress indicator
   */
  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.progressStep}>
          <View style={[
            styles.progressCircle,
            step <= currentStep ? styles.progressCircleActive : styles.progressCircleInactive
          ]}>
            <Text style={[
              styles.progressText,
              step <= currentStep ? styles.progressTextActive : styles.progressTextInactive
            ]}>
              {step}
            </Text>
          </View>
          {step < 4 && (
            <View style={[
              styles.progressLine,
              step < currentStep ? styles.progressLineActive : styles.progressLineInactive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  /**
   * Render borrower selection step
   */
  const renderBorrowerSelection = () => {
    if (borrowersLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="people" size={48} color="#2196f3" />
          <Text style={styles.loadingText}>Loading borrowers...</Text>
        </View>
      );
    }

    const borrowers = borrowersResponse?.data || [];

    if (borrowers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-add" size={64} color="#9e9e9e" />
          <Text style={styles.emptyStateText}>No borrowers found</Text>
          <Text style={styles.emptyStateSubtext}>Please add borrowers before creating loans</Text>
          <Button
            title="Add Borrower"
            buttonStyle={styles.addBorrowerButton}
            onPress={() => navigation.navigate('MyBorrowers')}
          />
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepDescription}>
          Select the borrower for this loan application.
        </Text>
        
        <FlatList
          data={borrowers}
          keyExtractor={(item) => item.id}
          renderItem={({ item: borrower }) => {
            const user = (borrower as any).user;
            const isSelected = formData.borrower_id === borrower.id;
            
            return (
              <TouchableOpacity
                style={[
                  styles.borrowerCard,
                  isSelected && styles.borrowerCardSelected
                ]}
                onPress={() => setFormData({ ...formData, borrower_id: borrower.id })}
              >
                <View style={styles.borrowerInfo}>
                  <Avatar
                    size="medium"
                    rounded
                    title={user?.full_name?.charAt(0)?.toUpperCase() || 'B'}
                    overlayContainerStyle={{ backgroundColor: '#2196f3' }}
                  />
                  <View style={styles.borrowerDetails}>
                    <Text style={styles.borrowerName}>{user?.full_name}</Text>
                    <Text style={styles.borrowerEmail}>{user?.email}</Text>
                    <Text style={styles.borrowerPhone}>{user?.phone}</Text>
                    <Text style={styles.borrowerIncome}>
                      Income: {formatCurrency(borrower.monthly_income || 0)}/month
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
                )}
              </TouchableOpacity>
            );
          }}
          style={styles.borrowersList}
        />
        
        {formErrors.borrower_id && (
          <Text style={styles.errorText}>{formErrors.borrower_id}</Text>
        )}
      </View>
    );
  };

  /**
   * Render loan parameters step
   */
  const renderLoanParameters = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepDescription}>
        Enter the loan details and parameters.
      </Text>

      {selectedBorrower && (
        <View style={styles.selectedBorrowerCard}>
          <Text style={styles.selectedBorrowerLabel}>Selected Borrower:</Text>
          <Text style={styles.selectedBorrowerName}>
            {(selectedBorrower as any).user?.full_name}
          </Text>
        </View>
      )}

      <View style={styles.formContainer}>
        <Input
          label="Loan Amount (₹) *"
          value={formData.principal_amount}
          onChangeText={(value) => setFormData({...formData, principal_amount: value})}
          errorMessage={formErrors.principal_amount}
          keyboardType="numeric"
          placeholder="e.g., 100000"
          leftIcon={<Ionicons name="cash" size={20} color="#9CA3AF" />}
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Annual Interest Rate (%) *"
          value={formData.interest_rate}
          onChangeText={(value) => setFormData({...formData, interest_rate: value})}
          errorMessage={formErrors.interest_rate}
          keyboardType="numeric"
          placeholder="e.g., 12.5"
          leftIcon={<Ionicons name="trending-up" size={20} color="#9CA3AF" />}
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Loan Tenure (Months) *"
          value={formData.tenure_months}
          onChangeText={(value) => setFormData({...formData, tenure_months: value})}
          errorMessage={formErrors.tenure_months}
          keyboardType="numeric"
          placeholder="e.g., 24"
          leftIcon={<Ionicons name="calendar" size={20} color="#9CA3AF" />}
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Purpose (Optional)"
          value={formData.purpose}
          onChangeText={(value) => setFormData({...formData, purpose: value})}
          placeholder="e.g., Business expansion, Personal use"
          leftIcon={<Ionicons name="document-text" size={20} color="#9CA3AF" />}
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Collateral Details (Optional)"
          value={formData.collateral_details}
          onChangeText={(value) => setFormData({...formData, collateral_details: value})}
          placeholder="e.g., Property documents, Vehicle RC"
          multiline
          leftIcon={<Ionicons name="shield-checkmark" size={20} color="#9CA3AF" />}
          containerStyle={styles.inputContainer}
        />

        {/* Quick EMI Preview */}
        {emiCalculation && (
          <View style={styles.quickPreviewCard}>
            <Text style={styles.quickPreviewTitle}>Quick Preview</Text>
            <View style={styles.quickPreviewRow}>
              <Text style={styles.quickPreviewLabel}>Monthly EMI:</Text>
              <Text style={styles.quickPreviewValue}>
                {formatCurrency(emiCalculation.emiAmount)}
              </Text>
            </View>
            <View style={styles.quickPreviewRow}>
              <Text style={styles.quickPreviewLabel}>Total Interest:</Text>
              <Text style={styles.quickPreviewValue}>
                {formatCurrency(emiCalculation.totalInterest)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  /**
   * Render EMI preview step
   */
  const renderEmiPreview = () => {
    if (!emiCalculation) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid loan parameters</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepDescription}>
          Review the EMI schedule and loan summary.
        </Text>

        {/* Loan Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Loan Summary</Text>
          <Divider style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Principal Amount:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(Number(formData.principal_amount))}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Interest Rate:</Text>
            <Text style={styles.summaryValue}>{formData.interest_rate}% per annum</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tenure:</Text>
            <Text style={styles.summaryValue}>{formData.tenure_months} months</Text>
          </View>
          
          <Divider style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Monthly EMI:</Text>
            <Text style={styles.summaryValueBold}>
              {formatCurrency(emiCalculation.emiAmount)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Interest:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(emiCalculation.totalInterest)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Total Amount:</Text>
            <Text style={styles.summaryValueBold}>
              {formatCurrency(emiCalculation.totalAmount)}
            </Text>
          </View>
        </View>

        {/* EMI Schedule Preview (First 6 months) */}
        <View style={styles.scheduleCard}>
          <Text style={styles.scheduleTitle}>EMI Schedule (First 6 months)</Text>
          <Divider style={styles.scheduleDivider} />
          
          {emiCalculation.schedule.slice(0, 6).map((emi) => (
            <View key={emi.emiNumber} style={styles.scheduleRow}>
              <Text style={styles.scheduleEmiNumber}>EMI {emi.emiNumber}</Text>
              <Text style={styles.scheduleDate}>
                {formatDate(emi.dueDate, 'short')}
              </Text>
              <Text style={styles.scheduleAmount}>
                {formatCurrency(emi.emiAmount)}
              </Text>
            </View>
          ))}
          
          {emiCalculation.schedule.length > 6 && (
            <Text style={styles.scheduleMore}>
              ... and {emiCalculation.schedule.length - 6} more installments
            </Text>
          )}
        </View>
      </ScrollView>
    );
  };

  /**
   * Render confirmation step
   */
  const renderConfirmation = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepDescription}>
        Please review all details and confirm loan creation.
      </Text>

      {/* Final Summary */}
      <View style={styles.confirmationCard}>
        <Text style={styles.confirmationTitle}>Loan Creation Summary</Text>
        <Divider style={styles.confirmationDivider} />
        
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Borrower Details</Text>
          <Text style={styles.confirmationText}>
            Name: {(selectedBorrower as any)?.user?.full_name}
          </Text>
          <Text style={styles.confirmationText}>
            Email: {(selectedBorrower as any)?.user?.email}
          </Text>
          <Text style={styles.confirmationText}>
            Phone: {(selectedBorrower as any)?.user?.phone}
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Loan Details</Text>
          <Text style={styles.confirmationText}>
            Amount: {formatCurrency(Number(formData.principal_amount))}
          </Text>
          <Text style={styles.confirmationText}>
            Interest Rate: {formData.interest_rate}% per annum
          </Text>
          <Text style={styles.confirmationText}>
            Tenure: {formData.tenure_months} months
          </Text>
          {formData.purpose && (
            <Text style={styles.confirmationText}>
              Purpose: {formData.purpose}
            </Text>
          )}
        </View>

        {emiCalculation && (
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>EMI Details</Text>
            <Text style={styles.confirmationTextBold}>
              Monthly EMI: {formatCurrency(emiCalculation.emiAmount)}
            </Text>
            <Text style={styles.confirmationText}>
              Total Interest: {formatCurrency(emiCalculation.totalInterest)}
            </Text>
            <Text style={styles.confirmationTextBold}>
              Total Amount: {formatCurrency(emiCalculation.totalAmount)}
            </Text>
          </View>
        )}
      </View>

      {/* Terms and Conditions */}
      <View style={styles.termsContainer}>
        <CheckBox
          title="I agree to the terms and conditions"
          checked={termsAccepted}
          onPress={() => setTermsAccepted(!termsAccepted)}
          containerStyle={styles.termsCheckbox}
          textStyle={styles.termsText}
        />
        <TouchableOpacity style={styles.termsLink}>
          <Text style={styles.termsLinkText}>View Terms & Conditions</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  /**
   * Render current step content
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case WizardStep.SELECT_BORROWER:
        return renderBorrowerSelection();
      case WizardStep.LOAN_PARAMETERS:
        return renderLoanParameters();
      case WizardStep.EMI_PREVIEW:
        return renderEmiPreview();
      case WizardStep.CONFIRMATION:
        return renderConfirmation();
      default:
        return null;
    }
  };

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
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <Text style={styles.headerSubtitle}>
            Step {currentStep} of {WizardStep.CONFIRMATION}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Step Content */}
      <View style={styles.content}>
        {renderStepContent()}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <Button
          title="Previous"
          type="outline"
          buttonStyle={[
            styles.navButton,
            styles.previousButton,
            currentStep === WizardStep.SELECT_BORROWER && styles.navButtonDisabled
          ]}
          titleStyle={styles.previousButtonText}
          disabled={currentStep === WizardStep.SELECT_BORROWER}
          onPress={handlePrevious}
        />
        
        <Button
          title={currentStep === WizardStep.CONFIRMATION ? 'Create Loan' : 'Next'}
          buttonStyle={[styles.navButton, styles.nextButton]}
          titleStyle={styles.nextButtonText}
          loading={createLoanMutation.isPending}
          onPress={handleNext}
        />
      </View>

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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleActive: {
    backgroundColor: '#2196f3',
  },
  progressCircleInactive: {
    backgroundColor: '#e0e0e0',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressTextActive: {
    color: 'white',
  },
  progressTextInactive: {
    color: '#999',
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#2196f3',
  },
  progressLineInactive: {
    backgroundColor: '#e0e0e0',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  addBorrowerButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  borrowersList: {
    flex: 1,
  },
  borrowerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  borrowerCardSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#f3f8ff',
  },
  borrowerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  borrowerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  borrowerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  borrowerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  borrowerPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  borrowerIncome: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
    marginTop: 4,
  },
  selectedBorrowerCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  selectedBorrowerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectedBorrowerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  formContainer: {
    paddingBottom: 20,
  },
  inputContainer: {
    marginBottom: 8,
  },
  quickPreviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
  },
  quickPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  quickPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  quickPreviewLabel: {
    fontSize: 14,
    color: '#666',
  },
  quickPreviewValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
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
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  scheduleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  scheduleDivider: {
    marginBottom: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleEmiNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  scheduleDate: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  scheduleAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196f3',
    flex: 1,
    textAlign: 'right',
  },
  scheduleMore: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  confirmationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  confirmationDivider: {
    marginBottom: 16,
  },
  confirmationSection: {
    marginBottom: 16,
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
    marginBottom: 8,
  },
  confirmationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  confirmationTextBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  termsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  termsCheckbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  termsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'normal',
  },
  termsLink: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  termsLinkText: {
    fontSize: 14,
    color: '#2196f3',
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  navButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  previousButton: {
    backgroundColor: 'transparent',
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  previousButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#2196f3',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});