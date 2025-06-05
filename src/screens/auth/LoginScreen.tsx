// src/screens/auth/LoginScreen.tsx
// FIXED - Professional login screen with safe area handling for all devices
// Enterprise-grade authentication with proper iPhone support

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
} from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthService } from '../../services/auth/authService';
import { LoginForm } from '../../types';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  // Form state management
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  
  // UI state management
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertType, setAlertType] = useState<'error' | 'success' | 'info'>('error');

  /**
   * Validate form data before submission
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<LoginForm> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!AuthService.isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission with verification checks
   */
  const handleLogin = async () => {
    // Clear previous alerts
    setAlertMessage('');
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.signIn(formData.email, formData.password);

      if (result.success && result.data) {
        // Success! Navigation will be handled by App.tsx auth state change
        setAlertType('success');
        setAlertMessage(`Welcome back, ${result.data.full_name}!`);
      } else {
        setAlertType('error');
        const errorMessage = result.error || 'Login failed. Please try again.';
        setAlertMessage(errorMessage);

        // Handle specific verification-related errors
        if (errorMessage.includes('Email not verified')) {
          setTimeout(() => {
            navigation.navigate('EmailVerificationPending', {
              email: formData.email,
              role: 'borrower', // Default, will be updated by the screen
              fullName: 'User'
            });
          }, 2000);
        } else if (errorMessage.includes('pending admin approval')) {
          // Show additional help for pending approval
          setTimeout(() => {
            setAlertType('info');
            setAlertMessage('Your Loan Officer account is pending admin approval. You will receive an email once approved.');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setAlertType('error');
      setAlertMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update form field value
   */
  const updateField = (field: keyof LoginForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
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
        >
          <View style={styles.content}>
            
            {/* Header Section */}
            <View style={styles.header}>
              <Avatar
                size="large"
                rounded
                overlayContainerStyle={{ backgroundColor: '#2196f3' }}
                icon={{ name: 'business', type: 'ionicon', color: 'white' }}
                containerStyle={styles.avatar}
              />
              
              <Text style={styles.title}>
                MicroLoan Manager
              </Text>
              <Text style={styles.subtitle}>
                Professional loan management platform
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

              {/* Email Input */}
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

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password *</Text>
                <Input
                  placeholder="Enter your password"
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

              {/* Forgot Password Link */}
              <View style={styles.forgotPasswordContainer}>
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.linkText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                buttonStyle={styles.loginButton}
                titleStyle={styles.loginButtonText}
              />

              {/* Demo Credentials Info
              <View style={styles.demoCard}>
                <Text style={styles.demoTitle}>Demo Credentials</Text>
                <Text style={styles.demoText}>Email: aarje2050@gmail.com</Text>
                <Text style={styles.demoText}>Password: Rajesh@321</Text>
              </View> */}

              {/* Register Link */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Secure • Professional • Reliable
              </Text>
            </View>
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
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
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
    flex: 1,
  },
  alertCard: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  demoCard: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    marginBottom: 32,
    padding: 16,
    borderRadius: 8,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 12,
    color: '#1976d2',
    marginBottom: 2,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});