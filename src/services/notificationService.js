import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabaseClient';

// Configure how notifications are handled when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(user) {
  let pushToken = null;

  console.log('🔔 Notification Service: registerForPushNotificationsAsync called.');

  // ✅ Only physical devices and development builds support native push
  if (Platform.OS === 'web') {
    console.log("ℹ️ Push notifications are not supported on web in this implementation.");
    return null;
  }

  if (!Device.isDevice) {
    Alert.alert("Push Token", "❌ Must use physical device for push notifications");
    console.warn("❌ Push notifications require a physical device.");
    return null;
  }

  // ✅ Android: configure notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
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

    // 2. Get the correct token based on environment
    const isExpoGo = Constants.executionEnvironment === 'storeClient';

    if (isExpoGo) {
      // In Expo Go, get the Expo token
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.manifest?.extra?.eas?.projectId ||
        Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
        '22ad9b0d-c4e9-4bba-bad2-9e93641a6cb0';
      const expoTokenObject = await Notifications.getExpoPushTokenAsync({ projectId });
      pushToken = expoTokenObject.data;
      console.log("⚠️ Running in Expo Go. Using Expo Token:", pushToken);
      Alert.alert(
        "Push Token",
        `⚠️ Running in Expo Go. Using Expo Token:\n${pushToken}`
      );
    } else {
      // In a native build (standalone or development client), get the raw FCM/APNs token
      const rawTokenObject = await Notifications.getDevicePushTokenAsync();
      pushToken = rawTokenObject.data;
      console.log(`✅ Raw ${Platform.OS === 'android' ? 'FCM' : 'APNs'} Token:`, pushToken);
    }
    
    if (!pushToken) {
      console.warn("❌ Failed to retrieve push token.");
      return null;
    }
    
    // 3. Save token to Supabase
    if (user) {
      console.log(`Saving token to Supabase for user ${user.id}:`, pushToken);

      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert(
          { user_id: user.id, push_token: pushToken },
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
