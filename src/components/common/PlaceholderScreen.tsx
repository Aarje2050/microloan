
  
  import React from 'react';
  import {
    View,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Text,
  } from 'react-native';
  import {
    Button,
    Avatar,
    Divider,
    useTheme,
  } from 'react-native-elements';
  import { Ionicons } from '@expo/vector-icons';
  import { AuthService } from '../../services/auth/authService';
  import { UserRole } from '../../types';
  
  interface PlaceholderScreenProps {
    title: string;
    role: UserRole ;
    subtitle?:string
    icon?:string
  }
  
  export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({ 
    title, 
    role 
  }) => {
    const { theme } = useTheme();
    
    const handleLogout = async () => {
      try {
        await AuthService.signOut();
        // Navigation back to login will be handled by App.tsx auth state change
      } catch (error) {
        console.error('Logout error:', error);
      }
    };
  
  // Styles for PlaceholderScreen
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    content: {
      padding: 16,
      paddingTop: 50,
    },
    headerCard: {
      borderRadius: 12,
      marginBottom: 24,
    },
    headerContent: {
      alignItems: 'center',
    },
    avatar: {
      marginBottom: 16,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      color: '#212121',
      textAlign: 'center',
      marginBottom: 8,
    },
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    description: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
      lineHeight: 20,
    },
    alertCard: {
      backgroundColor: '#e3f2fd',
      borderRadius: 8,
      marginBottom: 24,
    },
    alertContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    alertTextContainer: {
      marginLeft: 8,
      flex: 1,
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: '#1976d2',
      marginBottom: 4,
    },
    alertSubtitle: {
      fontSize: 12,
      color: '#1976d2',
    },
    featuresCard: {
      borderRadius: 12,
      marginBottom: 24,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#212121',
      marginLeft: 8,
    },
    cardDivider: {
      marginBottom: 16,
    },
    featuresList: {
      gap: 12,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#2196f3',
      marginRight: 12,
    },
    featureText: {
      fontSize: 14,
      color: '#333',
      flex: 1,
    },
    phaseCard: {
      borderRadius: 12,
      marginBottom: 24,
    },
    phasesList: {
      gap: 16,
    },
    phaseItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    phaseBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginRight: 12,
    },
    phaseBadgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    },
    phaseContent: {
      flex: 1,
    },
    phaseTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: '#212121',
      marginBottom: 4,
    },
    phaseDescription: {
      fontSize: 12,
      color: '#666',
    },
    actionsCard: {
      borderRadius: 12,
      marginBottom: 24,
    },
    actionsList: {
      gap: 12,
    },
    actionButton: {
      borderRadius: 8,
      paddingVertical: 12,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 8,
    },
    logoutButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: 'white',
      marginLeft: 8,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    footerText: {
      fontSize: 12,
      color: '#999',
      marginBottom: 4,
    },
    footerSubtext: {
      fontSize: 10,
      color: '#bbb',
    },
  });
  
    const getRoleColor = (userRole: UserRole): string => {
      switch (userRole) {
        case 'super_admin':
          return '#f44336';
        case 'lender':
          return '#ff9800';
        case 'borrower':
          return '#4caf50';
        default:
          return '#9e9e9e';
      }
    };
  
    const getRoleDescription = (userRole: UserRole): string => {
      switch (userRole) {
        case 'super_admin':
          return 'Full system access with analytics and user management capabilities';
        case 'lender':
          return 'Manage borrowers, create loans, and track EMI payments';
        case 'borrower':
          return 'View loan details, EMI schedule, and payment history';
        default:
          return 'Standard user access';
      }
    };
  
    const getUpcomingFeatures = (userRole: UserRole): string[] => {
      switch (userRole) {
        case 'super_admin':
          return [
            'System-wide analytics dashboard',
            'Lender performance metrics',
            'User management interface',
            'Loan portfolio overview',
            'Risk assessment tools',
            'Report generation'
          ];
        case 'lender':
          return [
            'Borrower management dashboard',
            'Loan creation wizard',
            'EMI tracking interface',
            'Payment recording system',
            'Overdue loan alerts',
            'Performance reports'
          ];
        case 'borrower':
          return [
            'Personal loan dashboard',
            'EMI schedule viewer',
            'Payment history tracker',
            'Document upload portal',
            'Payment reminders',
            'Loan status updates'
          ];
        default:
          return [];
      }
    };
  
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          
          {/* Header Section */}
          <View style={styles.headerCard}>
            <Avatar
              size="large"
              rounded
              overlayContainerStyle={{ backgroundColor: getRoleColor(role) }}
              icon={{
                name: role === 'super_admin' ? 'shield-checkmark' :
                      role === 'lender' ? 'briefcase' : 'person',
                type: 'ionicon',
                color: 'white'
              }}
              containerStyle={styles.avatar}
            />
            <Text style={styles.title}>
              {title}
            </Text>
            <View style={[styles.badge, { backgroundColor: getRoleColor(role) }]}>
              <Text style={styles.badgeText}>
                {role.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.description}>
              {getRoleDescription(role)}
            </Text>
          </View>
  
          {/* Development Status Alert */}
          <View style={styles.alertCard}>
            <Ionicons name="information-circle" size={20} color="#2196f3" />
            <Text style={styles.alertTitle}>This screen is under development</Text>
            <Text style={styles.alertSubtitle}>
              Your role-specific features will be available in the next development phase
            </Text>
          </View>
  
          {/* Quick Actions */}
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <Divider style={styles.cardDivider} />
            <Button
              title="Test Database Connection"
              type="outline"
              buttonStyle={styles.actionButton}
              onPress={() => console.log('Testing database connection...')}
            />
            <Button
              title="Sign Out"
              buttonStyle={[styles.actionButton, { backgroundColor: '#f44336' }]}
              onPress={handleLogout}
            />
          </View>
  
          {/* Version Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>MicroLoan Manager v1.0.0</Text>
            <Text style={styles.footerSubtext}>Phase 1 - Foundation Complete</Text>
          </View>
  
        </View>
      </ScrollView>
    );
  };