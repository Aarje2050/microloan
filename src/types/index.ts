// src/types/index.ts
// Core type definitions for the microloan application
// This file contains all TypeScript interfaces and types used across the app

export type UserRole = 'super_admin' | 'lender' | 'borrower';

export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'pending_approval';

export type EMIStatus = 'pending' | 'paid' | 'overdue' | 'partially_paid';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque';

export type DocumentType = 'aadhar' | 'pan' | 'salary_slip' | 'bank_statement' | 'photo';

export type KYCStatus = 'pending' | 'verified' | 'rejected';

// Database table interfaces matching our SQL schema
export interface User {
  id: string;
  email: string;
  role: UserRole;
  phone: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  active?: boolean;
email_verified?: boolean;
pending_approval?: boolean;
verification_token?: string;
verification_expires_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  avatar_url?: string;
  address?: string;
  kyc_status: KYCStatus;
  created_at: string;
  updated_at: string;
}

export interface Borrower {
  id: string;
  user_id: string;
  credit_score?: number;
  employment_type?: string;
  monthly_income?: number;
  lender_id: string; // Which lender manages this borrower
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Relations
  user?: User;
  user_profile?: UserProfile;
  lender?: User;
}

export interface Loan {
  id: string;
  borrower_id: string;
  loan_number: string; // Unique loan identifier
  principal_amount: number;
  interest_rate: number; // Annual interest rate percentage
  tenure_months: number;
  status: LoanStatus;
  approved_by?: string; // lender_id who approved
  approved_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Relations
  borrower?: Borrower;
  emis?: EMI[];
  payments?: Payment[];
}

export interface EMI {
  id: string;
  loan_id: string;
  emi_number: number; // 1, 2, 3... sequence
  due_date: string;
  amount: number;
  status: EMIStatus;
  paid_date?: string;
  paid_amount?: number;
  created_at: string;
  updated_at: string;
  // Relations
  loan?: Loan;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string; // Transaction ID, cheque number, etc.
  notes?: string;
  recorded_by: string; // user_id who recorded this payment
  created_at: string;
  updated_at: string;
  // Relations
  loan?: Loan;
  recorded_by_user?: User;
}

export interface Document {
  id: string;
  borrower_id: string;
  document_type: DocumentType;
  file_url: string;
  verification_status: KYCStatus;
  verified_by?: string; // lender_id who verified
  verified_at?: string;
  created_at: string;
  updated_at: string;
  // Relations
  borrower?: Borrower;
}

// Form interfaces for input validation
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  phone: string;
  role: UserRole;
}

export interface CreateLoanForm {
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
}

export interface RecordPaymentForm {
  loan_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Navigation types for type-safe navigation
export type RootStackParamList = {
  Auth: undefined;
  SuperAdminTabs: undefined;
  LenderStack: undefined; // CHANGED: from LenderTabs to LenderStack
  BorrowerTabs: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  EmailVerificationPending: {
    email: string;
    role: UserRole;
    fullName: string;
  };
};

export type SuperAdminTabParamList = {
  Dashboard: undefined;
  ManageLenders: undefined;
  AllLoans: undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type LenderTabParamList = {
  Dashboard: undefined;
  MyBorrowers: undefined;
  MyLoans: undefined;
  Profile: undefined;

};

export type BorrowerTabParamList = {
  Dashboard: undefined;
  MyLoans: undefined;
  Payments: undefined;
  Documents: undefined;
  Profile: undefined;
};

// ADD THIS TO YOUR EXISTING types/index.ts file
// Add this after the existing BorrowerTabParamList definition

// ADD THIS TO YOUR EXISTING types/index.ts file
// Add this after the existing BorrowerTabParamList definition

export type BorrowerStackParamList = {
  BorrowerTabs: undefined;
  PaymentHistory: undefined;
  EMISchedule: { loanId?: string };
  MakePayment: { 
    emiId?: string; 
    loanId?: string;
    // Placeholder props - FIXED: Using 'subtitle' to match PlaceholderScreenProps
    title?: string;
    subtitle?: string;
    icon?: string;
  };
  LoanDetails: { 
    loanId: string;
    // Placeholder props - FIXED: Using 'subtitle' to match PlaceholderScreenProps
    title?: string;
    subtitle?: string;
    icon?: string;
  };
  DocumentUpload: { 
    documentType?: DocumentType;
    // Placeholder props - FIXED: Using 'subtitle' to match PlaceholderScreenProps
    title?: string;
    subtitle?: string;
    icon?: string;
  };
  DocumentViewer: { 
    documentId: string;
    // Placeholder props - FIXED: Using 'subtitle' to match PlaceholderScreenProps
    title?: string;
    subtitle?: string;
    icon?: string;
  };
};

// Utility types for common patterns
export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;

// Hook return types
export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<ApiResponse<User>>;
  signUp: (data: RegisterForm) => Promise<ApiResponse<User>>;
  signOut: () => Promise<void>;
  updateProfile: (data: UpdateInput<User>) => Promise<ApiResponse<User>>;
}

// Analytics interfaces for super admin
export interface LoanAnalytics {
  total_loans: number;
  active_loans: number;
  total_amount_disbursed: number;
  total_amount_collected: number;
  default_rate: number;
  average_ticket_size: number;
}

export interface LenderPerformance {
  lender: User;
  total_borrowers: number;
  total_loans: number;
  collection_rate: number;
  default_rate: number;
}

// Dashboard data interfaces
export interface SuperAdminDashboard {
  analytics: LoanAnalytics;
  recent_loans: Loan[];
  top_lenders: LenderPerformance[];
  overdue_summary: {
    count: number;
    amount: number;
  };
}

export interface LenderDashboard {
  my_borrowers_count: number;
  active_loans_count: number;
  pending_collections: number;
  overdue_emis: EMI[];
  recent_payments: Payment[];
}

export interface BorrowerDashboard {
  active_loans: Loan[];
  next_emi: EMI | null;
  payment_history: Payment[];
  total_outstanding: number;
}

export type LenderStackParamList = {
  LenderTabs: undefined;
  CreateLoanWizard: { borrowerId?: string };
  RecordPayment: { loanId?: string }; // NEW: Payment recording route
  EMIManagement: undefined; // NEW: EMI management route


};

