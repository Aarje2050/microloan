// src/screens/borrower/DocumentsScreen.tsx
// Enterprise document management system for borrower KYC and loan documentation
// Complete document lifecycle with upload, verification, and status tracking

import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Text, 
  RefreshControl,
  TouchableOpacity,
  FlatList,
  Alert
} from 'react-native';
import { 
  Button, 
  Divider,
  Badge,
  Input
} from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { AuthService } from '../../services/auth/authService';
import { supabase } from '../../services/supabase/config';
import { User, Document, DocumentType, KYCStatus, BorrowerStackParamList, BorrowerTabParamList } from '../../types';
import { formatDate } from '../../utils';

// Navigation type - FIXED: Using CompositeNavigationProp for screens used in both Tab and Stack
type DocumentsNavigationProp = CompositeNavigationProp<
  StackNavigationProp<BorrowerStackParamList>,
  BottomTabNavigationProp<BorrowerTabParamList, 'Documents'>
>;

// Document type configurations
const DOCUMENT_TYPES: Array<{
  type: DocumentType;
  label: string;
  description: string;
  icon: string;
  required: boolean;
}> = [
  {
    type: 'aadhar',
    label: 'Aadhar Card',
    description: 'Government issued identity proof',
    icon: 'card',
    required: true
  },
  {
    type: 'pan',
    label: 'PAN Card',
    description: 'Income tax identity document',
    icon: 'document-text',
    required: true
  },
  {
    type: 'salary_slip',
    label: 'Salary Slip',
    description: 'Latest 3 months salary slips',
    icon: 'receipt',
    required: false
  },
  {
    type: 'bank_statement',
    label: 'Bank Statement',
    description: 'Last 6 months bank statements',
    icon: 'library',
    required: false
  },
  {
    type: 'photo',
    label: 'Profile Photo',
    description: 'Recent passport size photograph',
    icon: 'camera',
    required: true
  }
];

const STATUS_FILTERS = [
  { label: 'All Documents', value: 'all' },
  { label: 'Verified', value: 'verified' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' }
];

interface DocumentWithType extends Document {
  typeConfig: typeof DOCUMENT_TYPES[0];
}

export const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation<DocumentsNavigationProp>();
  
  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch documents
  const { 
    data: documentsResponse, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['borrowerDocuments', currentUser?.id, selectedFilter],
    queryFn: async () => {
      if (!currentUser?.id) return { success: false, data: [] };
      return getBorrowerDocuments(currentUser.id);
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000,
  });

  /**
   * Get documents for borrower - FIXED: Handle missing borrower records gracefully
   */
  const getBorrowerDocuments = async (userId: string) => {
    try {
      // Get borrower record - FIXED: Handle case where borrower doesn't exist
      const { data: borrowerData, error: borrowerError } = await supabase
        .from('borrowers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle(); // FIXED: Use maybeSingle() instead of single()

      // FIXED: Handle missing borrower record gracefully
      if (borrowerError && borrowerError.code !== 'PGRST116') {
        console.error('Get borrower error:', borrowerError);
        return { success: false, data: [] };
      }

      // FIXED: Return empty array if no borrower record exists
      if (!borrowerData) {
        return { success: true, data: [] };
      }

      // Get documents for this borrower
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('borrower_id', borrowerData.id)
        .order('created_at', { ascending: false });

      if (documentsError) {
        console.error('Get documents error:', documentsError);
        return { success: false, data: [] };
      }

      let filteredDocuments = documents || [];

      // Apply status filter
      if (selectedFilter !== 'all') {
        filteredDocuments = filteredDocuments.filter(doc => 
          doc.verification_status === selectedFilter
        );
      }

      // Add type configuration to each document
      const documentsWithType = filteredDocuments.map(doc => ({
        ...doc,
        typeConfig: DOCUMENT_TYPES.find(type => type.type === doc.document_type) || DOCUMENT_TYPES[0]
      }));

      return {
        success: true,
        data: documentsWithType as DocumentWithType[]
      };

    } catch (error) {
      console.error('Get borrower documents error:', error);
      return { success: false, data: [] };
    }
  };

  /**
   * Get document status badge
   */
  const getDocumentStatusBadge = (status: KYCStatus) => {
    const statusConfig = {
      'verified': { color: '#4caf50', text: 'Verified' },
      'pending': { color: '#ff9800', text: 'Pending Review' },
      'rejected': { color: '#f44336', text: 'Rejected' }
    };
    
    const config = statusConfig[status] || { color: '#9e9e9e', text: status };
    
    return (
      <Badge
        value={config.text}
        badgeStyle={{ backgroundColor: config.color }}
        textStyle={{ fontSize: 10 }}
      />
    );
  };

  /**
   * Calculate document summary
   */
  const calculateSummary = (documents: DocumentWithType[]) => {
    const totalDocuments = DOCUMENT_TYPES.length;
    const uploadedDocuments = new Set(documents.map(doc => doc.document_type)).size;
    const verifiedDocuments = documents.filter(doc => doc.verification_status === 'verified').length;
    const pendingDocuments = documents.filter(doc => doc.verification_status === 'pending').length;
    const rejectedDocuments = documents.filter(doc => doc.verification_status === 'rejected').length;
    
    const requiredDocuments = DOCUMENT_TYPES.filter(type => type.required).length;
    const uploadedRequiredDocuments = documents.filter(doc => 
      DOCUMENT_TYPES.find(type => type.type === doc.document_type)?.required
    ).length;

    const completionPercentage = (uploadedDocuments / totalDocuments) * 100;
    const verificationPercentage = uploadedDocuments > 0 ? (verifiedDocuments / uploadedDocuments) * 100 : 0;

    return {
      totalDocuments,
      uploadedDocuments,
      verifiedDocuments,
      pendingDocuments,
      rejectedDocuments,
      requiredDocuments,
      uploadedRequiredDocuments,
      completionPercentage,
      verificationPercentage
    };
  };

  /**
   * Get missing documents
   */
  const getMissingDocuments = (documents: DocumentWithType[]) => {
    const uploadedTypes = new Set(documents.map(doc => doc.document_type));
    return DOCUMENT_TYPES.filter(type => !uploadedTypes.has(type.type));
  };

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
   * Handle document upload
   */
  const handleDocumentUpload = (documentType?: DocumentType) => {
    navigation.navigate('DocumentUpload', { documentType });
  };

  /**
   * Handle document view
   */
  const handleDocumentView = (document: DocumentWithType) => {
    Alert.alert(
      'Document Details',
      `Document: ${document.typeConfig.label}\nStatus: ${document.verification_status}\nUploaded: ${formatDate(new Date(document.created_at), 'short')}`,
      [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'View Document', 
          onPress: () => navigation.navigate('DocumentViewer', { documentId: document.id })
        }
      ]
    );
  };

  /**
   * Render document item
   */
  const renderDocumentItem = ({ item: document }: { item: DocumentWithType }) => {
    return (
      <TouchableOpacity 
        style={styles.documentCard}
        onPress={() => handleDocumentView(document)}
        activeOpacity={0.7}
      >
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleSection}>
            <View style={styles.documentIcon}>
              <Ionicons 
                name={document.typeConfig.icon as any} 
                size={24} 
                color="#2196f3" 
              />
            </View>
            <View style={styles.documentTitleDetails}>
              <Text style={styles.documentTitle}>{document.typeConfig.label}</Text>
              <Text style={styles.documentDescription}>
                {document.typeConfig.description}
              </Text>
              {document.typeConfig.required && (
                <Badge 
                  value="Required" 
                  badgeStyle={{ backgroundColor: '#f44336', marginTop: 4 }}
                  textStyle={{ fontSize: 8 }}
                />
              )}
            </View>
          </View>
          {getDocumentStatusBadge(document.verification_status)}
        </View>

        <View style={styles.documentDetails}>
          <View style={styles.documentRow}>
            <Text style={styles.documentLabel}>Uploaded:</Text>
            <Text style={styles.documentValue}>
              {formatDate(new Date(document.created_at), 'short')}
            </Text>
          </View>
          
          {document.verified_at && (
            <View style={styles.documentRow}>
              <Text style={styles.documentLabel}>Verified:</Text>
              <Text style={styles.documentValue}>
                {formatDate(new Date(document.verified_at), 'short')}
              </Text>
            </View>
          )}
          
          <View style={styles.documentRow}>
            <Text style={styles.documentLabel}>Document ID:</Text>
            <Text style={styles.documentValue}>
              {document.id.slice(-8).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.documentActions}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleDocumentView(document)}
          >
            <Ionicons name="eye" size={14} color="#2196f3" />
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
          
          {document.verification_status === 'rejected' && (
            <TouchableOpacity
              style={styles.reuploadButton}
              onPress={() => handleDocumentUpload(document.document_type)}
            >
              <Ionicons name="refresh" size={14} color="#ff9800" />
              <Text style={styles.reuploadButtonText}>Re-upload</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render missing document item
   */
  const renderMissingDocumentItem = ({ item: docType }: { item: typeof DOCUMENT_TYPES[0] }) => {
    return (
      <View style={styles.missingDocumentCard}>
        <View style={styles.missingDocumentHeader}>
          <View style={styles.documentTitleSection}>
            <View style={[styles.documentIcon, styles.missingDocumentIcon]}>
              <Ionicons 
                name={docType.icon as any} 
                size={24} 
                color="#9e9e9e" 
              />
            </View>
            <View style={styles.documentTitleDetails}>
              <Text style={styles.missingDocumentTitle}>{docType.label}</Text>
              <Text style={styles.documentDescription}>
                {docType.description}
              </Text>
              {docType.required && (
                <Badge 
                  value="Required" 
                  badgeStyle={{ backgroundColor: '#f44336', marginTop: 4 }}
                  textStyle={{ fontSize: 8 }}
                />
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => handleDocumentUpload(docType.type)}
          >
            <Ionicons name="cloud-upload" size={16} color="white" />
            <Text style={styles.uploadButtonText}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading state
  if (isLoading && !documentsResponse) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="folder" size={48} color="#2196f3" />
        <Text style={styles.loadingText}>Loading Documents...</Text>
      </View>
    );
  }

  // Show error state
  if (error || (documentsResponse && !documentsResponse.success)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load documents</Text>
        <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  const documents = documentsResponse?.data || [];
  const summary = calculateSummary(documents);
  const missingDocuments = getMissingDocuments(documents);

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Documents</Text>
          <Text style={styles.headerSubtitle}>
            {summary.uploadedDocuments} of {summary.totalDocuments} documents uploaded
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleDocumentUpload()}
          style={styles.addButton}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Document Status</Text>
          <Divider style={styles.summaryDivider} />
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#4caf50' }]}>
                {summary.verifiedDocuments}
              </Text>
              <Text style={styles.summaryLabel}>Verified</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#ff9800' }]}>
                {summary.pendingDocuments}
              </Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#f44336' }]}>
                {summary.rejectedDocuments}
              </Text>
              <Text style={styles.summaryLabel}>Rejected</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Completion Progress</Text>
              <Text style={styles.progressPercentage}>
                {summary.completionPercentage.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(summary.completionPercentage, 100)}%` }
                ]} 
              />
            </View>
          </View>

          {summary.uploadedRequiredDocuments < summary.requiredDocuments && (
            <View style={styles.warningSection}>
              <Ionicons name="warning" size={16} color="#ff9800" />
              <Text style={styles.warningText}>
                {summary.requiredDocuments - summary.uploadedRequiredDocuments} required document(s) missing
              </Text>
            </View>
          )}
        </View>

        {/* Missing Documents */}
        {missingDocuments.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Upload Required Documents</Text>
            <Divider style={styles.sectionDivider} />
            
            <FlatList
              data={missingDocuments}
              keyExtractor={(item) => item.type}
              renderItem={renderMissingDocumentItem}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollContainer}
          >
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterButton,
                  selectedFilter === filter.value && styles.filterButtonActive
                ]}
                onPress={() => setSelectedFilter(filter.value)}
              >
                <Text style={[
                  styles.filterText,
                  selectedFilter === filter.value && styles.filterTextActive
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Documents List */}
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-outline" size={64} color="#9e9e9e" />
            <Text style={styles.emptyStateText}>No documents found</Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Upload your first document to get started'
              }
            </Text>
            {selectedFilter === 'all' && (
              <Button
                title="Upload Document"
                buttonStyle={styles.uploadFirstButton}
                onPress={() => handleDocumentUpload()}
              />
            )}
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>
            <Divider style={styles.sectionDivider} />
            
            <FlatList
              data={documents}
              keyExtractor={(item) => item.id}
              renderItem={renderDocumentItem}
              scrollEnabled={false}
            />
          </View>
        )}

      </ScrollView>
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
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
  addButton: {
    backgroundColor: '#2196f3',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryDivider: {
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 6,
    flex: 1,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDivider: {
    marginBottom: 16,
  },
  filtersContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterScrollContainer: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadFirstButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  documentCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  missingDocumentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  missingDocumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  missingDocumentIcon: {
    backgroundColor: '#f5f5f5',
  },
  documentTitleDetails: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  missingDocumentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  documentDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  documentDetails: {
    marginBottom: 8,
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  documentLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  documentValue: {
    fontSize: 12,
    color: '#333',
  },
  documentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  viewButtonText: {
    fontSize: 10,
    color: '#2196f3',
    marginLeft: 4,
    fontWeight: '500',
  },
  reuploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reuploadButtonText: {
    fontSize: 10,
    color: '#ff9800',
    marginLeft: 4,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  uploadButtonText: {
    fontSize: 12,
    color: 'white',
    marginLeft: 4,
    fontWeight: '500',
  },
});