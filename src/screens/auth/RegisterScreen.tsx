// src/screens/auth/RegisterScreen.tsx
// Enterprise-grade registration system with role-based approval workflow
// Allows borrower self-registration with admin approval for lenders

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Input,
  Button,
  Avatar,
  Divider,
  ButtonGroup,
} from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserService } from '../../services/users/userService';
import { RegisterForm, UserRole } from '../../types';

interface RegistrationForm extends RegisterForm {
  address: string;
  employment_type: string;
  monthly_income: string;
}

const USER_ROLES = [
  { label: 'Borrower', value: 'borrower' as UserRole },
  { label: 'Loan Officer', value: 'lender' as UserRole },
];

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  // Form state management
  const [formData, setFormData] = useState<RegistrationForm>({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: 'borrower',
    address: '',
    employment_type: '',
    monthly_income: '',
  });
  
  // UI state management
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<RegistrationForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertType, setAlertType] = useState<'error' | 'success' | 'info'>('error');
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);

  /**
   * Validate form data before submission
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<RegistrationForm> = {};

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Address validation
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    // Role-specific validation
    if (formData.role === 'borrower') {
      if (!formData.employment_type.trim()) {
        newErrors.employment_type = 'Employment type is required for borrowers';
      }
      if (!formData.monthly_income.trim()) {
        newErrors.monthly_income = 'Monthly income is required for borrowers';
      } else if (isNaN(Number(formData.monthly_income)) || Number(formData.monthly_income) <= 0) {
        newErrors.monthly_income = 'Please enter a valid monthly income';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleRegister = async () => {
    setAlertMessage('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Prepare registration data
      const registrationData = {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        address: formData.address.trim(),
      };

      const result = await UserService.createUser(registrationData);

      if (result.success) {
        setAlertType('success');
        if (formData.role === 'lender') {
          setAlertMessage(
            'Registration submitted successfully! Please check your email to verify your account. After verification, your account will be pending admin approval.'
          );
        } else {
          setAlertMessage(
            'Account created successfully! Please check your email to verify your account before signing in.'
          );
        }
        
        // Navigate to email verification pending screen
        setTimeout(() => {
          navigation.navigate('EmailVerificationPending', {
            email: formData.email,
            role: formData.role,
            fullName: formData.full_name
          });
        }, 2000);
      } else {
        setAlertType('error');
        setAlertMessage(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setAlertType('error');
      setAlertMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update form field value
   */
  const updateField = (field: keyof RegistrationForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  /**
   * Handle role selection
   */
  const handleRoleSelection = (selectedIndex: number) => {
    setSelectedRoleIndex(selectedIndex);
    const selectedRole = USER_ROLES[selectedIndex].value;
    setFormData(prev => ({ ...prev, role: selectedRole }));
    
    // Clear role-specific errors
    setErrors(prev => ({
      ...prev,
      employment_type: undefined,
      monthly_income: undefined,
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          
          {/* Header Section */}
          <View style={styles.header}>
            <Avatar
              size="large"
              rounded
              overlayContainerStyle={{ backgroundColor: '#4caf50' }}
              icon={{ name: 'person-add', type: 'ionicon', color: 'white' }}
              containerStyle={styles.avatar}
            />
            
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join our professional loan management platform
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Form Section */}
          <View style={styles.formContainer}>
            
            {/* Alert Message */}
            {alertMessage ? (
              <View style={[
                styles.alertCard,
                { backgroundColor: alertType === 'error' ? '#ffebee' : alertType === 'success' ? '#e8f5e8' : '#e3f2fd' }
              ]}>
                <Ionicons 
                  name={alertType === 'error' ? 'alert-circle' : alertType === 'success' ? 'checkmark-circle' : 'information-circle'} 
                  size={20} 
                  color={alertType === 'error' ? '#f44336' : alertType === 'success' ? '#4caf50' : '#2196f3'} 
                />
                <Text style={[
                  styles.alertText,
                  { color: alertType === 'error' ? '#d32f2f' : alertType === 'success' ? '#2e7d32' : '#1976d2' }
                ]}>
                  {alertMessage}
                </Text>
              </View>
            ) : null}

            {/* Role Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Account Type *</Text>
              <ButtonGroup
                onPress={handleRoleSelection}
                selectedIndex={selectedRoleIndex}
                buttons={USER_ROLES.map(role => role.label)}
                containerStyle={styles.buttonGroup}
                selectedButtonStyle={styles.selectedButton}
                textStyle={styles.buttonText}
              />
              {formData.role === 'lender' && (
                <Text style={styles.helperText}>
                  Loan Officer accounts require admin approval
                </Text>
              )}
            </View>

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <Input
                placeholder="Enter your full name"
                value={formData.full_name}
                onChangeText={(value) => updateField('full_name', value)}
                autoCapitalize="words"
                leftIcon={<Ionicons name="person" size={20} color="#9CA3AF" />}
                containerStyle={styles.input}
                errorMessage={errors.full_name}
              />
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <Input
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Ionicons name="mail" size={20} color="#9CA3AF" />}
                containerStyle={styles.input}
                errorMessage={errors.email}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <Input
                placeholder="Enter your phone number"
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call" size={20} color="#9CA3AF" />}
                containerStyle={styles.input}
                errorMessage={errors.phone}
              />
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Address *</Text>
              <Input
                placeholder="Enter your complete address"
                value={formData.address}
                onChangeText={(value) => updateField('address', value)}
                multiline
                leftIcon={<Ionicons name="location" size={20} color="#9CA3AF" />}
                containerStyle={styles.input}
                errorMessage={errors.address}
              />
            </View>

            {/* Borrower-specific fields */}
            {formData.role === 'borrower' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Employment Type *</Text>
                  <Input
                    placeholder="e.g., Full-time, Part-time, Self-employed"
                    value={formData.employment_type}
                    onChangeText={(value) => updateField('employment_type', value)}
                    leftIcon={<Ionicons name="briefcase" size={20} color="#9CA3AF" />}
                    containerStyle={styles.input}
                    errorMessage={errors.employment_type}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Monthly Income (₹) *</Text>
                  <Input
                    placeholder="Enter your monthly income"
                    value={formData.monthly_income}
                    onChangeText={(value) => updateField('monthly_income', value)}
                    keyboardType="numeric"
                    leftIcon={<Ionicons name="cash" size={20} color="#9CA3AF" />}
                    containerStyle={styles.input}
                    errorMessage={errors.monthly_income}
                  />
                </View>
              </>
            )}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password *</Text>
              <Input
                placeholder="Create a strong password"
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Ionicons name="lock-closed" size={20} color="#9CA3AF" />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                }
                containerStyle={styles.input}
                errorMessage={errors.password}
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <Input
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Ionicons name="shield-checkmark" size={20} color="#9CA3AF" />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                }
                containerStyle={styles.input}
                errorMessage={errors.confirmPassword}
              />
            </View>

            {/* Register Button */}
            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              buttonStyle={styles.registerButton}
              titleStyle={styles.registerButtonText}
            />

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By creating an account, you agree to our Terms of Service
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  avatar: {
    marginBottom: 16,
  },
  title: {
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  divider: {
    marginBottom: 24,
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  alertCard: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginLeft: 10,
  },
  input: {
    paddingHorizontal: 0,
  },
  buttonGroup: {
    borderRadius: 8,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  selectedButton: {
    backgroundColor: '#2196f3',
  },
  buttonText: {
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    color: '#ff9800',
    marginLeft: 10,
    fontStyle: 'italic',
  },
  registerButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 24,
    marginTop: 8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  linkText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});