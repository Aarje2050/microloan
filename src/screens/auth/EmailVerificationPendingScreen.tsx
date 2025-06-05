// src/screens/auth/EmailVerificationPendingScreen.tsx
// Professional email verification pending screen
// Shows verification status and allows resending emails

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { Button, Avatar } from 'react-native-elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthService } from '../../services/auth/authService';
import { UserRole } from '../../types';

type EmailVerificationRouteProp = RouteProp<{
  EmailVerificationPending: {
    email: string;
    role: UserRole;
    fullName: string;
  };
}, 'EmailVerificationPending'>;

export const EmailVerificationPendingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<EmailVerificationRouteProp>();
  
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const { email, role, fullName } = route.params || {};

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  /**
   * Handle resend verification email
   */
  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address not found. Please register again.');
      return;
    }

    setIsResending(true);
    setMessage('');

    try {
      const result = await AuthService.resendVerificationEmail(email);

      if (result.success) {
        setMessageType('success');
        setMessage('Verification email sent successfully! Please check your inbox.');
        setResendCooldown(60); // 60 seconds cooldown
      } else {
        setMessageType('error');
        setMessage(result.error || 'Failed to send verification email');
      }
    } catch (error) {
      setMessageType('error');
      setMessage('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  /**
   * Go back to login
   */
  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  /**
   * Get role-specific message
   */
  const getRoleMessage = () => {
    switch (role) {
      case 'borrower':
        return 'Once verified, you can immediately sign in and start applying for loans.';
      case 'lender':
        return 'After email verification, your account will be pending admin approval. You will receive another email once approved.';
      default:
        return 'Once verified, you can sign in to your account.';
    }
  };

  /**
   * Get role-specific icon
   */
  const getRoleIcon = () => {
    switch (role) {
      case 'borrower':
        return { name: 'person', color: '#4caf50' };
      case 'lender':
        return { name: 'briefcase', color: '#2196f3' };
      default:
        return { name: 'mail', color: '#ff9800' };
    }
  };

  const roleIcon = getRoleIcon();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        
        {/* Icon */}
        <Avatar
          size="large"
          rounded
          overlayContainerStyle={{ backgroundColor: roleIcon.color }}
          icon={{ name: roleIcon.name, type: 'ionicon', color: 'white' }}
          containerStyle={styles.avatar}
        />
        
        {/* Title */}
        <Text style={styles.title}>Check Your Email</Text>
        
        {/* Subtitle */}
        <Text style={styles.subtitle}>
          We've sent a verification email to
        </Text>
        <Text style={styles.email}>{email}</Text>

        {/* Role-specific message */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#2196f3" />
          <Text style={styles.infoText}>
            {getRoleMessage()}
          </Text>
        </View>

        {/* Status message */}
        {message ? (
          <View style={[
            styles.alertCard,
            { 
              backgroundColor: messageType === 'error' ? '#ffebee' : 
                              messageType === 'success' ? '#e8f5e8' : '#e3f2fd' 
            }
          ]}>
            <Ionicons 
              name={messageType === 'error' ? 'alert-circle' : 
                    messageType === 'success' ? 'checkmark-circle' : 'information-circle'} 
              size={20} 
              color={messageType === 'error' ? '#f44336' : 
                     messageType === 'success' ? '#4caf50' : '#2196f3'} 
            />
            <Text style={[
              styles.alertText,
              { 
                color: messageType === 'error' ? '#d32f2f' : 
                       messageType === 'success' ? '#2e7d32' : '#1976d2' 
              }
            ]}>
              {message}
            </Text>
          </View>
        ) : null}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Next Steps:</Text>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1.</Text>
            <Text style={styles.instructionText}>Check your email inbox</Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2.</Text>
            <Text style={styles.instructionText}>Click the verification link</Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3.</Text>
            <Text style={styles.instructionText}>
              {role === 'lender' ? 'Wait for admin approval' : 'Sign in to your account'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {/* Resend Email Button */}
          <Button
            title={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
            onPress={handleResendEmail}
            loading={isResending}
            disabled={isResending || resendCooldown > 0}
            buttonStyle={[
              styles.resendButton,
              (isResending || resendCooldown > 0) && styles.disabledButton
            ]}
            titleStyle={styles.resendButtonText}
            icon={<Ionicons name="refresh" size={16} color="white" />}
          />

          {/* Back to Login Button */}
          <Button
            title="Back to Login"
            type="outline"
            onPress={handleBackToLogin}
            buttonStyle={styles.backButton}
            titleStyle={styles.backButtonText}
            icon={<Ionicons name="arrow-back" size={16} color="#2196f3" />}
          />
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            • Check your spam/junk folder{'\n'}
            • Make sure {email} is correct{'\n'}
            • Contact support: support@microloan.com
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  avatar: {
    alignSelf: 'center',
    marginBottom: 24,
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
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#2196f3',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
    flex: 1,
    lineHeight: 20,
  },
  alertCard: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
  },
  instructionsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  instructionNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196f3',
    width: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  resendButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    borderColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196f3',
    fontWeight: '500',
    marginLeft: 8,
  },
  helpSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});