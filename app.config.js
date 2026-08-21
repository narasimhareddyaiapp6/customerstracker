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
      "package": "com.narasimhaexpo.customerstracker"
    },
    "web": {
      "bundler": "metro",
      "favicon": "./assets/icon.png",
      "jsEngine": "jsc"
    },
    "plugins": [
      "expo-font",
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
    "runtimeVersion": "1.0.0",
    "sdkVersion": "53.0.0",
    
    "extra": {
         SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
         SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
         "eas": {
        "projectId": "22ad9b0d-c4e9-4bba-bad2-9e93641a6cb0"
      }
    }
  }
}; 
