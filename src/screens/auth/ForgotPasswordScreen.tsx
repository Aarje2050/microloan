// src/screens/auth/ForgotPasswordScreen.tsx
// FIXED - Professional forgot password screen with safe area handling

import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Input, Button, Avatar } from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthService } from '../../services/auth/authService';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessageType('error');
      setMessage('Please enter your email address');
      return;
    }

    if (!AuthService.isValidEmail(email)) {
      setMessageType('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await AuthService.resetPassword(email);
      
      if (result.success) {
        setMessageType('success');
        setMessage('Password reset email sent! Please check your inbox.');
      } else {
        setMessageType('error');
        setMessage(result.error || 'Failed to send reset email');
      }
    } catch (error) {
      setMessageType('error');
      setMessage('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        
        {/* Icon */}
        <Avatar
          size="large"
          rounded
          overlayContainerStyle={{ backgroundColor: '#ff9800' }}
          icon={{ name: 'key', type: 'ionicon', color: 'white' }}
          containerStyle={styles.avatar}
        />
        
        <Text style={styles.title}>
          Reset Your Password
        </Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you a link to reset your password
        </Text>

        {/* Message Alert */}
        {message ? (
          <View style={[
            styles.alertCard,
            { backgroundColor: messageType === 'error' ? '#ffebee' : '#e8f5e8' }
          ]}>
            <Ionicons 
              name={messageType === 'error' ? 'alert-circle' : 'checkmark-circle'} 
              size={20} 
              color={messageType === 'error' ? '#f44336' : '#4caf50'} 
            />
            <Text style={[
              styles.alertText,
              { color: messageType === 'error' ? '#d32f2f' : '#2e7d32' }
            ]}>
              {message}
            </Text>
          </View>
        ) : null}

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address</Text>
          <Input
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Ionicons name="mail" size={20} color="#9CA3AF" />}
            containerStyle={styles.input}
          />
        </View>

        {/* Reset Button */}
        <Button
          title="Send Reset Email"
          onPress={handleResetPassword}
          loading={isLoading}
          buttonStyle={styles.resetButton}
          titleStyle={styles.resetButtonText}
        />

        {/* Back to Login */}
        <Button
          title="Back to Login"
          type="clear"
          onPress={() => navigation.goBack()}
          titleStyle={styles.backButtonText}
        />

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
    marginBottom: 16,
  },
  title: {
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
  },
  inputContainer: {
    marginBottom: 24,
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
  resetButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 16,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196f3',
    fontWeight: '500',
  },
});