// src/components/common/UniversalStates.tsx
// Universal loading, error, and empty states for consistent UX

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Button } from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';

interface UniversalLoadingProps {
  title?: string;
  subtitle?: string;
}

interface UniversalErrorProps {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retryText?: string;
}

interface UniversalEmptyProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
}

// Professional loading state with animation
export const UniversalLoading: React.FC<UniversalLoadingProps> = ({ 
  title = "Loading...", 
  subtitle = "Please wait while we fetch your data" 
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.loadingContent}>
        <Ionicons name="refresh" size={48} color="#2196f3" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.loadingDots}>
          <Text style={styles.loadingDot}>•</Text>
          <Text style={styles.loadingDot}>•</Text>
          <Text style={styles.loadingDot}>•</Text>
        </View>
      </View>
    </View>
  );
};

// Professional error state with retry
export const UniversalError: React.FC<UniversalErrorProps> = ({ 
  title = "Connection Problem",
  subtitle = "Please check your internet connection and try again",
  onRetry,
  retryText = "Retry Connection"
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.errorContent}>
        <Ionicons name="wifi" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {onRetry && (
          <Button
            title={retryText}
            onPress={onRetry}
            buttonStyle={styles.retryButton}
            titleStyle={styles.retryButtonText}
            icon={<Ionicons name="refresh" size={16} color="white" style={{ marginRight: 8 }} />}
          />
        )}
      </View>
    </View>
  );
};

// Professional empty state
export const UniversalEmpty: React.FC<UniversalEmptyProps> = ({ 
  icon,
  title,
  subtitle,
  actionTitle,
  onAction
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.emptyContent}>
        <Ionicons name={icon} size={64} color="#9e9e9e" />
        <Text style={styles.emptyTitle}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {actionTitle && onAction && (
          <Button
            title={actionTitle}
            onPress={onAction}
            buttonStyle={styles.actionButton}
            titleStyle={styles.actionButtonText}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 90 : 95, // Space for bottom tabs
  },
  loadingContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingDot: {
    fontSize: 24,
    color: '#2196f3',
    marginHorizontal: 4,
    opacity: 0.7,
  },
  retryButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 24,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});