// src/utils/formatters.ts
// Utility functions for formatting data consistently across the app

/**
 * Format currency values consistently across the app
 * @param amount Numeric amount to format
 * @param currency Currency code (default: INR)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  /**
   * Format dates consistently across the app
   * @param date Date string or Date object
   * @param format Format type ('short', 'medium', 'long')
   * @returns Formatted date string
   */
  export const formatDate = (
    date: string | Date, 
    format: 'short' | 'medium' | 'long' = 'medium'
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    let options: Intl.DateTimeFormatOptions;
    
    if (format === 'short') {
      options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    } else if (format === 'medium') {
      options = { day: '2-digit', month: 'short', year: 'numeric' };
    } else {
      options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    }
  
    return new Intl.DateTimeFormat('en-IN', options).format(dateObj);
  };
  
  /**
   * Calculate days between two dates
   * @param startDate Start date
   * @param endDate End date
   * @returns Number of days
   */
  export const calculateDaysBetween = (startDate: Date, endDate: Date): number => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  /**
   * Generate professional color based on status
   * @param status Status string
   * @returns Color scheme name
   */
  export const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      // Loan statuses
      'active': 'success',
      'pending_approval': 'warning',
      'completed': 'primary',
      'defaulted': 'error',
      
      // EMI statuses
      'paid': 'success',
      'pending': 'warning',
      'overdue': 'error',
      'partially_paid': 'warning',
      
      // KYC statuses
      'verified': 'success',
      'rejected': 'error',
    };
  
    return statusColors[status] || 'gray';
  };
  
  /**
   * Format phone number for display
   * @param phone Phone number string
   * @returns Formatted phone number
   */
  export const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    
    return phone; // Return original if no formatting applies
  };
  
  /**
   * Format percentage for display
   * @param value Numeric value
   * @param decimals Number of decimal places
   * @returns Formatted percentage string
   */
  export const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}%`;
  };
  
  /**
   * Truncate text with ellipsis
   * @param text Text to truncate
   * @param maxLength Maximum length
   * @returns Truncated text
   */
  export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };
  
  /**
   * Format file size for display
   * @param bytes File size in bytes
   * @returns Formatted file size string
   */
  export const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(1)} ${sizes[i]}`;
  };