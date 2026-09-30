import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'APP_THEME_MODE';

export const THEME_MODES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
  OCEAN: 'ocean',
};

const THEME_PALETTES = {
  light: {
    mode: 'light',
    isDark: false,
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    primary: '#007AFF',
    primaryLight: '#E5F2FF',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    inputBackground: '#F2F2F7',
    inputBorder: '#E5E5EA',
    placeholder: '#8E8E93',
    tabBarBackground: '#FFFFFF',
    statusBarStyle: 'dark',
  },
  dark: {
    mode: 'dark',
    isDark: true,
    background: '#121214',
    card: '#1C1C1E',
    text: '#F5F5F7',
    textSecondary: '#9898A0',
    border: '#2C2C2E',
    primary: '#0A84FF',
    primaryLight: '#1C2C40',
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    inputBackground: '#2C2C2E',
    inputBorder: '#3A3A3C',
    placeholder: '#6E6E73',
    tabBarBackground: '#1C1C1E',
    statusBarStyle: 'light',
  },
  ocean: {
    mode: 'ocean',
    isDark: true,
    background: '#0B132B',
    card: '#1C2541',
    text: '#E0E6ED',
    textSecondary: '#8B9BB4',
    border: '#2A3B5C',
    primary: '#48CAE4',
    primaryLight: '#16324F',
    success: '#52B788',
    warning: '#FFAA00',
    danger: '#FF6B6B',
    inputBackground: '#131F38',
    inputBorder: '#2A3B5C',
    placeholder: '#6C7D93',
    tabBarBackground: '#131F38',
    statusBarStyle: 'light',
  },
};

const ThemeContext = createContext({
  themeMode: THEME_MODES.SYSTEM,
  effectiveTheme: 'light',
  colors: THEME_PALETTES.light,
  isDark: false,
  setThemeMode: async () => {},
});

export const ThemeProvider = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme();
  const [themeMode, setThemeModeState] = useState(THEME_MODES.SYSTEM);
  const [systemScheme, setSystemScheme] = useState(deviceColorScheme || 'light');

  // Load saved theme on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && Object.values(THEME_MODES).includes(saved)) {
          setThemeModeState(saved);
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err);
      }
    };
    loadSavedTheme();

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSystemScheme(colorScheme);
      }
    });

    return () => subscription.remove();
  }, []);

  const setThemeMode = async (mode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to save theme preference:', err);
    }
  };

  const effectiveTheme = useMemo(() => {
    if (themeMode === THEME_MODES.SYSTEM) {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => {
    return THEME_PALETTES[effectiveTheme] || THEME_PALETTES.light;
  }, [effectiveTheme]);

  const isDark = colors.isDark;

  const value = useMemo(
    () => ({
      themeMode,
      effectiveTheme,
      colors,
      isDark,
      setThemeMode,
    }),
    [themeMode, effectiveTheme, colors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
