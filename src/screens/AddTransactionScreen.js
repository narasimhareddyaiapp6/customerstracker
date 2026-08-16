import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import styles from './CustomerStyles';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchAreasForUser } from '../services/AreaService';
import { uploadImageToStorage } from '../services/StorageService';

export default function AddTransactionScreen({ user, userProfile, navigation }) {
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('Cash');
  const [upiScreenshot, setUpiScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    async function fetchAreas() {
      const userId = user?.id || userProfile?.id;
      if (!userId && !userProfile && !user) return;
      try {
        const userType = userProfile?.user_type || user?.user_type;
        const fetchedAreas = await fetchAreasForUser({ userId, userType });
        setAreas(fetchedAreas || []);
        if (fetchedAreas && fetchedAreas.length > 0) {
          setSelectedArea(fetchedAreas[0].id);
        }
      } catch (error) {
        console.error('Error fetching areas in AddTransactionScreen:', error);
      }
    }
    fetchAreas();
  }, [user, userProfile]);

  useEffect(() => {
    async function fetchCustomers() {
      if (!selectedArea) {
        setCustomers([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, book_no, mobile')
          .eq('area_id', selectedArea)
          .order('name');
        if (error) {
          console.error('Error fetching customers:', error);
          setCustomers([]);
        } else {
          setCustomers(data || []);
          if (data && data.length > 0) {
            setSelectedCustomer(data[0].id);
          } else {
            setSelectedCustomer('');
          }
        }
      } catch (error) {
        console.error('Error in fetchCustomers:', error);
        setCustomers([]);
      }
    }
    fetchCustomers();
  }, [selectedArea]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Permission to access media library is required to upload screenshots.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setUpiScreenshot(result.assets[0]);
    }
  };

  const uploadTransactionImage = async (uri, customerId, mimeType = 'image/jpeg') => {
    try {
      const fileExt = (mimeType && mimeType.includes('/')) ? mimeType.split('/')[1] : 'jpg';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;
      const filePath = `transactions/${customerId}/${fileName}`;

      const { publicUrl, error: uploadError } = await uploadImageToStorage({
        uri,
        filePath,
        bucketName: 'customerstracker',
        mimeType: mimeType || 'image/jpeg',
      });

      if (uploadError || !publicUrl) {
        Alert.alert('Error', 'Failed to upload UPI image: ' + (uploadError?.message || 'Unknown error'));
        return null;
      }

      return publicUrl;
    } catch (error) {
      Alert.alert('Error', 'Failed to upload UPI image: ' + error.message);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!selectedArea || !selectedCustomer || !amount || !amountType) {
      Alert.alert('Missing Fields', 'Please fill out all fields.');
      setIsSubmitting(false);
      return;
    }

    if (amountType === 'UPI' && !upiScreenshot) {
      Alert.alert('Missing Screenshot', 'Please upload a UPI screenshot.');
      setIsSubmitting(false);
      return;
    }

    let upiImageUrl = null;
    if (amountType === 'UPI' && upiScreenshot) {
      upiImageUrl = await uploadTransactionImage(upiScreenshot.uri, selectedCustomer, upiScreenshot.mimeType || 'image/jpeg');
      if (!upiImageUrl) {
        setIsSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: selectedCustomer,
      user_id: user.id,
      amount: amount,
      transaction_type: 'repayment',
      payment_mode: amountType,
      upi_image: upiImageUrl,
      transaction_date: transactionDate.toISOString().split('T')[0],
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Transaction added successfully!');
      navigation.goBack();
    }

    setIsSubmitting(false);
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || transactionDate;
    setShowDatePicker(Platform.OS === 'ios');
    setTransactionDate(currentDate);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.modalTitle}>Add Transaction</Text>

      <Text style={styles.formLabel}>Area</Text>
      <Picker
        selectedValue={selectedArea}
        onValueChange={(itemValue) => setSelectedArea(itemValue)}
        style={styles.formPicker}
      >
        <Picker.Item label="Select Area" value="" />
        {areas.map((area) => (
          <Picker.Item key={area.id} label={area.area_name} value={area.id} />
        ))}
      </Picker>

      <Text style={styles.formLabel}>Customer (Card No - Name)</Text>
      <Picker
        selectedValue={selectedCustomer}
        onValueChange={(itemValue) => setSelectedCustomer(itemValue)}
        style={styles.formPicker}
        enabled={!!selectedArea}
      >
        <Picker.Item label="Select Customer" value="" />
        {customers.map((customer) => (
          <Picker.Item key={customer.id} label={`${customer.book_no} - ${customer.name}`} value={customer.id} />
        ))}
      </Picker>

      <Text style={styles.formLabel}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
        keyboardType="numeric"
        placeholder="Enter Amount"
      />

      <Text style={styles.formLabel}>Amount Type</Text>
      <Picker
        selectedValue={amountType}
        onValueChange={(itemValue) => setAmountType(itemValue)}
        style={styles.formPicker}
      >
        <Picker.Item label="Cash" value="Cash" />
        <Picker.Item label="UPI" value="UPI" />
      </Picker>

      {amountType === 'UPI' && (
        <View style={{ marginVertical: 10 }}>
          <Button title={upiScreenshot ? "Change UPI Screenshot" : "Upload UPI Screenshot"} onPress={handlePickImage} />
          {upiScreenshot && (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Image source={{ uri: upiScreenshot.uri }} style={{ width: 120, height: 120, borderRadius: 6, borderWidth: 1, borderColor: '#007AFF' }} />
              <TouchableOpacity
                style={{
                  backgroundColor: '#FF3B30',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  marginTop: 8,
                }}
                onPress={() => setUpiScreenshot(null)}
              >
                <MaterialIcons name="delete" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Remove Screenshot</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Text style={styles.formLabel}>Transaction Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <Text style={styles.input}>{transactionDate.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={transactionDate}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
        />
      )}

      <Button title={isSubmitting ? 'Submitting...' : 'Submit'} onPress={handleSubmit} disabled={isSubmitting} />
    </ScrollView>
  );
}
