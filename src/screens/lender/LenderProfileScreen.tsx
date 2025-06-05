// src/screens/lender/LenderProfileScreen.tsx
// Clean, working lender profile screen with functional edit capabilities

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal
} from 'react-native';
import { 
  Avatar, 
  Button, 
  Divider,
  Input
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { AuthService } from '../../services/auth/authService';
import { UserService } from '../../services/users/userService';
import { LoanService } from '../../services/loans/loanService';
import { User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { UniversalSignOutService } from '../../services/auth/universalSignOutService';


interface EditProfileForm {
  full_name: string;
  phone: string;
  email: string;
  address: string;
}

export const LenderProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditProfileForm>({
    full_name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<EditProfileForm>>({});

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
      if (user) {
        setEditForm({
          full_name: user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          address: ''
        });
      }
    };
    getCurrentUser();
  }, []);

  // Fetch user profile data
  const { 
    data: profileResponse, 
    isLoading: profileLoading, 
    refetch: refetchProfile 
  } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return UserService.getUserProfile(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Fetch lender statistics
  const { 
    data: statsResponse, 
    isLoading: statsLoading,
    refetch: refetchStats 
  } = useQuery({
    queryKey: ['lenderStats', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getLenderStats(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: EditProfileForm) => {
      if (!currentUser?.id) throw new Error('No current user');
      
      // Update user basic info
      const userUpdate = await UserService.updateUser(currentUser.id, {
        full_name: profileData.full_name,
        phone: profileData.phone
      });

      if (!userUpdate.success) throw new Error(userUpdate.error);

      // Update profile address
      const profileUpdate = await UserService.updateUserProfile(currentUser.id, {
        address: profileData.address
      });

      return { userUpdate, profileUpdate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
      AuthService.getCurrentUser().then(setCurrentUser);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  });

  // Load profile address into edit form
  useEffect(() => {
    if (profileResponse?.success && profileResponse.data) {
      const profile = profileResponse.data;
      setEditForm(prev => ({
        ...prev,
        address: profile.address || ''
      }));
    }
  }, [profileResponse]);

  // Get lender performance statistics
  const getLenderStats = async (lenderId: string) => {
    try {
      const borrowersResult = await LoanService.getBorrowersByLender(lenderId);
      if (!borrowersResult.success) {
        return { success: false };
      }

      const borrowers = borrowersResult.data || [];
      const totalBorrowers = borrowers.length;

      let totalLoans = 0;
      let activeLoans = 0;
      let totalDisbursed = 0;

      for (const borrower of borrowers) {
        const loans = (borrower as any).loans || [];
        totalLoans += loans.length;
        
        for (const loan of loans) {
          totalDisbursed += loan.principal_amount;
          if (loan.status === 'active') {
            activeLoans++;
          }
        }
      }

      return {
        success: true,
        data: {
          total_borrowers: totalBorrowers,
          total_loans: totalLoans,
          total_disbursed: totalDisbursed,
          active_loans: activeLoans,
          member_since: currentUser?.created_at || new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Get lender stats error:', error);
      return { success: false };
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Validate edit form
  const validateEditForm = (): boolean => {
    const errors: Partial<EditProfileForm> = {};

    if (!editForm.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!editForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      errors.email = 'Valid email address is required';
    }

    if (!editForm.phone.trim() || !/^\+?[\d\s\-\(\)]{10,}$/.test(editForm.phone)) {
      errors.phone = 'Valid phone number is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle profile update
  const handleUpdateProfile = () => {
    if (!validateEditForm()) return;

    Alert.alert(
      'Update Profile',
      'Are you sure you want to update your profile information?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Update', 
          onPress: () => updateProfileMutation.mutate(editForm)
        }
      ]
    );
  };

  // Handle logout
  const handleLogout = () => {
    UniversalSignOutService.handleSignOut();
  };

  // Show loading state
  if ((profileLoading || statsLoading) && !profileResponse && !statsResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-circle" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  const profile = profileResponse?.data;
  const stats = statsResponse?.data;

  return (
    <View style={styles.container}>
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            size="large"
            rounded
            title={currentUser?.full_name?.charAt(0)?.toUpperCase() || 'L'}
            overlayContainerStyle={{ backgroundColor: '#2196f3' }}
          />
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {currentUser?.full_name || 'Lender Name'}
            </Text>
            <Text style={styles.profileRole}>Loan Officer</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
          </View>
        </View>

        {/* Performance Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Ionicons name="analytics" size={20} color="#2196f3" />
              <Text style={styles.statsTitle}>Performance Overview</Text>
            </View>
            <Divider style={styles.statsDivider} />
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_borrowers}</Text>
                <Text style={styles.statLabel}>Total Borrowers</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_loans}</Text>
                <Text style={styles.statLabel}>Total Loans</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatCurrency(stats.total_disbursed)}
                </Text>
                <Text style={styles.statLabel}>Total Disbursed</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.active_loans}</Text>
                <Text style={styles.statLabel}>Active Loans</Text>
              </View>
            </View>

            <View style={styles.memberSince}>
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.memberSinceText}>
                Member since {formatDate(new Date(stats.member_since), 'short')}
              </Text>
            </View>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={20} color="#666" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{currentUser?.email}</Text>
            </View>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="call" size={20} color="#666" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>{currentUser?.phone}</Text>
            </View>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="location" size={20} color="#666" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Address</Text>
              <Text style={styles.contactValue}>
                {profile?.address || 'Address not provided'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Account Settings</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowEditModal(true)}
          >
            <View style={styles.settingContent}>
              <Ionicons name="person" size={20} color="#666" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Alert.alert('Feature Coming Soon', 'Notification settings will be available in the next update.')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="notifications" size={20} color="#666" />
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Alert.alert('Help & Support', 'For support, please contact:\n\nEmail: support@microloan.com\nPhone: +1-800-MICROLOAN\n\nOur team will assist you within 24 hours.')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="help-circle" size={20} color="#666" />
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            buttonStyle={styles.logoutButton}
            titleStyle={styles.logoutButtonText}
            icon={<Ionicons name="log-out" size={20} color="#f44336" />}
            onPress={handleLogout}
          />
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity 
              onPress={handleUpdateProfile}
              disabled={updateProfileMutation.isPending}
            >
              <Text style={[
                styles.modalSave,
                updateProfileMutation.isPending && styles.modalSaveDisabled
              ]}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Input
              label="Full Name *"
              value={editForm.full_name}
              onChangeText={(value) => setEditForm({...editForm, full_name: value})}
              errorMessage={formErrors.full_name}
              leftIcon={<Ionicons name="person" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="Email Address *"
              value={editForm.email}
              onChangeText={(value) => setEditForm({...editForm, email: value})}
              errorMessage={formErrors.email}
              keyboardType="email-address"
              leftIcon={<Ionicons name="mail" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="Phone Number *"
              value={editForm.phone}
              onChangeText={(value) => setEditForm({...editForm, phone: value})}
              errorMessage={formErrors.phone}
              keyboardType="phone-pad"
              leftIcon={<Ionicons name="call" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="Address"
              value={editForm.address}
              onChangeText={(value) => setEditForm({...editForm, address: value})}
              multiline
              leftIcon={<Ionicons name="location" size={20} color="#9CA3AF" />}
            />
          </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  statsCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statsDivider: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  memberSinceText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  sectionDivider: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactContent: {
    marginLeft: 12,
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: '#666',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutSection: {
    padding: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 8,
  },
  logoutButtonText: {
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
  modalSave: {
    fontSize: 16,
    color: '#2196f3',
    fontWeight: '600',
  },
  modalSaveDisabled: {
    color: '#999',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
});