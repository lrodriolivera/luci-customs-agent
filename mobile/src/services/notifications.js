/**
 * Push Notifications Service
 * Handles push notification registration and handling
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 * @returns {Promise<string|null>} Push token or null if registration fails
 */
export async function registerForPushNotifications() {
  let token = null;

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    // Register token with backend
    await api.notifications.registerPushToken(token);

    console.log('Push token registered:', token);
  } catch (error) {
    console.error('Error registering for push notifications:', error);
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });

    // High priority channel for urgent notifications
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgente',
      description: 'Requerimientos AEAT y alertas criticas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#ef4444',
    });
  }

  return token;
}

/**
 * Schedule a local notification
 * @param {Object} options Notification options
 */
export async function scheduleLocalNotification({
  title,
  body,
  data = {},
  trigger = null,
}) {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  });

  return id;
}

/**
 * Cancel a scheduled notification
 * @param {string} notificationId Notification ID to cancel
 */
export async function cancelNotification(notificationId) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 * @returns {Promise<number>} Current badge count
 */
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 * @param {number} count Badge count to set
 */
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Add notification received listener
 * @param {Function} callback Callback function when notification received
 * @returns {Object} Subscription object
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 * @param {Function} callback Callback function when notification tapped
 * @returns {Object} Subscription object
 */
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Handle incoming notification
 * @param {Object} notification Notification object
 */
export function handleNotification(notification) {
  const { data } = notification.request.content;

  // Handle different notification types
  switch (data?.type) {
    case 'requirement':
      // Navigate to requirement
      console.log('Requirement notification:', data);
      break;
    case 'channel':
      // Navigate to expedition
      console.log('Channel notification:', data);
      break;
    case 'deadline':
      // Navigate to deadline
      console.log('Deadline notification:', data);
      break;
    default:
      console.log('Generic notification:', data);
  }
}

/**
 * Handle notification response (user tap)
 * @param {Object} response Notification response object
 * @param {Object} navigation Navigation object for routing
 */
export function handleNotificationResponse(response, navigation) {
  const { data } = response.notification.request.content;

  // Navigate based on notification type
  switch (data?.type) {
    case 'requirement':
      if (data.expeditionId) {
        navigation.navigate('Expedientes', {
          screen: 'ExpeditionDetail',
          params: { id: data.expeditionId },
        });
      }
      break;
    case 'channel':
      if (data.expeditionId) {
        navigation.navigate('Expedientes', {
          screen: 'ExpeditionDetail',
          params: { id: data.expeditionId },
        });
      }
      break;
    case 'message':
      navigation.navigate('Chat');
      break;
    default:
      // Default to notifications screen
      navigation.navigate('Perfil', { screen: 'Notifications' });
  }
}

export default {
  registerForPushNotifications,
  scheduleLocalNotification,
  cancelNotification,
  cancelAllNotifications,
  getBadgeCount,
  setBadgeCount,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  handleNotification,
  handleNotificationResponse,
};
