import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

/**
 * Hook for managing push notifications
 */
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const notificationListener = useRef();
  const responseListener = useRef();
  const appState = useRef(AppState.currentState);

  // Register for push notifications
  const registerForPushNotifications = useCallback(async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Get the push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      setExpoPushToken(token);

      // Register token with backend
      await api.registerPushToken(token);

      // Android specific setup
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB'
        });
      }

      return token;
    } catch (err) {
      console.error('Error registering for push notifications:', err);
      return null;
    }
  }, []);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getNotifications();
      const notifs = response.data?.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (err) {
      setError(err.message || 'Error al cargar notificaciones');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.deleteNotification(notificationId);
      setNotifications(prev =>
        prev.filter(n => n.id !== notificationId)
      );
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, []);

  // Handle received notification
  const handleNotificationReceived = useCallback((notification) => {
    const data = notification.request.content.data;
    setNotifications(prev => [{
      id: notification.request.identifier,
      title: notification.request.content.title,
      message: notification.request.content.body,
      type: data?.type || 'info',
      expeditionRef: data?.expeditionRef,
      timestamp: new Date().toISOString(),
      read: false
    }, ...prev]);
    setUnreadCount(prev => prev + 1);
  }, []);

  // Handle notification response (when user taps notification)
  const handleNotificationResponse = useCallback((response) => {
    const data = response.notification.request.content.data;
    // Return data for navigation handling
    return {
      type: data?.type,
      expeditionId: data?.expeditionId,
      action: data?.action
    };
  }, []);

  // Setup notification listeners
  useEffect(() => {
    registerForPushNotifications();

    // Listener for received notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    // Listener for notification responses
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // App state listener for background/foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground, refresh notifications
        fetchNotifications();
      }
      appState.current = nextAppState;
    });

    // Initial fetch
    fetchNotifications();

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
      subscription.remove();
    };
  }, []);

  // Schedule local notification
  const scheduleLocalNotification = useCallback(async (title, body, data = {}, trigger = null) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true
      },
      trigger: trigger || null // null = immediate
    });
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    expoPushToken,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    scheduleLocalNotification,
    refresh: fetchNotifications
  };
};

export default useNotifications;
