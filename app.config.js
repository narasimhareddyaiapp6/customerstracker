try {
  require('dotenv').config();
} catch (e) {
  // dotenv not found, skipping
}

export default {
  "expo": {
    "name": "Customers Tracker",
    "slug": "customerstracking",
    "owner": "narasimhaexpo",
    "scheme": "usertracking",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "icon": "./assets/icon.png",
    "jsEngine": "jsc",
    "splash": {
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "assets/**/*",
      "src/assets/**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#FFFFFF"
      },
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true, 
      "permissions": [
        "android.permission.WAKE_LOCK",
        "android.permission.RECORD_AUDIO",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      "package": "com.narasimhaexpo.locationtrackermobile"
    },
    "web": {
      "bundler": "metro",
      "favicon": "./assets/icon.png",
      "jsEngine": "jsc"
    },
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow User Tracking to access your photos to upload profile images."
        }
      ],
      "@react-native-community/datetimepicker",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysPermission": "Allow User Tracking to use your location."
        }
      ]
    ],
    "updates": {
      "url": "https://u.expo.dev/22ad9b0d-c4e9-4bba-bad2-9e93641a6cb0"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "sdkVersion": "53.0.0",
    
    "extra": {
      SUPABASE_URL: "https://wtcxhhbigmqrmqdyhzcz.supabase.co",
      SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0Y3hoaGJpZ21xcm1xZHloemN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjE3ODgsImV4cCI6MjA2NzczNzc4OH0.AIViaiRT2odHJM2wQXl3dDZ69YxEj7t_7UiRFqEgZjY",
      "eas": {
        "projectId": "22ad9b0d-c4e9-4bba-bad2-9e93641a6cb0"
      }
    }
  }
}; 