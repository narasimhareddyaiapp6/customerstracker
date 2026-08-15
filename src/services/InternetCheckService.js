import { Platform } from 'react-native';

export const InternetCheckService = {
  checkInternetConnection: async () => {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    try {
      // Use a timeout to avoid long waits
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch('https://clients3.google.com/generate_204', { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(id);
      return response.status === 204 || response.status === 200 || response.ok;
    } catch (error) {
      try {
        const controller2 = new AbortController();
        const id2 = setTimeout(() => controller2.abort(), 4000);
        await fetch('https://www.google.com', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller2.signal
        });
        clearTimeout(id2);
        return true;
      } catch (err) {
        return false;
      }
    }
  },
};