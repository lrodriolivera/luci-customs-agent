import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

const LoadingSpinner = ({
  size = 'large',
  color = '#2563EB',
  text,
  fullScreen = false
}) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size={size} color={color} />
        {text && <Text style={styles.text}>{text}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

// Skeleton loading component
export const Skeleton = ({ width, height, borderRadius = 4, style }) => {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style
      ]}
    />
  );
};

// List item skeleton
export const ListItemSkeleton = ({ count = 3 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.listItemSkeleton}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={styles.listItemContent}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

// Card skeleton
export const CardSkeleton = () => {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="40%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={40} style={{ marginTop: 16 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  text: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden'
  },
  listItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12
  },
  listItemContent: {
    flex: 1
  },
  cardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  }
});

export default LoadingSpinner;
