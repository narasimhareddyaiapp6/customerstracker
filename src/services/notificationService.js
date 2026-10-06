import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabaseClient';

// Configure how notifications are handled when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers device / browser for notifications and saves token in Supabase.
 * @param {Object} user Current logged-in Supabase user
 * @returns {Promise<string|null>} Push token or null
 */
export async function registerForPushNotificationsAsync(user) {
  let pushToken = null;

  console.log('🔔 Notification Service: registerForPushNotificationsAsync called.');

  // ✅ Web platform support using standard Web Notification API
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
          pushToken = `web_${user?.id || 'browser'}`;
          console.log('✅ Web Notification permission granted. Token:', pushToken);

          if (user) {
            const { error } = await supabase
              .from('user_push_tokens')
              .upsert(
                { user_id: user.id, push_token: pushToken, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
              );
            if (error) {
              console.warn('⚠️ Error saving web push token to Supabase:', error.message);
            } else {
              console.log('✅ Web push token saved to Supabase');
            }
          }
          return pushToken;
        } else {
          console.warn('❌ Web Notification permission not granted:', permission);
          return null;
        }
      } catch (err) {
        console.warn('❌ Web Notification registration error:', err);
        return null;
      }
    } else {
      console.log('ℹ️ Web notifications not supported in this browser environment.');
      return null;
    }
  }

  // ✅ Mobile: verify physical device
  if (!Device.isDevice) {
    Alert.alert("Push Token", "❌ Must use physical device for native push notifications");
    console.warn("❌ Native push notifications require a physical device.");
    return null;
  }

  // ✅ Android: configure notification channel with sound & vibration
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      enableVibrate: true,
      sound: 'default',
    });
  }

  try {
    // 1. Permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert("Push Token", "❌ Permission not granted for notifications");
      console.warn("❌ Notification permissions not granted:", finalStatus);
      return null;
    }

    console.log("✅ Notification permissions granted:", finalStatus);

    // 2. EAS Project ID configuration
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.manifest?.extra?.eas?.projectId ||
      Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
      '22ad9b0d-c4e9-4bba-bad2-9e93641a6cb0';

    // 3. Obtain Expo Push Token (works for Expo Go, development builds, and standalone APKs)
    try {
      const expoTokenObject = await Notifications.getExpoPushTokenAsync({ projectId });
      pushToken = expoTokenObject.data;
      console.log("✅ Expo Push Token obtained:", pushToken);
    } catch (expoTokenErr) {
      console.warn("⚠️ getExpoPushTokenAsync failed, falling back to device push token:", expoTokenErr);
      const rawTokenObject = await Notifications.getDevicePushTokenAsync();
      pushToken = rawTokenObject.data;
      console.log(`✅ Raw ${Platform.OS === 'android' ? 'FCM' : 'APNs'} Device Token:`, pushToken);
    }

    if (!pushToken) {
      console.warn("❌ Failed to retrieve push token.");
      return null;
    }

    // 4. Save token to Supabase
    if (user) {
      console.log(`Saving token to Supabase for user ${user.id}:`, pushToken);

      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert(
          { user_id: user.id, push_token: pushToken, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .select();

      if (error) {
        console.error("❌ Error saving token to Supabase:", error);
        Alert.alert("Supabase Error", error.message);
      } else {
        console.log("✅ Push token saved to Supabase successfully:", data);
      }
    } else {
      console.log("ℹ️ No user provided, skipping Supabase save.");
    }

    return pushToken;
  } catch (error) {
    console.error("❌ Error in push registration:", error);
    Alert.alert("Push Token Error", error.message);
    return null;
  }
}

/**
 * Displays a local notification immediately on Web or Mobile.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.body
 * @param {Object} [params.data]
 */
export async function showLocalNotification({ title, body, data = {} }) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: './assets/icon.png',
          });
        }
      }
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        channelId: 'default',
        sound: 'default',
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('⚠️ showLocalNotification error:', err);
  }
}

/**
 * Option A: Triggers the 'send-notification' Edge Function directly from the app.
 * Sends push notifications to Area group Email users for the given record.
 * 
 * @param {Object} params
 * @param {Object} params.record The record object (transaction, expense, customer)
 * @param {string} params.table The table name ('transactions', 'user_expenses', 'customers')
 */
export async function triggerNotification({ record, table }) {
  try {
    if (!record || !table) {
      console.warn('⚠️ triggerNotification: missing record or table');
      return { success: false, error: 'Missing record or table' };
    }

    console.log(`🔔 Triggering notification for table '${table}'...`, record);

    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { record, table },
    });

    if (error) {
      console.warn('⚠️ send-notification invocation error:', error);
      return { success: false, error };
    }

    console.log('✅ Notification triggered successfully:', data);
    return { success: true, data };
  } catch (err) {
    console.warn('⚠️ Exception invoking send-notification:', err);
    return { success: false, error: err };
  }
}
