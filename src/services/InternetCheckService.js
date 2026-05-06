import { Platform } from 'react-native';

export const InternetCheckService = {
  checkInternetConnection: async () => {
    if (Platform.OS === 'web') {
      return navigator.onLine;
    }
    try {
      // Use a timeout to avoid long waits
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://8.8.8.8', { 
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal 
      });
      clearTimeout(id);
      return true;
    } catch (error) {
      return false;
    }
  },
};