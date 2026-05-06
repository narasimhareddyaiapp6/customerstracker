import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StackActions } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Image,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../services/supabaseClient';
import { Buffer } from 'buffer';
import { OfflineStorageService } from '../services/OfflineStorageService';
import { registerForPushNotificationsAsync } from '../services/notificationService'; // New import
import * as Notifications from 'expo-notifications'; // New import

// Utility function to convert BYTEA hex to base64
function hexToBase64(hexString) {
  if (!hexString) return '';
  // Remove all leading backslashes and 'x'
  const hex = hexString.replace(/^\\*x/, '');
  return Buffer.from(hex, 'hex').toString('base64');
}

export default function ProfileScreen({ navigation, user, userProfile, reloadUserProfile, onLogout }) {
  // Debug log to check if component is mounting properly
  console.log('ProfileScreen mounted with props:', { 
    hasNavigation: !!navigation, 
    hasUser: !!user, 
    hasUserProfile: !!userProfile 
  });

  const [profileImage, setProfileImage] = useState(null);
  const [settings, setSettings] = useState({
    notifications: true,
  });
  const [showImageModal, setShowImageModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('undetermined'); // New state
  const [notificationTitle, setNotificationTitle] = useState('Test Title');
  const [notificationMessage, setNotificationMessage] = useState('This is a test notification.');

  const checkNotificationStatus = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationStatus(status);
  }, []);

  useEffect(() => {
    if (userProfile?.profile_photo_data) {
      setProfileImage(userProfile.profile_photo_data);
    } else {
      setProfileImage(null);
    }
    checkNotificationStatus(); // Check status on mount
  }, [userProfile, checkNotificationStatus]);

  // Using useCallback to ensure function reference stability
  const handleLogout = async () => {
    const offlineExpenses = await OfflineStorageService.getOfflineExpenses();

    if (offlineExpenses.length > 0) {
      Alert.alert(
        'Offline Expenses',
        'You have offline expenses that have not been synced. What would you like to do?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout and Discard',
            style: 'destructive',
            onPress: async () => {
              console.log('ProfileScreen: Attempting to sign out (discarding offline expenses).'); // NEW LOG
              await OfflineStorageService.clearOfflineExpenses();
              if (onLogout) {
                await onLogout();
              } else {
                await supabase.auth.signOut();
              }
              console.log('ProfileScreen: Sign out call completed (discarding offline expenses).'); // NEW LOG
            },
          },
          {
            text: 'Connect to Sync',
            onPress: () => {},
            style: 'default',
          },
        ]
      );
    } else {
      try {
        console.log('ProfileScreen: Attempting to sign out (no offline expenses).'); // NEW LOG
        if (onLogout) {
          await onLogout();
        } else {
          await supabase.auth.signOut();
        }
        console.log('ProfileScreen: Sign out call completed (no offline expenses).'); // NEW LOG
        // Alert.alert('Success', 'Logged out successfully!'); // Temporarily removed
      } catch (error) {
        Alert.alert('Error', 'Failed to log out: ' + error.message);
        console.error('Logout error:', error);
      }
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user data from Supabase
              const { error } = await supabase.auth.admin.deleteUser(user.id);
              
              if (error) {
                Alert.alert('Error', 'Failed to delete account');
                return;
              }

              Alert.alert('Success', 'Account deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
              console.error('Delete account error:', error);
            }
          },
        },
      ]
    );
  };

  const handleSettingToggle = (setting) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  

  const handleClearData = useCallback(async () => {
    Alert.alert(
      'Clear Data',
      'Are you sure you want to clear all location data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('location_history')
                .delete()
                .eq('user_id', user.id);

              if (error) {
                Alert.alert('Error', 'Failed to clear data');
                return;
              }

              Alert.alert('Success', 'Data cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  }, [user]);

  const uploadProfileImage = async (uri, userId, mimeType) => {
    try {
      const fileExt = mimeType.split('/')[1];
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;
      const filePath = `profiles/${userId}/${fileName}`;
      const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const fileBuffer = Buffer.from(fileData, 'base64');
      
      const { data, error } = await supabase.storage
        .from('customerstracker')
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });
      
      if (error) {
        Alert.alert('Error', 'Failed to upload profile image: ' + error.message);
        return null;
      }
      
      const { data: urlData } = supabase.storage.from('customerstracker').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || '';
      
      const { error: updateError } = await supabase.from('users').update({ profile_photo_data: publicUrl }).eq('id', userId);
      if (updateError) {
        console.error('Failed to update profile_photo_data in users table:', updateError);
      } else {
        console.log('profile_photo_data updated in users table:', publicUrl);
      }
      return publicUrl;
    } catch (error) {
      Alert.alert('Error', 'Failed to upload profile image: ' + error.message);
      return null;
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const publicUrl = await uploadProfileImage(asset.uri, user.id, asset.mimeType || 'image/jpeg');
        if (publicUrl) {
          setProfileImage(publicUrl);
          if (reloadUserProfile) reloadUserProfile();
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      const { data, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Failed to get push token. Please make sure you have enabled notifications.');
        return;
      }

      const { push_token } = data;

      const { data: result, error: functionError } = await supabase.functions.invoke('send-test-notification', {
        body: JSON.stringify({ push_token, title: notificationTitle, message: notificationMessage }),
      });

      if (functionError) {
        Alert.alert('Error', `Failed to send notification: ${functionError.message}`);
      } else {
        Alert.alert('Success', 'Test notification sent successfully!');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to send notification: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      
      {/* Profile Image Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Picture</Text>
        <View style={styles.profileImageContainer}>
          {profileImage && (
            <TouchableOpacity onPress={() => setShowImageModal(true)}>
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                onError={e => console.error('Image load error:', e.nativeEvent)}
              />
            </TouchableOpacity>
          )}
          {!profileImage && (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>👤</Text>
            </View>
          )}
          <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
            <Text style={styles.changeImageText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Information</Text>
        <View style={styles.userInfoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{userProfile?.name || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userProfile?.email || user?.email || 'Loading...'}</Text>
          </View>
          {userProfile?.mobile && ( // Conditionally render if mobile exists
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobile:</Text>
              <Text style={styles.infoValue}>{userProfile.mobile}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID:</Text>
            <Text style={styles.infoValue}>{userProfile?.id || user?.id || 'Loading...'}</Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Switch
              value={settings.notifications}
              onValueChange={() => handleSettingToggle('notifications')}
              trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
              thumbColor={settings.notifications ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
          
          {notificationStatus !== 'granted' && (
            <TouchableOpacity
              style={styles.enableNotificationsButton}
              onPress={async () => {
                const token = await registerForPushNotificationsAsync(user); // Pass the user prop
                if (token) {
                  Alert.alert('Success', 'Notifications enabled!');
                  checkNotificationStatus(); // Re-check status after enabling
                } else {
                  Alert.alert('Error', 'Failed to enable notifications. Please check app settings.');
                }
              }}
            >
              <Text style={styles.enableNotificationsButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsCard}>
          
          
          <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
            <Text style={styles.actionButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Test Notification Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <View style={styles.settingsCard}>
          <TextInput
            style={styles.input}
            placeholder="Notification Title"
            value={notificationTitle}
            onChangeText={setNotificationTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Notification Message"
            value={notificationMessage}
            onChangeText={setNotificationMessage}
          />
          <TouchableOpacity style={styles.actionButton} onPress={handleSendTestNotification}>
            <Text style={styles.actionButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPressOut={() => setShowImageModal(false)}
        >
          <Image
            source={{ uri: profileImage }}
            style={{ width: 300, height: 300, borderRadius: 12, resizeMode: 'contain' }}
            onError={e => console.error('Modal image load error:', e.nativeEvent)}
          />
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#fff', padding: 10, borderRadius: 8 }}
            onPress={() => setShowImageModal(false)}
          >
            <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileImageText: {
    fontSize: 40,
  },
  changeImageButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#8E8E93',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  enableNotificationsButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  enableNotificationsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});