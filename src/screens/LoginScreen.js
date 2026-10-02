import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '../services/notificationService';
import { signInWithGoogleOAuth } from '../services/googleAuthService';
import GoogleIcon from '../components/GoogleIcon';
import { useTheme } from '../context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen({ navigation, route, onAuthSuccess }) {
  const { colors, isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [biometricsEmail, setBiometricsEmail] = useState('');

  // Check biometric support on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        if (Platform.OS === 'web') return;
        const enabled = await AsyncStorage.getItem('BIOMETRICS_ENABLED');
        const savedEmail = await AsyncStorage.getItem('BIOMETRICS_EMAIL');
        if (enabled === 'true' && savedEmail) {
          const compatible = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (compatible && enrolled) {
            setHasBiometrics(true);
            setBiometricsEmail(savedEmail);
            setEmail(savedEmail);
          }
        }
      } catch (err) {
        console.warn('Error checking biometrics:', err);
      }
    };
    checkBiometrics();
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogleOAuth();
      if (result.type === 'cancelled') {
        setGoogleLoading(false);
        return;
      }
      if (result.type === 'success' && result.session) {
        console.log('Google login successful, session created:', result.session);
        if (onAuthSuccess) {
          onAuthSuccess(result.session, navigation);
        }
        try {
          await registerForPushNotificationsAsync(result.session.user);
        } catch (e) {
          console.error('Push notification registration error:', e);
        }
      }
    } catch (error) {
      console.error('Google Sign-in error:', error);
      Alert.alert(
        'Google Sign-In Error',
        error?.message || 'Failed to authenticate with Google. Make sure Google provider is configured in Supabase.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to log in',
        fallbackLabel: 'Use password',
      });
      if (result.success && biometricsEmail) {
        Alert.alert('Biometric Login', `Authenticated for ${biometricsEmail}. Please enter password to restore session.`);
      }
    } catch (err) {
      console.error('Biometric authentication error:', err);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // First, check if user exists in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        Alert.alert('Login Error', 'User not found. Please check your email or sign up.');
        setLoading(false);
        return;
      }

      // Now try to authenticate with Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert('Login Error', error.message);
      } else if (data.session) {
        console.log('Login successful, session created:', data.session);

        if (onAuthSuccess) {
          onAuthSuccess(data.session, navigation);
        }

        try {
          const pushToken = await registerForPushNotificationsAsync(data.user);
          if (pushToken) {
            console.log('Push Token obtained:', pushToken);
          }
        } catch (e) {
          console.error('Error during push notification registration:', e);
        }

        if (Platform.OS !== 'web') {
          await promptForBiometrics(data.user.email);
        }
      } else {
        Alert.alert('Login Error', 'Could not establish a session.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const promptForBiometrics = async (userEmail) => {
    try {
      const biometricsEnabled = await AsyncStorage.getItem('BIOMETRICS_ENABLED');
      const biometricsDeclined = await AsyncStorage.getItem('BIOMETRICS_DECLINED');

      if (biometricsEnabled === 'true' || biometricsDeclined === 'true') {
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return;

      Alert.alert(
        'Enable Biometric Login',
        'Would you like to use your fingerprint or Face ID for faster logins?',
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem('BIOMETRICS_DECLINED', 'true');
            },
          },
          {
            text: 'Yes, Enable',
            onPress: async () => {
              try {
                await AsyncStorage.setItem('BIOMETRICS_ENABLED', 'true');
                await AsyncStorage.setItem('BIOMETRICS_EMAIL', userEmail);
                await AsyncStorage.removeItem('BIOMETRICS_DECLINED');
                Alert.alert('Biometrics Enabled', 'You can now use fingerprint or Face ID.');
              } catch (e) {
                console.error('Error saving biometric preference:', e);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error with biometrics prompt:', error);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }

    supabase.auth
      .resetPasswordForEmail(email, {
        redirectTo: 'customerstracker://reset-password',
      })
      .then(() => {
        Alert.alert('Success', 'Password reset email sent');
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.icon}>📍</Text>
          <Text style={[styles.title, { color: colors.primary }]}>Customers Tracker</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to track your location & manage customers
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Required Google Sign-In Section */}
          <View style={styles.googleSection}>
            <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
              <MaterialIcons name="security" size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>REQUIRED / RECOMMENDED SIGN IN</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.googleButton,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                  borderColor: isDark ? '#3A3A3C' : '#DADCE0',
                },
                googleLoading && styles.buttonDisabled,
              ]}
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <GoogleIcon size={22} style={styles.googleIcon} />
                  <Text style={[styles.googleButtonText, { color: isDark ? '#FFFFFF' : '#3C4043' }]}>
                    Sign in with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR SIGN IN WITH EMAIL</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter your email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter your password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In with Password</Text>
              )}
            </TouchableOpacity>

            {hasBiometrics && (
              <TouchableOpacity
                style={[
                  styles.biometricButton,
                  { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                ]}
                onPress={handleBiometricAuth}
              >
                <MaterialIcons name="fingerprint" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.biometricButtonText, { color: colors.primary }]}>
                  Biometric Login Available
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: colors.textSecondary }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={[styles.signupLink, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.downloadContainer}>
              <Text style={[styles.downloadText, { color: colors.textSecondary }]}>Android App: </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://narasimhareddyaiapp6.github.io/customerstracker/releases/customerstracker.7z'
                  )
                }
              >
                <Text style={[styles.downloadLink, { color: colors.success }]}>Download .7z Build</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          © 2025 localwala's. Version 1.0
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  googleSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  biometricButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '500',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    fontSize: 15,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  downloadContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  downloadText: {
    fontSize: 13,
  },
  downloadLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
  },
});