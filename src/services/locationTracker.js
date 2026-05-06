import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabaseClient';
import { NetInfoService } from './NetInfoService';
import { OfflineStorageService } from './OfflineStorageService';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Define the background task (Mobile only)
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      const location = locations[0];
      if (location) {
        saveLocationRecord(location);
      }
    }
  });
}

async function saveLocationRecord(location) {
  const userId = await OfflineStorageService.getUserId();
  const userEmail = await OfflineStorageService.getUserEmail();
  
  if (!userId || !userEmail) return;

  const { coords, timestamp } = location;
  const deviceName = Device.deviceName || (Platform.OS === 'web' ? 'Browser' : 'MobileApp');
  const deviceId = Platform.OS === 'android' ? Application.androidId : 
                   Platform.OS === 'ios' ? 'ios_device' : 'web_browser';
  const deviceIdentifier = `${deviceName}_${deviceId}`;

  const locationData = {
    user_id: userId,
    user_email: userEmail,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy || 0,
    timestamp: new Date(timestamp).toISOString(),
    device_name: deviceIdentifier,
  };

  const isConnected = await NetInfoService.isNetworkAvailable();

  if (isConnected) {
    try {
      await supabase.from('location_history').insert([locationData]);
    } catch (err) {
      await OfflineStorageService.saveOfflineLocation(locationData);
    }
  } else {
    await OfflineStorageService.saveOfflineLocation(locationData);
  }
}

let webInterval = null;

export const locationTracker = {
  init: async () => {
    if (Platform.OS !== 'web') {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      console.log(`Location task registered: ${isRegistered}`);
    }
  },

  startTracking: async (userId, userEmail) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;

      // Save user info
      await OfflineStorageService.saveUserId(userId);
      await OfflineStorageService.saveUserEmail(userEmail);

      if (Platform.OS === 'web') {
        // Web Fallback: Tracking only while tab is open
        if (webInterval) clearInterval(webInterval);
        webInterval = setInterval(async () => {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc) saveLocationRecord(loc);
        }, 300000); // 5 minutes
        console.log('🌐 Web foreground tracking started');
        return true;
      }

      // Mobile: Background Tracking
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background permission denied, falling back to foreground tracking');
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 300000,
        distanceInterval: 50,
        foregroundService: {
          notificationTitle: "Customers Tracker Active",
          notificationBody: "Monitoring location for service updates.",
          notificationColor: "#007AFF"
        },
      });

      console.log('🚀 Mobile background tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  },

  stopTracking: async () => {
    if (Platform.OS === 'web') {
      if (webInterval) clearInterval(webInterval);
      webInterval = null;
      return;
    }
    try {
      const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  },

  getTrackingStatus: async () => {
    try {
      return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (error) {
      return false;
    }
  },

  getCurrentLocation: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    } catch (error) {
      return null;
    }
  }
};
