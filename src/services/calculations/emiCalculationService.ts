// src/services/calculations/emiCalculationService.ts
// Enterprise-grade EMI calculation engine with comprehensive loan mathematics
// Handles all loan calculation scenarios with precision and validation

export interface LoanParameters {
    principal: number;
    annualInterestRate: number;
    tenureMonths: number;
  }
  
  export interface EMICalculationResult {
    emiAmount: number;
    totalAmount: number;
    totalInterest: number;
    schedule: EMIScheduleItem[];
    summary: LoanSummary;
  }
  
  export interface EMIScheduleItem {
    emiNumber: number;
    dueDate: Date;
    emiAmount: number;
    principalComponent: number;
    interestComponent: number;
    outstandingPrincipal: number;
  }
  
  export interface LoanSummary {
    principal: number;
    totalInterest: number;
    totalAmount: number;
    monthlyEMI: number;
    effectiveInterestRate: number;
    tenureMonths: number;
  }
  
  export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }
  
  export class EMICalculationService {
  
    // Business validation constants
    private static readonly MIN_PRINCIPAL = 1000; // Minimum loan amount
    private static readonly MAX_PRINCIPAL = 10000000; // Maximum loan amount (1 Crore)
    private static readonly MIN_INTEREST_RATE = 0.1; // Minimum 0.1% annual
    private static readonly MAX_INTEREST_RATE = 36; // Maximum 36% annual (regulatory limit)
    private static readonly MIN_TENURE = 1; // Minimum 1 month
    private static readonly MAX_TENURE = 360; // Maximum 30 years
  
    /**
     * Calculate EMI and generate complete loan schedule
     * @param params Loan parameters
     * @param startDate Loan start date (default: today)
     * @returns Complete EMI calculation result
     */
    static calculateEMI(
      params: LoanParameters, 
      startDate: Date = new Date()
    ): EMICalculationResult {
      
      // Validate parameters
      const validation = this.validateLoanParameters(params);
      if (!validation.isValid) {
        throw new Error(`Invalid loan parameters: ${validation.errors.join(', ')}`);
      }
  
      const { principal, annualInterestRate, tenureMonths } = params;
      
      // Convert annual rate to monthly rate
      const monthlyRate = annualInterestRate / (12 * 100);
      
      // Calculate EMI using standard formula: P * r * (1+r)^n / ((1+r)^n - 1)
      let emiAmount: number;
      
      if (monthlyRate === 0) {
        // Handle zero interest case
        emiAmount = principal / tenureMonths;
      } else {
        const factor = Math.pow(1 + monthlyRate, tenureMonths);
        emiAmount = (principal * monthlyRate * factor) / (factor - 1);
      }
  
      // Round EMI to 2 decimal places
      emiAmount = Math.round(emiAmount * 100) / 100;
      
      // Generate EMI schedule
      const schedule = this.generateEMISchedule(
        principal,
        emiAmount,
        monthlyRate,
        tenureMonths,
        startDate
      );
  
      // Calculate totals from schedule for accuracy
      const totalAmount = schedule.reduce((sum, item) => sum + item.emiAmount, 0);
      const totalInterest = totalAmount - principal;
  
      // Create summary
      const summary: LoanSummary = {
        principal,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        monthlyEMI: emiAmount,
        effectiveInterestRate: this.calculateEffectiveRate(principal, totalInterest, tenureMonths),
        tenureMonths
      };
  
      return {
        emiAmount,
        totalAmount: summary.totalAmount,
        totalInterest: summary.totalInterest,
        schedule,
        summary
      };
    }
  
    /**
     * Generate detailed EMI schedule with principal/interest breakdown
     * @param principal Loan principal
     * @param emiAmount Monthly EMI
     * @param monthlyRate Monthly interest rate
     * @param tenureMonths Loan tenure
     * @param startDate Loan start date
     * @returns Array of EMI schedule items
     */
    private static generateEMISchedule(
      principal: number,
      emiAmount: number,
      monthlyRate: number,
      tenureMonths: number,
      startDate: Date
    ): EMIScheduleItem[] {
      
      const schedule: EMIScheduleItem[] = [];
      let outstandingPrincipal = principal;
      
      for (let i = 1; i <= tenureMonths; i++) {
        // Calculate interest component for this month
        const interestComponent = outstandingPrincipal * monthlyRate;
        
        // Calculate principal component
        let principalComponent = emiAmount - interestComponent;
        
        // Handle last EMI - adjust for rounding differences
        if (i === tenureMonths) {
          principalComponent = outstandingPrincipal;
          const adjustedEMI = principalComponent + interestComponent;
          
          schedule.push({
            emiNumber: i,
            dueDate: this.addMonths(startDate, i),
            emiAmount: Math.round(adjustedEMI * 100) / 100,
            principalComponent: Math.round(principalComponent * 100) / 100,
            interestComponent: Math.round(interestComponent * 100) / 100,
            outstandingPrincipal: 0
          });
          
          break;
        }
        
        // Update outstanding principal
        outstandingPrincipal -= principalComponent;
        
        schedule.push({
          emiNumber: i,
          dueDate: this.addMonths(startDate, i),
          emiAmount: emiAmount,
          principalComponent: Math.round(principalComponent * 100) / 100,
          interestComponent: Math.round(interestComponent * 100) / 100,
          outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100
        });
      }
      
      return schedule;
    }
  
    /**
     * Calculate effective annual interest rate
     * @param principal Loan principal
     * @param totalInterest Total interest paid
     * @param tenureMonths Loan tenure in months
     * @returns Effective annual interest rate
     */
    private static calculateEffectiveRate(
      principal: number, 
      totalInterest: number, 
      tenureMonths: number
    ): number {
      const totalAmount = principal + totalInterest;
      const tenureYears = tenureMonths / 12;
      const effectiveRate = ((totalAmount / principal) ** (1 / tenureYears) - 1) * 100;
      return Math.round(effectiveRate * 100) / 100;
    }
  
    /**
     * Calculate loan affordability based on income
     * @param monthlyIncome Borrower's monthly income
     * @param existingEMIs Existing EMI obligations
     * @param foir Fixed Obligation to Income Ratio (default: 40%)
     * @returns Maximum affordable EMI amount
     */
    static calculateAffordability(
      monthlyIncome: number,
      existingEMIs: number = 0,
      foir: number = 0.4
    ): number {
      const maxTotalEMI = monthlyIncome * foir;
      const availableForNewEMI = maxTotalEMI - existingEMIs;
      return Math.max(0, Math.round(availableForNewEMI * 100) / 100);
    }
  
    /**
     * Calculate maximum loan amount based on affordability
     * @param affordableEMI Maximum affordable EMI
     * @param annualInterestRate Annual interest rate
     * @param tenureMonths Desired tenure
     * @returns Maximum loan amount
     */
    static calculateMaxLoanAmount(
      affordableEMI: number,
      annualInterestRate: number,
      tenureMonths: number
    ): number {
      const monthlyRate = annualInterestRate / (12 * 100);
      
      if (monthlyRate === 0) {
        return affordableEMI * tenureMonths;
      }
      
      const factor = Math.pow(1 + monthlyRate, tenureMonths);
      const maxPrincipal = (affordableEMI * (factor - 1)) / (monthlyRate * factor);
      
      return Math.round(maxPrincipal * 100) / 100;
    }
  
    /**
     * Calculate prepayment scenarios
     * @param currentSchedule Current EMI schedule
     * @param prepaymentAmount Prepayment amount
     * @param prepaymentMonth Month of prepayment
     * @returns Updated schedule after prepayment
     */
    static calculatePrepayment(
      currentSchedule: EMIScheduleItem[],
      prepaymentAmount: number,
      prepaymentMonth: number
    ): EMIScheduleItem[] {
      if (prepaymentMonth <= 0 || prepaymentMonth > currentSchedule.length) {
        throw new Error('Invalid prepayment month');
      }
  
      const newSchedule = [...currentSchedule];
      const prepaymentIndex = prepaymentMonth - 1;
      
      // Reduce outstanding principal from prepayment month
      let outstandingReduction = prepaymentAmount;
      
      for (let i = prepaymentIndex; i < newSchedule.length; i++) {
        const item = newSchedule[i];
        
        if (outstandingReduction >= item.outstandingPrincipal) {
          // Loan can be closed early
          outstandingReduction -= item.outstandingPrincipal;
          newSchedule.splice(i); // Remove remaining EMIs
          break;
        } else {
          // Reduce outstanding principal
          item.outstandingPrincipal -= outstandingReduction;
          item.outstandingPrincipal = Math.round(item.outstandingPrincipal * 100) / 100;
          outstandingReduction = 0;
          
          // Recalculate subsequent EMIs if needed
          // For simplicity, keeping same EMI amount but tenure will reduce
        }
      }
      
      return newSchedule;
    }
  
    /**
     * Validate loan parameters against business rules
     * @param params Loan parameters to validate
     * @returns Validation result with errors and warnings
     */
    static validateLoanParameters(params: LoanParameters): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];
  
      // Principal validation
      if (!params.principal || params.principal <= 0) {
        errors.push('Principal amount must be greater than zero');
      } else if (params.principal < this.MIN_PRINCIPAL) {
        errors.push(`Principal amount must be at least ₹${this.MIN_PRINCIPAL.toLocaleString()}`);
      } else if (params.principal > this.MAX_PRINCIPAL) {
        errors.push(`Principal amount cannot exceed ₹${this.MAX_PRINCIPAL.toLocaleString()}`);
      }
  
      // Interest rate validation
      if (!params.annualInterestRate || params.annualInterestRate < 0) {
        errors.push('Interest rate must be non-negative');
      } else if (params.annualInterestRate < this.MIN_INTEREST_RATE) {
        warnings.push(`Interest rate is very low (${params.annualInterestRate}%). Please verify.`);
      } else if (params.annualInterestRate > this.MAX_INTEREST_RATE) {
        errors.push(`Interest rate cannot exceed ${this.MAX_INTEREST_RATE}% (regulatory limit)`);
      }
  
      // Tenure validation
      if (!params.tenureMonths || params.tenureMonths <= 0) {
        errors.push('Tenure must be greater than zero');
      } else if (params.tenureMonths < this.MIN_TENURE) {
        errors.push(`Minimum tenure is ${this.MIN_TENURE} month`);
      } else if (params.tenureMonths > this.MAX_TENURE) {
        errors.push(`Maximum tenure is ${this.MAX_TENURE} months (30 years)`);
      }
  
      // Business logic warnings
      if (params.principal && params.annualInterestRate && params.tenureMonths) {
        const monthlyRate = params.annualInterestRate / (12 * 100);
        if (monthlyRate > 0) {
          const factor = Math.pow(1 + monthlyRate, params.tenureMonths);
          const emi = (params.principal * monthlyRate * factor) / (factor - 1);
          const totalInterest = (emi * params.tenureMonths) - params.principal;
          const interestRatio = totalInterest / params.principal;
  
          if (interestRatio > 1) {
            warnings.push('Total interest exceeds principal amount. Consider reducing tenure or rate.');
          }
        }
      }
  
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    }
  
    /**
     * Generate loan number with business logic
     * @param lenderCode Lender identifier
     * @param branchCode Branch identifier (optional)
     * @returns Formatted loan number
     */
    static generateLoanNumber(lenderCode: string = 'ML', branchCode?: string): string {
      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
      
      const parts = [lenderCode, year, month];
      if (branchCode) {
        parts.push(branchCode);
      }
      parts.push(random);
      
      return parts.join('-');
    }
  
    /**
     * Utility function to add months to a date
     * @param date Base date
     * @param months Number of months to add
     * @returns New date with months added
     */
    private static addMonths(date: Date, months: number): Date {
      const result = new Date(date);
      result.setMonth(result.getMonth() + months);
      
      // Handle edge cases like January 31 + 1 month = February 28/29
      if (result.getDate() !== date.getDate()) {
        result.setDate(0); // Set to last day of previous month
      }
      
      return result;
    }
  
    /**
     * Calculate reducing balance interest for a specific period
     * @param principal Outstanding principal
     * @param annualRate Annual interest rate
     * @param days Number of days
     * @returns Interest amount for the period
     */
    static calculatePeriodicInterest(
      principal: number,
      annualRate: number,
      days: number
    ): number {
      const dailyRate = annualRate / (365 * 100);
      const interest = principal * dailyRate * days;
      return Math.round(interest * 100) / 100;
    }
  
    /**
     * Calculate penalty interest for overdue amounts
     * @param overdueAmount Overdue principal/EMI amount
     * @param penaltyRate Penalty interest rate (annual)
     * @param overdueDays Number of overdue days
     * @returns Penalty interest amount
     */
    static calculatePenaltyInterest(
      overdueAmount: number,
      penaltyRate: number,
      overdueDays: number
    ): number {
      return this.calculatePeriodicInterest(overdueAmount, penaltyRate, overdueDays);
    }
  }