// src/services/loans/loanService.ts
// ENTERPRISE FIX: Complete loan data with EMIs and payments for real-time progress tracking
// This fixes the MyLoansScreen progress calculation issue

import { supabase } from '../supabase/config';
import { EMICalculationService, LoanParameters } from '../calculations/emiCalculationService';
import { 
  Loan, 
  Borrower, 
  EMI, 
  Payment, 
  LoanStatus,
  EMIStatus,
  PaymentMethod,
  ApiResponse, 
  PaginatedResponse 
} from '../../types';

export interface CreateLoanForm {
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  purpose?: string;
  collateral_details?: string;
}

export interface CreateBorrowerForm {
  user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  credit_score?: number;
  employment_type: string;
  monthly_income: number;
  lender_id: string;
}

export interface RecordPaymentForm {
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

export interface LoanFilters {
  status?: LoanStatus;
  lender_id?: string;
  borrower_id?: string;
  search?: string;
  overdue_only?: boolean;
  date_from?: string;
  date_to?: string;
}

export class LoanService {

  /**
   * Create new borrower profile
   */
  static async createBorrower(borrowerData: CreateBorrowerForm): Promise<ApiResponse<Borrower>> {
    try {
      const validation = this.validateBorrowerData(borrowerData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message || 'Invalid borrower data provided.'
        };
      }

      // Check if email/phone already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email, phone')
        .or(`email.eq.${borrowerData.email},phone.eq.${borrowerData.phone}`)
        .maybeSingle();

      if (existingUser) {
        return {
          success: false,
          error: 'Email or phone number is already registered.'
        };
      }

      let userId = borrowerData.user_id;

      // Create user if not provided
      if (!userId) {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: borrowerData.email.toLowerCase(),
            role: 'borrower',
            phone: borrowerData.phone,
            full_name: borrowerData.full_name
          })
          .select()
          .single();

        if (userError) {
          console.error('User creation error:', userError);
          return {
            success: false,
            error: 'Failed to create user account for borrower.'
          };
        }

        userId = newUser.id;

        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: userId,
            address: borrowerData.address,
            kyc_status: 'pending'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue anyway - profile is optional
        }
      }

      // Create borrower record
      const { data: newBorrower, error: borrowerError } = await supabase
        .from('borrowers')
        .insert({
          user_id: userId,
          credit_score: borrowerData.credit_score,
          employment_type: borrowerData.employment_type,
          monthly_income: borrowerData.monthly_income,
          lender_id: borrowerData.lender_id
        })
        .select(`
          *,
          user:users!borrowers_user_id_fkey(*,
            user_profiles(*)
          ),
          lender:users!borrowers_lender_id_fkey(full_name, email)
        `)
        .single();

      if (borrowerError) {
        console.error('Borrower creation error:', borrowerError);
        return {
          success: false,
          error: 'Failed to create borrower profile.'
        };
      }

      return {
        success: true,
        data: newBorrower as Borrower
      };

    } catch (error) {
      console.error('Create borrower error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while creating borrower.'
      };
    }
  }

  /**
   * Create new loan with EMI schedule generation
   */
  static async createLoan(
    loanData: CreateLoanForm,
    currentUserId: string
  ): Promise<ApiResponse<Loan>> {
    try {
      const loanParams: LoanParameters = {
        principal: loanData.principal_amount,
        annualInterestRate: loanData.interest_rate,
        tenureMonths: loanData.tenure_months
      };

      const validation = EMICalculationService.validateLoanParameters(loanParams);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid loan parameters: ${validation.errors.join(', ')}`
        };
      }

      // Check borrower exists and belongs to current lender
      const { data: borrower, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          *,
          user:users!borrowers_user_id_fkey(*)
        `)
        .eq('id', loanData.borrower_id)
        .eq('lender_id', currentUserId)
        .single();

      if (borrowerError || !borrower) {
        console.error('Borrower check error:', borrowerError);
        return {
          success: false,
          error: 'Borrower not found or not assigned to you.'
        };
      }

      // Check if borrower has any active loans
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('id')
        .eq('borrower_id', loanData.borrower_id)
        .in('status', ['active', 'pending_approval'])
        .is('deleted_at', null);

      if (activeLoans && activeLoans.length > 0) {
        return {
          success: false,
          error: 'Borrower already has an active loan. Please close existing loan first.'
        };
      }

      // Calculate EMI schedule
      const emiCalculation = EMICalculationService.calculateEMI(loanParams);

      // Generate unique loan number
      const timestamp = Date.now().toString();
      const loanNumber = `ML-${new Date().getFullYear().toString().slice(-2)}-${timestamp.slice(-6)}`;

      // Create loan record
      const { data: newLoan, error: loanError } = await supabase
        .from('loans')
        .insert({
          borrower_id: loanData.borrower_id,
          loan_number: loanNumber,
          principal_amount: loanData.principal_amount,
          interest_rate: loanData.interest_rate,
          tenure_months: loanData.tenure_months,
          status: 'active',
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
          disbursed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (loanError) {
        console.error('Loan creation error:', loanError);
        return {
          success: false,
          error: 'Failed to create loan record.'
        };
      }

      // Generate EMI schedule
      const emiInserts = emiCalculation.schedule.map(item => ({
        loan_id: newLoan.id,
        emi_number: item.emiNumber,
        due_date: item.dueDate.toISOString().split('T')[0],
        amount: item.emiAmount,
        status: 'pending' as EMIStatus
      }));

      const { error: emiError } = await supabase
        .from('emis')
        .insert(emiInserts);

      if (emiError) {
        console.error('EMI creation error:', emiError);
        // Rollback loan creation
        await supabase.from('loans').delete().eq('id', newLoan.id);
        return {
          success: false,
          error: 'Failed to generate EMI schedule.'
        };
      }

      // Get complete loan data
      const { data: completeLoan, error: fetchError } = await supabase
        .from('loans')
        .select(`
          *,
          borrower:borrowers(*,
            user:users!borrowers_user_id_fkey(*,
              user_profiles(*)
            )
          ),
          emis(*),
          payments(*)
        `)
        .eq('id', newLoan.id)
        .single();

      if (fetchError) {
        console.error('Fetch complete loan error:', fetchError);
        return {
          success: false,
          error: 'Loan created but failed to fetch complete data.'
        };
      }

      return {
        success: true,
        data: completeLoan as Loan
      };

    } catch (error) {
      console.error('Create loan error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while creating loan.'
      };
    }
  }

  /**
   * Get borrowers for a specific lender - FIXED WITH EXPLICIT FOREIGN KEYS
   */
  static async getBorrowersByLender(
    lenderId: string,
    search?: string
  ): Promise<ApiResponse<Borrower[]>> {
    try {
      // FIXED: Explicitly specify which foreign key relationship to use
      const { data, error } = await supabase
        .from('borrowers')
        .select(`
          *,
          user:users!borrowers_user_id_fkey(*,
            user_profiles(*)
          ),
          loans(id, status, principal_amount, created_at)
        `)
        .eq('lender_id', lenderId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get borrowers error:', error);
        throw error;
      }

      let result = data as Borrower[] || [];

      // Apply search filter on client side for simplicity
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        result = result.filter(borrower => {
          const user = (borrower as any).user;
          if (!user) return false;
          
          return (
            user.full_name?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.phone?.toLowerCase().includes(searchLower)
          );
        });
      }

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('Get borrowers error:', error);
      return {
        success: false,
        error: 'Failed to load borrowers list.'
      };
    }
  }

  /**
   * ENTERPRISE FIX: Get paginated loans list with COMPLETE EMI and payment data
   * This fixes the MyLoansScreen progress calculation issue
   */
  static async getLoans(
    page: number = 1,
    limit: number = 20,
    filters?: LoanFilters
  ): Promise<ApiResponse<PaginatedResponse<Loan>>> {
    try {
      let query = supabase
        .from('loans')
        .select(`
          *,
          borrower:borrowers(*,
            user:users!borrowers_user_id_fkey(full_name, email, phone,
              user_profiles(address)
            )
          ),
          emis(*),
          payments(*)
        `, { count: 'exact' })
        .is('deleted_at', null);

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.borrower_id) {
        query = query.eq('borrower_id', filters.borrower_id);
      }

      if (filters?.search) {
        query = query.ilike('loan_number', `%${filters.search}%`);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Calculate pagination
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: {
          data: data as Loan[] || [],
          count: count || 0,
          page,
          limit,
          total_pages: totalPages
        }
      };

    } catch (error) {
      console.error('Get loans error:', error);
      return {
        success: false,
        error: 'Failed to load loans list.'
      };
    }
  }

  /**
   * Record payment against loan with enhanced EMI status update
   */
  static async recordPayment(
    paymentData: RecordPaymentForm,
    recordedBy: string
  ): Promise<ApiResponse<Payment>> {
    try {
      if (paymentData.amount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be greater than zero.'
        };
      }

      // Get loan details
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('*, emis(*)')
        .eq('id', paymentData.loan_id)
        .single();

      if (loanError || !loan) {
        return {
          success: false,
          error: 'Loan not found.'
        };
      }

      if (loan.status !== 'active') {
        return {
          success: false,
          error: 'Cannot record payment for inactive loan.'
        };
      }

      // Record payment
      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          loan_id: paymentData.loan_id,
          amount: paymentData.amount,
          payment_date: paymentData.payment_date,
          payment_method: paymentData.payment_method,
          reference_number: paymentData.reference_number,
          notes: paymentData.notes,
          recorded_by: recordedBy
        })
        .select()
        .single();

      if (paymentError) {
        return {
          success: false,
          error: 'Failed to record payment.'
        };
      }

      // Update EMI status based on all payments
      await this.updateEMIStatus(paymentData.loan_id);

      return {
        success: true,
        data: newPayment as Payment
      };

    } catch (error) {
      console.error('Record payment error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while recording payment.'
      };
    }
  }

  /**
   * Get loan details with complete information
   */
  static async getLoanDetails(loanId: string): Promise<ApiResponse<Loan>> {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          borrower:borrowers(*,
            user:users!borrowers_user_id_fkey(*,
              user_profiles(*)
            )
          ),
          emis(*),
          payments(*,
            recorded_by_user:users!payments_recorded_by_fkey(full_name)
          )
        `)
        .eq('id', loanId)
        .single();

      if (error) {
        return {
          success: false,
          error: 'Loan not found.'
        };
      }

      return {
        success: true,
        data: data as Loan
      };

    } catch (error) {
      console.error('Get loan details error:', error);
      return {
        success: false,
        error: 'Failed to load loan details.'
      };
    }
  }

  /**
   * ENHANCED EMI STATUS UPDATE: Properly allocates payments to EMIs in chronological order
   */
  private static async updateEMIStatus(loanId: string): Promise<void> {
    try {
      // Get all payments for this loan
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: true });

      // Get all EMIs for this loan in order
      const { data: emis } = await supabase
        .from('emis')
        .select('*')
        .eq('loan_id', loanId)
        .order('emi_number', { ascending: true });

      if (!emis || !payments) return;

      // Calculate total amount paid
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      
      let remainingAmount = totalPaid;
      const today = new Date().toISOString().split('T')[0];

      // Allocate payments to EMIs in chronological order
      for (const emi of emis) {
        let newStatus: EMIStatus = 'pending';
        let paidAmount = 0;
        let paidDate = null;

        if (remainingAmount >= emi.amount) {
          // Full EMI paid
          newStatus = 'paid';
          paidAmount = emi.amount;
          paidDate = today;
          remainingAmount -= emi.amount;
        } else if (remainingAmount > 0) {
          // Partial payment
          newStatus = 'partially_paid';
          paidAmount = remainingAmount;
          remainingAmount = 0;
        } else if (emi.due_date < today) {
          // No payment but overdue
          newStatus = 'overdue';
          paidAmount = 0;
        } else {
          // Pending (not due yet)
          newStatus = 'pending';
          paidAmount = 0;
        }

        // Update EMI record
        await supabase
          .from('emis')
          .update({
            status: newStatus,
            paid_amount: paidAmount,
            paid_date: paidDate
          })
          .eq('id', emi.id);
      }

      // Check if loan is fully paid
      if (remainingAmount === 0 && totalPaid > 0) {
        const allEMIsPaid = emis.every(emi => emi.amount <= (emi.paid_amount || 0));
        
        if (allEMIsPaid) {
          await supabase
            .from('loans')
            .update({ status: 'completed' })
            .eq('id', loanId);
        }
      }

    } catch (error) {
      console.error('Update EMI status error:', error);
    }
  }

  /**
   * Validate borrower data
   */
  private static validateBorrowerData(borrowerData: CreateBorrowerForm): {
    isValid: boolean;
    message?: string;
  } {
    if (!borrowerData.full_name?.trim()) {
      return { isValid: false, message: 'Full name is required.' };
    }

    if (!borrowerData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(borrowerData.email)) {
      return { isValid: false, message: 'Valid email address is required.' };
    }

    if (!borrowerData.phone || !/^\+?[\d\s\-\(\)]{10,}$/.test(borrowerData.phone)) {
      return { isValid: false, message: 'Valid phone number is required.' };
    }

    if (!borrowerData.address?.trim()) {
      return { isValid: false, message: 'Address is required.' };
    }

    if (!borrowerData.employment_type?.trim()) {
      return { isValid: false, message: 'Employment type is required.' };
    }

    if (!borrowerData.monthly_income || borrowerData.monthly_income <= 0) {
      return { isValid: false, message: 'Valid monthly income is required.' };
    }

    if (!borrowerData.lender_id) {
      return { isValid: false, message: 'Lender ID is required.' };
    }

    return { isValid: true };
  }
}