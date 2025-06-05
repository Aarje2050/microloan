// src/screens/superadmin/ManageLendersScreen.tsx
// Enterprise lender management interface with CRUD operations and approval workflow
// Provides comprehensive lender administration for super admin

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal
} from 'react-native';
import { 
  Button, 
  Avatar, 
  Divider,
  Badge,
  Input,
  ButtonGroup
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { UserService, CreateUserForm, UpdateUserForm } from '../../services/users/userService';
import { supabase } from '../../services/supabase/config';
import { User, UserRole } from '../../types';
import { formatDate } from '../../utils';

interface LenderFormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
}

export const ManageLendersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Enhanced state management with approval functionality
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'pending'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLender, setSelectedLender] = useState<User | null>(null);
  const [formData, setFormData] = useState<LenderFormData>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<LenderFormData>>({});

  // View mode options for ButtonGroup
  const viewModeButtons = ['All Lenders', 'Pending Approval'];


  // Enhanced fetch lenders query with pending approval filter
  const { 
    data: lendersResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['lenders', searchQuery, viewMode],
    queryFn: async () => {
      if (viewMode === 'pending') {
        // Fetch pending lenders using SQL query
        const { data: pendingLenders, error: pendingError } = await supabase
          .from('users')
          .select(`
            *,
            user_profiles(address, kyc_status, avatar_url)
          `)
          .eq('role', 'lender')
          .eq('email_verified', true)
          .eq('pending_approval', true)
          .eq('active', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (pendingError) {
          throw pendingError;
        }

        return {
          success: true,
          data: {
            data: pendingLenders || [],
            count: pendingLenders?.length || 0,
            page: 1,
            limit: 50,
            total_pages: 1
          }
        };
      } else {
        // Use existing UserService for all lenders
        return UserService.getUsers(1, 50, { 
          role: 'lender', 
          search: searchQuery || undefined 
        });
      }
    },
    refetchInterval: 30000,
  });

  // Existing create lender mutation
  const createLenderMutation = useMutation({
    mutationFn: (userData: CreateUserForm) => UserService.createUser(userData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['lenders'] });
        setShowAddModal(false);
        resetForm();
        Alert.alert('Success', 'Lender created successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to create lender');
      }
    },
    onError: (error) => {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Create lender error:', error);
    }
  });

  // Existing update lender mutation
  const updateLenderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateUserForm }) => 
      UserService.updateUser(id, updates),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['lenders'] });
        setShowEditModal(false);
        setSelectedLender(null);
        resetForm();
        Alert.alert('Success', 'Lender updated successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update lender');
      }
    }
  });

  // Existing deactivate lender mutation
  const deactivateLenderMutation = useMutation({
    mutationFn: (userId: string) => UserService.deactivateUser(userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['lenders'] });
        Alert.alert('Success', 'Lender deactivated successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to deactivate lender');
      }
    }
  });

  // NEW: Approve lender mutation
  const approveLenderMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc('approve_lender', { 
        lender_email: email 
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ['lenders'] });
        Alert.alert('Success', 'Lender approved successfully! They can now login.');
      } else {
        Alert.alert('Error', result?.error || 'Failed to approve lender');
      }
    },
    onError: (error) => {
      console.error('Approve lender error:', error);
      Alert.alert('Error', 'Failed to approve lender. Please try again.');
    }
  });

  // NEW: Reject lender mutation
  const rejectLenderMutation = useMutation({
    mutationFn: (userId: string) => UserService.deactivateUser(userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['lenders'] });
        Alert.alert('Success', 'Lender application rejected');
      } else {
        Alert.alert('Error', result.error || 'Failed to reject lender');
      }
    }
  });

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Reset form data
   */
  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      address: ''
    });
    setFormErrors({});
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: Partial<LenderFormData> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (!showEditModal && !formData.password) {
      errors.password = 'Password is required';
    } else if (!showEditModal && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle create lender
   */
  const handleCreateLender = () => {
    if (!validateForm()) return;

    const userData: CreateUserForm = {
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: 'lender',
      address: formData.address
    };

    createLenderMutation.mutate(userData);
  };

  /**
   * Handle edit lender
   */
  const handleEditLender = () => {
    if (!selectedLender || !validateForm()) return;

    const updates: UpdateUserForm = {
      full_name: formData.full_name,
      phone: formData.phone,
      address: formData.address
    };

    updateLenderMutation.mutate({ id: selectedLender.id, updates });
  };

  /**
   * Open edit modal with lender data
   */
  const openEditModal = (lender: User) => {
    setSelectedLender(lender);
    setFormData({
      full_name: lender.full_name,
      email: lender.email,
      phone: lender.phone,
      password: '',
      address: (lender as any).user_profiles?.[0]?.address || ''
    });
    setShowEditModal(true);
  };

  /**
   * Handle deactivate lender
   */
  const handleDeactivateLender = (lender: User) => {
    Alert.alert(
      'Deactivate Lender',
      `Are you sure you want to deactivate ${lender.full_name}? This will prevent them from accessing the system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Deactivate', 
          style: 'destructive',
          onPress: () => deactivateLenderMutation.mutate(lender.id)
        }
      ]
    );
  };

  /**
   * NEW: Handle approve lender
   */
  const handleApproveLender = (lender: User) => {
    Alert.alert(
      'Approve Lender',
      `Approve ${lender.full_name} as a loan officer? They will be able to login and manage borrowers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          style: 'default',
          onPress: () => approveLenderMutation.mutate(lender.email)
        }
      ]
    );
  };

  /**
   * NEW: Handle reject lender
   */
  const handleRejectLender = (lender: User) => {
    Alert.alert(
      'Reject Lender Application',
      `Reject ${lender.full_name}'s application? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: () => rejectLenderMutation.mutate(lender.id)
        }
      ]
    );
  };

  /**
   * Enhanced status badge for lender
   */
  const getStatusBadge = (lender: User) => {
    const isActive = !lender.deleted_at && lender.active;
    const isEmailVerified = lender.email_verified;
    const isPendingApproval = lender.pending_approval;
    
    if (!isEmailVerified) {
      return <Badge value="Email Unverified" badgeStyle={{ backgroundColor: '#ff9800' }} />;
    }
    
    if (isPendingApproval && !isActive) {
      return <Badge value="Pending Approval" badgeStyle={{ backgroundColor: '#ff5722' }} />;
    }
    
    if (!isActive) {
      return <Badge value="Inactive" badgeStyle={{ backgroundColor: '#9e9e9e' }} />;
    }
    
    const kycStatus = (lender as any).user_profiles?.[0]?.kyc_status || 'pending';
    const statusConfig = {
      'verified': { color: '#4caf50', text: 'Active' },
      'pending': { color: '#ff9800', text: 'Pending' },
      'rejected': { color: '#f44336', text: 'Rejected' }
    };
    
    const config = statusConfig[kycStatus as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge
        value={config.text}
        badgeStyle={{ backgroundColor: config.color }}
        textStyle={{ fontSize: 10 }}
      />
    );
  };

  /**
   * NEW: Get action buttons based on lender status
   */
  const getLenderActions = (lender: User) => {
    const isPendingApproval = lender.pending_approval && lender.email_verified && !lender.active;
    
    if (isPendingApproval) {
      // Show approve/reject buttons for pending lenders
      return (
        <View style={styles.lenderActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#e8f5e9' }]}
            onPress={() => handleApproveLender(lender)}
          >
            <Ionicons name="checkmark" size={16} color="#4caf50" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#ffebee', marginLeft: 8 }]}
            onPress={() => handleRejectLender(lender)}
          >
            <Ionicons name="close" size={16} color="#f44336" />
          </TouchableOpacity>
        </View>
      );
    } else {
      // Show edit/deactivate buttons for active lenders
      return (
        <View style={styles.lenderActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(lender)}
          >
            <Ionicons name="pencil" size={16} color="#2196f3" />
          </TouchableOpacity>
          
          {!lender.deleted_at && lender.active && (
            <TouchableOpacity
              style={[styles.actionButton, { marginLeft: 8 }]}
              onPress={() => handleDeactivateLender(lender)}
            >
              <Ionicons name="ban" size={16} color="#f44336" />
            </TouchableOpacity>
          )}
        </View>
      );
    }
  };

  // Show loading state
  if (isLoading && !lendersResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="people" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Lenders...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !lendersResponse?.success) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load lenders</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const lenders = lendersResponse.data?.data || [];
  const pendingCount = lenders.filter(l => l.pending_approval && l.email_verified && !l.active).length;

  return (
    <View style={styles.container}>
      
      {/* Enhanced Header with Pending Count */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Manage Lenders</Text>
          <Text style={styles.headerSubtitle}>
            {lenders.length} lender{lenders.length !== 1 ? 's' : ''} total
            {pendingCount > 0 && viewMode === 'all' && (
              <Text style={styles.pendingAlert}> • {pendingCount} pending approval</Text>
            )}
          </Text>
        </View>
        <Button
          title="Add Lender"
          icon={<Ionicons name="person-add" size={16} color="white" />}
          buttonStyle={styles.addButton}
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
        />
      </View>

      {/* NEW: View Mode Toggle */}
<View style={styles.viewModeContainer}>
  <ButtonGroup
    onPress={(index) => setViewMode(index === 0 ? 'all' : 'pending')}
    selectedIndex={viewMode === 'all' ? 0 : 1}
    buttons={viewModeButtons}
    containerStyle={styles.buttonGroupContainer}
    selectedButtonStyle={styles.selectedButtonStyle}
    innerBorderStyle={{ width: 0 }}
  />
  
  {viewMode === 'pending' && pendingCount > 0 && (
    <View style={styles.pendingBanner}>
      <Ionicons name="time" size={16} color="#ff5722" />
      <Text style={styles.pendingBannerText}>
        {pendingCount} lender{pendingCount !== 1 ? 's' : ''} awaiting approval
      </Text>
    </View>
  )}
</View>

      {/* Search Input (hide in pending mode) */}
      {viewMode === 'all' && (
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search lenders..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Ionicons name="search" size={20} color="#9CA3AF" />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ) : undefined
            }
            containerStyle={styles.searchInputWrapper}
            inputContainerStyle={styles.searchInputContainer}
          />
        </View>
      )}

      {/* Lenders List */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {lenders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={viewMode === 'pending' ? "time-outline" : "people-outline"} 
              size={64} 
              color="#9e9e9e" 
            />
            <Text style={styles.emptyStateText}>
              {viewMode === 'pending' ? 'No pending approvals' : 'No lenders found'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {viewMode === 'pending' 
                ? 'All lender applications have been processed'
                : searchQuery 
                  ? 'Try adjusting your search' 
                  : 'Create your first lender to get started'
              }
            </Text>
          </View>
        ) : (
          lenders.map((lender) => (
            <View key={lender.id} style={styles.lenderCard}>
              <View style={styles.lenderInfo}>
                <Avatar
                  size="medium"
                  rounded
                  title={lender.full_name.charAt(0).toUpperCase()}
                  overlayContainerStyle={{ 
                    backgroundColor: lender.pending_approval && !lender.active ? '#ff5722' : '#2196f3' 
                  }}
                />
                <View style={styles.lenderDetails}>
                  <View style={styles.lenderHeader}>
                    <Text style={styles.lenderName}>{lender.full_name}</Text>
                    {getStatusBadge(lender)}
                  </View>
                  <Text style={styles.lenderEmail}>{lender.email}</Text>
                  <Text style={styles.lenderPhone}>{lender.phone}</Text>
                  <Text style={styles.lenderDate}>
                    {lender.pending_approval && !lender.active 
                      ? `Applied: ${formatDate(new Date(lender.created_at), 'short')}`
                      : `Joined: ${formatDate(new Date(lender.created_at), 'short')}`
                    }
                  </Text>
                </View>
              </View>
              
              {getLenderActions(lender)}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Lender Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Lender</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formContainer}>
              
              <Input
                label="Full Name *"
                value={formData.full_name}
                onChangeText={(value) => setFormData({...formData, full_name: value})}
                errorMessage={formErrors.full_name}
                leftIcon={<Ionicons name="person" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Email Address *"
                value={formData.email}
                onChangeText={(value) => setFormData({...formData, email: value})}
                errorMessage={formErrors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Phone Number *"
                value={formData.phone}
                onChangeText={(value) => setFormData({...formData, phone: value})}
                errorMessage={formErrors.phone}
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Password *"
                value={formData.password}
                onChangeText={(value) => setFormData({...formData, password: value})}
                errorMessage={formErrors.password}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Address (Optional)"
                value={formData.address}
                onChangeText={(value) => setFormData({...formData, address: value})}
                multiline
                leftIcon={<Ionicons name="location" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              type="outline"
              buttonStyle={styles.cancelButton}
              titleStyle={styles.cancelButtonText}
              onPress={() => setShowAddModal(false)}
            />
            <Button
              title="Create Lender"
              buttonStyle={styles.createButton}
              titleStyle={styles.createButtonText}
              loading={createLenderMutation.isPending}
              onPress={handleCreateLender}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Lender Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Lender</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formContainer}>
              
              <Input
                label="Full Name *"
                value={formData.full_name}
                onChangeText={(value) => setFormData({...formData, full_name: value})}
                errorMessage={formErrors.full_name}
                leftIcon={<Ionicons name="person" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Email Address"
                value={formData.email}
                disabled
                leftIcon={<Ionicons name="mail" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Phone Number *"
                value={formData.phone}
                onChangeText={(value) => setFormData({...formData, phone: value})}
                errorMessage={formErrors.phone}
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Address (Optional)"
                value={formData.address}
                onChangeText={(value) => setFormData({...formData, address: value})}
                multiline
                leftIcon={<Ionicons name="location" size={20} color="#9CA3AF" />}
                containerStyle={styles.inputContainer}
              />

            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              type="outline"
              buttonStyle={styles.cancelButton}
              titleStyle={styles.cancelButtonText}
              onPress={() => setShowEditModal(false)}
            />
            <Button
              title="Update Lender"
              buttonStyle={styles.createButton}
              titleStyle={styles.createButtonText}
              loading={updateLenderMutation.isPending}
              onPress={handleEditLender}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pendingAlert: {
    color: '#ff5722',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  // NEW: View mode toggle styles
  viewModeContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  buttonGroupContainer: {
    marginBottom: 12,
    borderRadius: 8,
    borderColor: '#e0e0e0',
    height: 40,
  },
  selectedButtonStyle: {
    backgroundColor: '#2196f3',
  },
  
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  pendingBannerText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#e65100',
    fontWeight: '500',
  },
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputWrapper: {
    paddingHorizontal: 0,
  },
  searchInputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  lenderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lenderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lenderDetails: {
    marginLeft: 12,
    flex: 1,
  },
  lenderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lenderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  lenderEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  lenderPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  lenderDate: {
    fontSize: 12,
    color: '#999',
  },
  lenderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  formContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  inputContainer: {
    marginBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});