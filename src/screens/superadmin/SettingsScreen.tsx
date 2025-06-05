// src/screens/superadmin/SettingsScreen.tsx
// Simple Settings Screen - Account settings and sign out only
// Minimal design to avoid any complex component issues

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
  Avatar, 
  Input
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';

import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User } from '../../types';
import { UniversalSignOutService } from '../../services/auth/universalSignOutService';


export const SettingsScreen: React.FC = () => {
  
  // State management
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<any>({});

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: typeof passwordForm) => {
      const { data, error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setShowChangePasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password changed successfully!');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  });

  /**
   * Validate password form
   */
  const validatePasswordForm = (): boolean => {
    const errors: any = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle password change
   */
  const handleChangePassword = () => {
    if (!validatePasswordForm()) return;
    
    Alert.alert(
      'Change Password',
      'Are you sure you want to change your password?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Change', 
          onPress: () => changePasswordMutation.mutate(passwordForm)
        }
      ]
    );
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    UniversalSignOutService.handleSignOut();

  };

  return (
    <View style={styles.container}>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Account preferences</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.profileCard}>
          <Avatar
            size="large"
            rounded
            title={currentUser?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            overlayContainerStyle={{ backgroundColor: '#2196f3' }}
          />
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {currentUser?.full_name || 'Super Admin'}
            </Text>
            <Text style={styles.profileRole}>System Administrator</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowChangePasswordModal(true)}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed" size={20} color="#666" />
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="person" size={20} color="#666" />
              <Text style={styles.settingText}>Profile Information</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#4caf50" />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutCard}>
          <Button
            title="Sign Out"
            buttonStyle={styles.signOutButton}
            titleStyle={styles.signOutButtonText}
            icon={<Ionicons name="log-out" size={20} color="#f44336" />}
            onPress={handleLogout}
          />
        </View>

      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Input
              label="Current Password"
              value={passwordForm.currentPassword}
              onChangeText={(value) => setPasswordForm({...passwordForm, currentPassword: value})}
              errorMessage={passwordErrors.currentPassword}
              secureTextEntry
              leftIcon={<Ionicons name="lock-closed" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="New Password"
              value={passwordForm.newPassword}
              onChangeText={(value) => setPasswordForm({...passwordForm, newPassword: value})}
              errorMessage={passwordErrors.newPassword}
              secureTextEntry
              leftIcon={<Ionicons name="lock-closed" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChangeText={(value) => setPasswordForm({...passwordForm, confirmPassword: value})}
              errorMessage={passwordErrors.confirmPassword}
              secureTextEntry
              leftIcon={<Ionicons name="checkmark" size={20} color="#9CA3AF" />}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Change Password"
              buttonStyle={styles.changePasswordButton}
              loading={changePasswordMutation.isPending}
              onPress={handleChangePassword}
            />
          </View>
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
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#2196f3',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: '#666',
  },
  settingsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  signOutCard: {
    padding: 16,
    paddingBottom: 32,
    marginTop: 16,
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
  },
  signOutButtonText: {
    color: '#f44336',
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
  modalCancel: {
    fontSize: 16,
    color: '#666',
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
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  changePasswordButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 12,
  },
});