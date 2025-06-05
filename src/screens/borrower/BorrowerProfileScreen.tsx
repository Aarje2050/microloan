// src/screens/borrower/BorrowerProfileScreen.tsx
// Enterprise borrower profile management with comprehensive account overview
// Complete profile editing, loan history, and credit score tracking

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
import { supabase } from '../../services/supabase/config';
import { User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface EditProfileForm {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  employment_type: string;
  monthly_income: string;
}

interface BorrowerStats {
  total_loans: number;
  active_loans: number;
  total_borrowed: number;
  total_paid: number;
  current_credit_score: number;
  payment_score: number;
  member_since: string;
}

export const BorrowerProfileScreen: React.FC = () => {
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
    address: '',
    employment_type: '',
    monthly_income: ''
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
          address: '',
          employment_type: '',
          monthly_income: ''
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
    queryKey: ['borrowerProfile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getBorrowerProfile(currentUser.id);
    },
    enabled: !!currentUser?.id,
  });

  // Fetch borrower statistics
  const { 
    data: statsResponse, 
    isLoading: statsLoading,
    refetch: refetchStats 
  } = useQuery({
    queryKey: ['borrowerStats', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: null };
      return getBorrowerStats(currentUser.id);
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

      // Update borrower-specific info
      await updateBorrowerInfo(currentUser.id, {
        employment_type: profileData.employment_type,
        monthly_income: parseFloat(profileData.monthly_income) || 0
      });

      return { userUpdate, profileUpdate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowerProfile'] });
      queryClient.invalidateQueries({ queryKey: ['borrowerStats'] });
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
      AuthService.getCurrentUser().then(setCurrentUser);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  });

  /**
   * Get borrower profile with complete information - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerProfile = async (userId: string) => {
    try {
      // Get user profile
      const profileResult = await UserService.getUserProfile(userId);
      
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully - don't treat as error
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower error:', borrowerError);
        return { success: false };
      }

      return {
        success: true,
        data: {
          profile: profileResult.data,
          borrower: borrowerData // Can be null for new users
        }
      };

    } catch (error) {
      console.error('Get borrower profile error:', error);
      return { success: false };
    }
  };

  /**
   * Get borrower performance statistics - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerStats = async (userId: string): Promise<{ success: boolean; data?: BorrowerStats }> => {
    try {
      // Get borrower record with loans - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select(`
          *,
          loans(*,
            emis(*),
            payments(*)
          )
        `)
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower stats error:', borrowerError);
        return { success: false };
      }

      // FIXED: Return default stats if no borrower record exists
      if (!borrowerData) {
        return {
          success: true,
          data: {
            total_loans: 0,
            active_loans: 0,
            total_borrowed: 0,
            total_paid: 0,
            current_credit_score: 750, // Default credit score
            payment_score: 100,
            member_since: new Date().toISOString() // Current date for new users
          }
        };
      }

      const loans = borrowerData.loans || [];
      
      // Calculate metrics
      let totalLoans = loans.length;
      let activeLoans = loans.filter((loan: any) => loan.status === 'active').length;
      let totalBorrowed = 0;
      let totalPaid = 0;

      for (const loan of loans) {
        totalBorrowed += loan.principal_amount;
        
        // Calculate paid amount from payments
        const payments = loan.payments || [];
        const loanPaidAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
        totalPaid += loanPaidAmount;
      }

      // Calculate payment score based on EMI history
      let paymentScore = 100;
      let totalEMIs = 0;
      let paidEMIs = 0;
      let overdueEMIs = 0;

      for (const loan of loans) {
        const emis = loan.emis || [];
        totalEMIs += emis.length;
        paidEMIs += emis.filter((emi: any) => emi.status === 'paid').length;
        overdueEMIs += emis.filter((emi: any) => emi.status === 'overdue').length;
      }

      if (totalEMIs > 0) {
        const onTimeRate = paidEMIs / totalEMIs;
        const overdueRate = overdueEMIs / totalEMIs;
        paymentScore = Math.max(0, Math.min(100, (onTimeRate * 100) - (overdueRate * 20)));
      }

      // Credit score simulation (would integrate with actual credit bureau)
      const currentCreditScore = borrowerData.credit_score || Math.max(300, Math.min(850, 750 + (paymentScore - 50) * 2));

      return {
        success: true,
        data: {
          total_loans: totalLoans,
          active_loans: activeLoans,
          total_borrowed: totalBorrowed,
          total_paid: totalPaid,
          current_credit_score: currentCreditScore,
          payment_score: paymentScore,
          member_since: borrowerData.created_at || new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Get borrower stats error:', error);
      return { success: false };
    }
  };

  /**
   * Update borrower-specific information
   */
  const updateBorrowerInfo = async (userId: string, data: { employment_type: string; monthly_income: number }) => {
    try {
      const { error } = await supabase
        .from('borrowers')
        .update(data)
        .eq('user_id', userId);

      if (error) {
        console.error('Update borrower info error:', error);
      }
    } catch (error) {
      console.error('Update borrower info error:', error);
    }
  };

  // Load profile data into edit form
  useEffect(() => {
    if (profileResponse?.success && profileResponse.data) {
      const { profile, borrower } = profileResponse.data;
      setEditForm(prev => ({
        ...prev,
        address: profile?.address || '',
        employment_type: borrower?.employment_type || '',
        monthly_income: borrower?.monthly_income?.toString() || ''
      }));
    }
  }, [profileResponse]);

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

    if (editForm.monthly_income && (isNaN(Number(editForm.monthly_income)) || Number(editForm.monthly_income) < 0)) {
      errors.monthly_income = 'Valid monthly income is required';
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
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.signOut();
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  /**
   * Get credit health color and status
   */
  const getCreditHealthInfo = (score: number) => {
    if (score >= 800) return { color: '#4caf50', status: 'Excellent', description: 'You have an excellent credit profile' };
    if (score >= 750) return { color: '#8bc34a', status: 'Very Good', description: 'You have a very good credit profile' };
    if (score >= 700) return { color: '#ff9800', status: 'Good', description: 'You have a good credit profile' };
    if (score >= 650) return { color: '#ff5722', status: 'Fair', description: 'Your credit profile needs improvement' };
    return { color: '#f44336', status: 'Poor', description: 'Focus on improving your credit score' };
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

  const profile = profileResponse?.data?.profile;
  const borrower = profileResponse?.data?.borrower;
  const stats = statsResponse?.data;
  const creditHealth = stats ? getCreditHealthInfo(stats.current_credit_score) : null;

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
            title={currentUser?.full_name?.charAt(0)?.toUpperCase() || 'B'}
            overlayContainerStyle={{ backgroundColor: '#2196f3' }}
          />
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {currentUser?.full_name || 'Borrower Name'}
            </Text>
            <Text style={styles.profileRole}>Borrower</Text>
            <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            {stats && (
              <Text style={styles.memberSince}>
                Member since {formatDate(new Date(stats.member_since), 'short')}
              </Text>
            )}
          </View>
        </View>

        {/* Credit Score Card */}
        {stats && creditHealth && (
          <View style={styles.creditScoreCard}>
            <View style={styles.creditScoreHeader}>
              <Ionicons name="star" size={24} color={creditHealth.color} />
              <Text style={styles.creditScoreTitle}>Credit Score</Text>
            </View>
            <Divider style={styles.creditScoreDivider} />
            
            <View style={styles.creditScoreContent}>
              <View style={styles.creditScoreMain}>
                <Text style={[styles.creditScoreValue, { color: creditHealth.color }]}>
                  {stats.current_credit_score}
                </Text>
                <Text style={[styles.creditScoreStatus, { color: creditHealth.color }]}>
                  {creditHealth.status}
                </Text>
              </View>
              <View style={styles.creditScoreDetails}>
                <Text style={styles.creditScoreDescription}>
                  {creditHealth.description}
                </Text>
                <View style={styles.paymentScoreRow}>
                  <Text style={styles.paymentScoreLabel}>Payment Score:</Text>
                  <Text style={[styles.paymentScoreValue, { color: creditHealth.color }]}>
                    {stats.payment_score.toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Portfolio Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Ionicons name="analytics" size={20} color="#2196f3" />
              <Text style={styles.statsTitle}>Portfolio Overview</Text>
            </View>
            <Divider style={styles.statsDivider} />
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_loans}</Text>
                <Text style={styles.statLabel}>Total Loans</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.active_loans}</Text>
                <Text style={styles.statLabel}>Active Loans</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatCurrency(stats.total_borrowed)}
                </Text>
                <Text style={styles.statLabel}>Total Borrowed</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#4caf50' }]}>
                  {formatCurrency(stats.total_paid)}
                </Text>
                <Text style={styles.statLabel}>Total Paid</Text>
              </View>
            </View>
          </View>
        )}

        {/* Personal Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={20} color="#2196f3" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <Divider style={styles.sectionDivider} />
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{currentUser?.full_name}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{currentUser?.email}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{currentUser?.phone}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>
              {profile?.address || 'Address not provided'}
            </Text>
          </View>
        </View>

        {/* Employment Information */}
        {borrower && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase" size={20} color="#2196f3" />
              <Text style={styles.sectionTitle}>Employment Details</Text>
            </View>
            <Divider style={styles.sectionDivider} />
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Employment Type</Text>
              <Text style={styles.infoValue}>
                {borrower.employment_type || 'Not specified'}
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Monthly Income</Text>
              <Text style={[styles.infoValue, { color: '#4caf50', fontWeight: 'bold' }]}>
                {borrower.monthly_income ? formatCurrency(borrower.monthly_income) : 'Not specified'}
              </Text>
            </View>
          </View>
        )}

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
              <Ionicons name="create" size={20} color="#666" />
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
              editable={false}
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
            
            <Input
              label="Employment Type"
              value={editForm.employment_type}
              onChangeText={(value) => setEditForm({...editForm, employment_type: value})}
              placeholder="e.g., Salaried, Self-employed"
              leftIcon={<Ionicons name="briefcase" size={20} color="#9CA3AF" />}
            />
            
            <Input
              label="Monthly Income (₹)"
              value={editForm.monthly_income}
              onChangeText={(value) => setEditForm({...editForm, monthly_income: value})}
              errorMessage={formErrors.monthly_income}
              keyboardType="numeric"
              placeholder="e.g., 50000"
              leftIcon={<Ionicons name="cash" size={20} color="#9CA3AF" />}
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
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 10,
    color: '#999',
  },
  creditScoreCard: {
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
  creditScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  creditScoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  creditScoreDivider: {
    marginBottom: 16,
  },
  creditScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditScoreMain: {
    alignItems: 'center',
    marginRight: 20,
  },
  creditScoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  creditScoreStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  creditScoreDetails: {
    flex: 1,
  },
  creditScoreDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  paymentScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentScoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  paymentScoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsCard: {
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
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
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