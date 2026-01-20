import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Header = ({
  title,
  subtitle,
  leftAction,
  leftIcon = 'arrow-back',
  onLeftPress,
  rightAction,
  rightIcon,
  onRightPress,
  transparent = false,
  centerTitle = true
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        !transparent && styles.containerSolid,
        { paddingTop: insets.top }
      ]}
    >
      <StatusBar
        barStyle={transparent ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.content}>
        {/* Left Action */}
        <View style={styles.leftContainer}>
          {(leftAction || onLeftPress) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onLeftPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {leftAction || (
                <Ionicons
                  name={leftIcon}
                  size={24}
                  color={transparent ? '#FFFFFF' : '#111827'}
                />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <View style={[styles.titleContainer, centerTitle && styles.titleCentered]}>
          <Text
            style={[styles.title, transparent && styles.titleWhite]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, transparent && styles.subtitleWhite]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Action */}
        <View style={styles.rightContainer}>
          {(rightAction || rightIcon) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onRightPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {rightAction || (
                <Ionicons
                  name={rightIcon}
                  size={24}
                  color={transparent ? '#FFFFFF' : '#111827'}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// Section Header for lists
export const SectionHeader = ({ title, action, onActionPress }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Page Header (large title)
export const PageHeader = ({ title, subtitle, rightAction }) => {
  return (
    <View style={styles.pageHeader}>
      <View>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
      </View>
      {rightAction}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 100
  },
  containerSolid: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 8
  },
  leftContainer: {
    width: 48,
    alignItems: 'flex-start'
  },
  rightContainer: {
    width: 48,
    alignItems: 'flex-end'
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 8
  },
  titleCentered: {
    alignItems: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827'
  },
  titleWhite: {
    color: '#FFFFFF'
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  subtitleWhite: {
    color: 'rgba(255, 255, 255, 0.8)'
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sectionAction: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500'
  },
  // Page Header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4
  }
});

export default Header;
