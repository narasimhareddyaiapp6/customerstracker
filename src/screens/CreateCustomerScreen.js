import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Button, Alert, TouchableOpacity, ScrollView, Modal, FlatList, Image, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { supabase } from '../services/supabaseClient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import styles from './CustomerStyles';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

import * as uuid from 'uuid';
import EnhancedDatePicker from '../components/EnhancedDatePicker';
import { MaterialIcons } from '@expo/vector-icons';
import AreaSearchBar from '../components/AreaSearchBar';
import CustomerItemActions from '../components/CustomerItemActions';
import CustomerMapModal from '../components/CustomerMapModal';
import CalculatorModal from '../components/CalculatorModal';
import { fetchAreasForUser } from '../services/AreaService';
import { uploadImageToStorage, deleteImageFromStorage } from '../services/StorageService';

const getDayName = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date();
  return days[d.getDay()];
};

const getCurrentTime = () => {
  const d = new Date();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const DEFAULT_CUSTOMER_TYPES = [
  { id: 'regular', status_name: 'Regular' },
  { id: 'daily', status_name: 'Daily' },
  { id: 'weekly', status_name: 'Weekly' },
  { id: 'monthly', status_name: 'Monthly' },
  { id: 'business', status_name: 'Business' },
  { id: 'individual', status_name: 'Individual' },
  { id: 'retail', status_name: 'Retail' },
  { id: 'wholesale', status_name: 'Wholesale' },
  { id: 'vip', status_name: 'VIP' },
  { id: 'new', status_name: 'New' },
];

export default function CreateCustomerScreen({ user, userProfile, route = {} }) {
  const navigation = useNavigation();
  
  // -- State Declarations --
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [bookNo, setBookNo] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [areaId, setAreaId] = useState(null);
  const [areas, setAreas] = useState([]);
  const [areaSearch, setAreaSearch] = useState('');
  const [filteredAreas, setFilteredAreas] = useState([]);
  const [selectedAreaName, setSelectedAreaName] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [landmark, setLandmark] = useState('');
  const [address, setAddress] = useState('');
  const [amountGiven, setAmountGiven] = useState('');
  const [daysToComplete, setDaysToComplete] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionCustomer, setTransactionCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('repayment');
  const [newTransactionRemarks, setNewTransactionRemarks] = useState('');
  const [customerDocs, setCustomerDocs] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docModalUri, setDocModalUri] = useState('');
  const [activeDocModalItem, setActiveDocModalItem] = useState(null);
  const [showCustomerFormModal, setShowCustomerFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repaymentFrequency, setRepaymentFrequency] = useState('');
  const [newTransactionPaymentType, setNewTransactionPaymentType] = useState('cash');
  const [newTransactionUPIImageUrl, setNewTransactionUPIImageUrl] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [masterCustomerTypes, setMasterCustomerTypes] = useState(DEFAULT_CUSTOMER_TYPES);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChangeRemarks, setStatusChangeRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTransactionDatePicker, setShowTransactionDatePicker] = useState(false);
  const [transactionStartDate, setTransactionStartDate] = useState('');
  const [transactionEndDate, setTransactionEndDate] = useState('');
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [isTransactionSaving, setIsTransactionSaving] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [showEnhancedDatePicker, setShowEnhancedDatePicker] = useState(false);
  const [repaymentPlans, setRepaymentPlans] = useState([]);
  const [availableFrequencies, setAvailableFrequencies] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planOptions, setPlanOptions] = useState([]);
  const [selectedPlanName, setSelectedPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('start');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [showCustomerMapModal, setShowCustomerMapModal] = useState(false);
  const [mapFocusedCustomer, setMapFocusedCustomer] = useState(null);
  const [mapInitialMode, setMapInitialMode] = useState('view');
  const [fetchingGps, setFetchingGps] = useState(false);

  // -- Helper Constants --
  const isMissing = field => missingFields.includes(field);

  // -- Effects --
  // Validate user prop
  useEffect(() => {
    if (!user?.id) {
      console.error('CreateCustomerScreen: User ID is missing', { user });
    }
  }, [user?.id]);
  
  // Reset selected customer when modal closes
  useEffect(() => {
    if (!showCustomerFormModal) {
      setSelectedCustomer(null);
      setIsEditMode(false); // Ensure edit mode is off when modal closes
      setIsReadOnly(false); // Ensure read-only mode is off when modal closes
    }
  }, [showCustomerFormModal]);

  // Handle navigation from map to view customer details
  useEffect(() => {
    if (route?.params?.customerId) { // Added nullish coalescing operator for route
      const customerId = route.params.customerId;
      const readOnlyMode = route.params.readOnly || false;
      
      async function fetchAndDisplayCustomer() {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (error) {
          console.error('Error fetching customer for view:', error);
          Alert.alert('Error', 'Failed to load customer details.');
          return;
        }

        if (data) {
          setSelectedCustomer(data);
          setName(data.name || '');
          setMobile(data.mobile || '');
          setEmail(data.email || '');
          setBookNo(data.book_no || '');
          setCustomerType(data.customer_type || '');
          setAreaId(data.area_id || null);
          const selectedArea = areas.find(a => a.id === data.area_id);
          setSelectedAreaName(selectedArea ? selectedArea.area_name : '');
          setLatitude(data.latitude || null);
          setLongitude(data.longitude || null);
          setRemarks(data.remarks || '');
          setLandmark(data.landmark || '');
          setAddress(data.address || '');
          setAmountGiven(data.amount_given ? String(data.amount_given) : '');
          setRepaymentFrequency(data.repayment_frequency || '');
          setRepaymentAmount(data.repayment_amount ? String(data.repayment_amount) : '');
          setDaysToComplete(data.days_to_complete ? String(data.days_to_complete) : '');
          setAdvanceAmount(data.advance_amount ? String(data.advance_amount) : '0');
          setLateFee(data.late_fee_per_day ? String(data.late_fee_per_day) : '');
          setSelectedPlanId(data.repayment_plan_id ? String(data.repayment_plan_id) : '');
          setStartDate(data.start_date ? data.start_date.split('T')[0] : '');
          setEndDate(data.end_date ? data.end_date.split('T')[0] : '');
          setMissingFields([]);
          setIsEditMode(false); // Ensure not in edit mode
          setIsReadOnly(readOnlyMode); // Set read-only mode
          setShowCustomerFormModal(true); // Open the modal
        }
      }
      fetchAndDisplayCustomer();
    } 
  }, [route?.params?.customerId, route?.params?.readOnly, areas]);

  // Filter areas based on search text
  useEffect(() => {
    if (areaSearch) {
      const lowerCaseSearchText = areaSearch.toLowerCase();
      const filtered = areas.filter(area =>
        area.area_name.toLowerCase().includes(lowerCaseSearchText)
      );
      setFilteredAreas(filtered);
    } else {
      setFilteredAreas(areas); // Show all areas if search text is empty
    }
  }, [areaSearch, areas]);

  const isImage = (doc) => {
    if (!doc || !doc.file_name) return false;
    // Check for common image file extensions
    return /\.(jpe?g|png|gif)$/i.test(doc.file_name);
  };



  useEffect(() => {
    async function fetchAreas() {
      try {
        const userId = user?.id || userProfile?.id;
        const userType = userProfile?.user_type || user?.user_type || user?.user_metadata?.user_type;
        const areaList = await fetchAreasForUser({ userId, userType });
        setAreas(areaList || []);
      } catch (error) {
        console.error('fetchAreas: Error fetching areas:', error);
      }
    }
    fetchAreas();
  }, [user?.id, userProfile]);

  // Auto-select the first accessible area when areas load (matches Dashboard behavior)
  useEffect(() => {
    if (areas && areas.length > 0) {
      const currentAreaStillValid = areas.some(a => a.id === areaId);
      if (!areaId || !currentAreaStillValid) {
        setAreaId(areas[0].id);
        setSelectedAreaName(areas[0].area_name);
      }
    } else {
      setAreaId(null);
      setSelectedAreaName('');
    }
  }, [areas]);

  const fetchCustomers = useCallback(async () => {
    if (!areaId) {
      setCustomers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('area_id', areaId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchCustomers error:', error);
        setCustomers([]);
        return;
      }

      setCustomers(data || []);
    } catch (err) {
      console.error('fetchCustomers exception:', err);
      setCustomers([]);
    }
  }, [areaId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch repayment plans on mount and extract unique frequencies
  useEffect(() => {
    async function fetchPlans() {
      const { data, error } = await supabase
        .from('repayment_plans')
        .select('*')
        .order('name', { ascending: true });
      if (!error) {
        setRepaymentPlans(data || []);
        const uniqueFrequencies = [...new Set((data || []).map(plan => plan.frequency))];
        setAvailableFrequencies(uniqueFrequencies);
      }
    }
    fetchPlans();
  }, []);

  // Fetch customer types from DB or use standard defaults
  useEffect(() => {
    async function fetchCustomerTypes() {
      try {
        const { data, error } = await supabase
          .from('master_customer_types')
          .select('*')
          .order('status_name', { ascending: true });
        if (!error && data && data.length > 0) {
          setMasterCustomerTypes(data);
          return;
        }
      } catch (err) {
        // Fallback to default
      }
      try {
        const { data, error } = await supabase
          .from('customer_types')
          .select('*')
          .order('status_name', { ascending: true });
        if (!error && data && data.length > 0) {
          setMasterCustomerTypes(data.map(d => ({
            id: d.id || d.name || d.type || d.status_name,
            status_name: d.status_name || d.name || d.type || d.customer_type
          })));
          return;
        }
      } catch (err) {
        // Fallback to default
      }
      setMasterCustomerTypes(DEFAULT_CUSTOMER_TYPES);
    }
    fetchCustomerTypes();
  }, []);

  useEffect(() => {
    if (repaymentFrequency) {
      const filteredPlans = repaymentPlans.filter(p => p.frequency === repaymentFrequency);
      setPlanOptions(filteredPlans);

      // Only set selectedPlanId if in edit mode and a plan exists for the selected customer
      if (isEditMode && selectedCustomer && selectedCustomer.repayment_plan_id) {
        const planExists = filteredPlans.some(p => String(p.id) === String(selectedCustomer.repayment_plan_id));
        if (planExists) {
          setSelectedPlanId(String(selectedCustomer.repayment_plan_id));
        } else {
          // If the existing plan doesn't match the new frequency, clear selection
          setSelectedPlanId('');
        }
      }
    } else {
      setPlanOptions(repaymentPlans);
      // Only clear selectedPlanId if not in edit mode or no customer is selected
      if (!isEditMode || !selectedCustomer) {
        setSelectedPlanId('');
      }
    }
  }, [repaymentFrequency, repaymentPlans, isEditMode, selectedCustomer?.repayment_plan_id]);


  // Helper function to calculate repayment details
  const calculateRepaymentDetails = (planId, givenAmount, freq) => {
    console.log('calculateRepaymentDetails called:', { planId, givenAmount, freq });
    const plan = repaymentPlans.find(p => String(p.id) === String(planId));
    console.log('Found plan:', plan);
    
    if (plan && givenAmount && parseFloat(givenAmount) > 0) {
      const scale = parseFloat(givenAmount) / parseFloat(plan.base_amount);
      console.log('Calculation scale:', scale);
      
      const calculatedRepaymentAmount = (scale * plan.repayment_per_period).toFixed(2);
      const calculatedAdvanceAmount = plan.advance_amount ? (scale * plan.advance_amount).toFixed(2) : '0';
      const calculatedDaysToComplete = plan.periods.toString();
      const calculatedLateFee = plan.late_fee_per_period ? plan.late_fee_per_period.toString() : '0';
      
      console.log('Setting calculated values:', {
        repaymentAmount: calculatedRepaymentAmount,
        advanceAmount: calculatedAdvanceAmount,
        daysToComplete: calculatedDaysToComplete,
        lateFee: calculatedLateFee
      });
      
      setRepaymentAmount(calculatedRepaymentAmount);
      setAdvanceAmount(calculatedAdvanceAmount);
      setDaysToComplete(calculatedDaysToComplete);
      setLateFee(calculatedLateFee);
      
      // Only update frequency if it doesn't match the plan's frequency
      if (plan.frequency !== freq) {
        setRepaymentFrequency(plan.frequency);
      }
    } else {
      console.log('Clearing calculated values - no plan or amount');
      // Only clear if we're not in edit mode or if planId is explicitly empty
      if (!isEditMode || !planId) {
        setRepaymentAmount('');
        setAdvanceAmount('');
        setDaysToComplete('');
        setLateFee('');
      }
      if (!planId) setRepaymentFrequency(freq || ''); // Only reset frequency if no plan is selected
    }
  };

  // Auto-calculate repayment/advance/days/late fee when plan or amount changes (for Add Customer)
  useEffect(() => {
    console.log('Auto-calculation useEffect triggered:', { selectedPlanId, amountGiven, repaymentPlans: repaymentPlans.length });
    calculateRepaymentDetails(selectedPlanId, amountGiven, repaymentFrequency);
  }, [selectedPlanId, amountGiven, repaymentPlans]);

  // Auto-calculate end date when start date or days to complete changes
  useEffect(() => {
    if (startDate && daysToComplete && repaymentFrequency) {
      const start = new Date(startDate);
      const days = parseInt(daysToComplete);
      let endDateCalculated;
      
      if (repaymentFrequency === 'daily') {
        endDateCalculated = new Date(start.getTime() + (days * 24 * 60 * 60 * 1000));
      } else if (repaymentFrequency === 'weekly') {
        endDateCalculated = new Date(start.getTime() + (days * 7 * 24 * 60 * 60 * 1000));
      } else if (repaymentFrequency === 'monthly') {
        endDateCalculated = new Date(start);
        endDateCalculated.setMonth(endDateCalculated.getMonth() + days);
      } else if (repaymentFrequency === 'yearly') {
        endDateCalculated = new Date(start);
        endDateCalculated.setFullYear(endDateCalculated.getFullYear() + days);
      }
      
      if (endDateCalculated) {
        setEndDate(endDateCalculated.toISOString().split('T')[0]);
      }
    }
  }, [startDate, daysToComplete, repaymentFrequency]);

  // Check if customer has transactions (to prevent editing)
  const checkCustomerTransactions = async (customerId) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('customer_id', customerId)
        .limit(1);
      
      if (error) {
        console.error('Error checking transactions:', error);
        return false;
      }
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Error in checkCustomerTransactions:', error);
      return false;
    }
  };

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    setLatitude(location.coords.latitude);
    setLongitude(location.coords.longitude);
  };

  // Date picker functions
  const showDatePickerModal = (mode) => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  const showEnhancedDatePickerModal = () => {
    setShowEnhancedDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios');
    
    if (event.type === 'set') {
      const dateString = currentDate.toISOString().split('T')[0];
      if (datePickerMode === 'start') {
        setStartDate(dateString);
      } else {
        setEndDate(dateString);
      }
    }
  };

  const onEnhancedDateSelect = (dates) => {
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setShowEnhancedDatePicker(false);
  };

  

  // Open transaction modal with auto-populated repayment amount
  const openTransactionModal = (customer) => {
    console.log('openTransactionModal called with customer:', customer);
    setTransactionCustomer(customer);
    setNewTransactionAmount(customer.repayment_amount ? String(customer.repayment_amount) : ''); // Auto-populate from repayment_amount
    setTransactionStartDate(customer.start_date || '');
    setTransactionEndDate(customer.end_date || '');
    // Initialize transactionDate to customer's start_date if available, otherwise current date
    setTransactionDate(customer.start_date ? customer.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setShowTransactionModal(true);
    fetchTransactions(customer.id);
    fetchCustomerDocs(customer.id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCloneCustomer = (customer) => {
    setIsEditMode(false); // Cloning means creating a new customer
    setSelectedCustomer(null);
    setName(customer.name || '');
    setMobile(customer.mobile || '');
    setEmail(customer.email || '');
    setBookNo(''); // Clear book number for new customer
    setCustomerType(customer.customer_type || '');
    setAreaId(customer.area_id || null);
    const selectedArea = areas.find(a => a.id === customer.area_id);
    setSelectedAreaName(selectedArea ? selectedArea.area_name : '');
    setLatitude(customer.latitude || null);
    setLongitude(customer.longitude || null);
    setRemarks(customer.remarks || '');
    setAmountGiven(customer.amount_given ? String(customer.amount_given) : '');
    setRepaymentFrequency(customer.repayment_frequency || '');
    setRepaymentAmount(customer.repayment_amount ? String(customer.repayment_amount) : '');
    setDaysToComplete(customer.days_to_complete ? String(customer.days_to_complete) : '');
    setAdvanceAmount(customer.advance_amount ? String(customer.advance_amount) : '0');
    setLateFee(customer.late_fee_per_day ? String(customer.late_fee_per_day) : '');
    setSelectedPlanId(customer.repayment_plan_id ? String(customer.repayment_plan_id) : '');
    setStartDate(customer.start_date ? customer.start_date.split('T')[0] : '');
    setEndDate(customer.end_date ? customer.end_date.split('T')[0] : '');
    setMissingFields([]);
    setShowCustomerFormModal(true);
  };

  // --- END handleCreate unified definition ---


  const fetchTransactions = async (customerId) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, customers(book_no, name), users(email))')
        .eq('customer_id', customerId)
        .order('transaction_date', { ascending: false });
      if (error) {
        console.error('fetchTransactions error:', error);
      }
      setTransactions(data || []);
      console.log('Fetched transactions:', data);
    } catch (err) {
      console.error('fetchTransactions exception:', err);
    }
  };

  const fetchCustomerDocs = async (customerId) => {
    const { data, error } = await supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('uploaded_at', { ascending: false });
    setCustomerDocs(data || []);
  };

  const handleDownloadTransactions = async () => {
    if (!transactions || transactions.length === 0) {
      Alert.alert('No Data', 'No transactions to download.');
      return;
    }

    const headers = ['Date', 'Card no', 'Customer Name', 'User Name', 'Payment Mode', 'Amount', 'Remarks'].join(',');
    const csvRows = transactions.map(t => {
      const date = new Date(t.transaction_date).toLocaleDateString();
      const cardNo = t.customers?.book_no || '';
      const customerName = t.customers?.name || '';
      const userName = t.users?.email || ''; // Assuming user email is the user name
      const paymentMode = t.payment_mode || 'Cash';
      const amount = t.amount || 0;
      const remarks = t.remarks || '';
      return `"${date}","${cardNo}","${customerName}","${userName}","${paymentMode}","${amount}","${remarks}"`;
    });

    const csvString = headers + '\n' + csvRows.join('\n');
    const fileUri = FileSystem.documentDirectory + 'transactions.csv';

    try {
      await FileSystem.writeAsStringAsync(fileUri, csvString);
      await Sharing.shareAsync(fileUri);
      Alert.alert('Success', 'Transactions file ready to open/share.');
    } catch (error) {
      console.error('Error downloading transactions:', error);
      Alert.alert('Error', 'Failed to download transactions.');
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransactionAmount) {
      Alert.alert('Error', 'Amount is required');
      return;
    }

    // Prevent multiple submissions
    if (isTransactionSaving) {
      return;
    }

    setIsTransactionSaving(true);

    try {
      let lat = null;
      let lon = null;
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is required');
          setIsTransactionSaving(false);
          return;
        }
        let location = await Location.getCurrentPositionAsync({});
        lat = location.coords.latitude;
        lon = location.coords.longitude;
      } catch (err) {
        Alert.alert('Error', 'Failed to get location');
        setIsTransactionSaving(false);
        return;
      }

      const { error } = await supabase.from('transactions').insert({
        customer_id: transactionCustomer.id,
        user_id: user.id,
        amount: newTransactionAmount,
        transaction_type: newTransactionType,
        transaction_date: transactionDate,
        remarks: newTransactionRemarks,
        latitude: lat,
        longitude: lon,
        payment_mode: newTransactionPaymentType,
        upi_image: newTransactionUPIImageUrl
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setNewTransactionAmount('');
        setNewTransactionType('repayment');
        setNewTransactionRemarks('');
        setNewTransactionPaymentType('');
        setNewTransactionUPIImageUrl('');
        fetchTransactions(transactionCustomer.id);
        Alert.alert('Success', 'Transaction added successfully!');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      Alert.alert('Error', 'Failed to add transaction');
    } finally {
      setIsTransactionSaving(false);
    }
  };

  const handleAddCustomerDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) {
      for (const file of (result.assets || [result])) {
        let base64 = '';
        if (file.uri && file.mimeType && file.mimeType.startsWith('image/')) {
          base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        }
        await supabase.from('customer_documents').insert({
          customer_id: selectedCustomer.id,
          file_name: file.name,
          file_data: base64,
        });
      }
      fetchCustomerDocs(selectedCustomer.id);
    }
  };

  // Calculation helpers
  const getTotalRepaid = () => {
    return transactions
      .filter(t => t.transaction_type === 'repayment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };
  const getRemainingAmount = () => {
    if (!transactionCustomer) return 0;
    return Number(transactionCustomer.amount_given || 0) - getTotalRepaid();
  };
  const getDaysLeft = () => {
    if (!transactionCustomer) return 0;
    const created = new Date(transactionCustomer.created_at);
    const now = new Date();
    const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return Number(transactionCustomer.days_to_complete || 0) - daysPassed;
  };
  const getLateFee = () => {
    const daysLeft = getDaysLeft();
    if (daysLeft >= 0) return 0;
    const overdueDays = Math.abs(daysLeft);
    return overdueDays * Number(transactionCustomer.late_fee_per_day || 0);
  };
    const getTotalCashReceived = () => {
    return transactions
      .filter(t => t.payment_mode === 'cash')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const getTotalUpiReceived = () => {
    return transactions
      .filter(t => t.payment_mode === 'upi')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  // 1. Add calculation for Pending Amount and Pending Days at the top of the transaction modal:
  // Helper functions
  const getPendingAmount = () => {
    if (!transactionCustomer) return 0;
    const totalRepaid = transactions
      .filter(t => t.transaction_type === 'repayment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expectedTotalRepayment = (Number(transactionCustomer.repayment_amount || 0) * Number(transactionCustomer.days_to_complete || 0));
    return expectedTotalRepayment - totalRepaid;
  };
  const getPendingDays = () => {
    if (!transactionCustomer || !transactions.length) {
      const totalPeriods = Number(transactionCustomer?.days_to_complete || 0);
      return `${totalPeriods} ${getFrequencyUnit(transactionCustomer?.repayment_frequency)}`;
    }
    
    const firstTx = transactions[transactions.length - 1]; // assuming sorted desc
    if (!firstTx) {
      const totalPeriods = Number(transactionCustomer.days_to_complete || 0);
      return `${totalPeriods} ${getFrequencyUnit(transactionCustomer.repayment_frequency)}`;
    }
    
    const firstDate = new Date(firstTx.transaction_date);
    const today = new Date();
    const daysPassed = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    const totalPeriods = Number(transactionCustomer.days_to_complete || 0);
    const frequency = transactionCustomer.repayment_frequency;
    
    let pendingPeriods;
    switch (frequency) {
      case 'daily':
        pendingPeriods = totalPeriods - daysPassed;
        break;
      case 'weekly':
        const weeksPassed = Math.floor(daysPassed / 7);
        pendingPeriods = totalPeriods - weeksPassed;
        break;
      case 'monthly':
        const monthsPassed = Math.floor(daysPassed / 30); // Approximate
        pendingPeriods = totalPeriods - monthsPassed;
        break;
      case 'yearly':
        const yearsPassed = Math.floor(daysPassed / 365); // Approximate
        pendingPeriods = totalPeriods - yearsPassed;
        break;
      default:
        pendingPeriods = totalPeriods - daysPassed;
    }
    
    return `${Math.max(0, pendingPeriods)} ${getFrequencyUnit(frequency)}`;
  };
  
  // Helper function to get frequency unit label
  const getFrequencyUnit = (frequency) => {
    switch (frequency) {
      case 'daily': return 'days';
      case 'weekly': return 'weeks';
      case 'monthly': return 'months';
      case 'yearly': return 'years';
      default: return 'days';
    }
  };

  

  

  const handleChangeStatus = (customer) => {
    if (userProfile?.user_type !== 'admin' && userProfile?.user_type !== 'superadmin') {
      Alert.alert('Permission Denied', 'You do not have permission to change the customer status.');
      return;
    }
    setSelectedCustomer(customer);
    setShowStatusModal(true);
  };

  const checkCustomerHasOpenTransactions = async (customerId) => {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, transaction_type')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error checking transactions:', error);
      return true; // Assume open transactions if there's an error
    }

    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('repayment_amount, days_to_complete')
        .eq('id', customerId)
        .single();

    if (customerError) {
        console.error('Error fetching customer', customerError);
        return true;
    }

    const totalRepaid = transactions
      .filter(t => t.transaction_type === 'repayment')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expectedTotalRepayment = (Number(customer.repayment_amount || 0) * Number(customer.days_to_complete || 0));
    const remainingAmount = expectedTotalRepayment - totalRepaid;

    return remainingAmount > 0;
  };

  const updateCustomerStatus = (customerId, status, newRemarks) => {
    return new Promise(async (resolve) => {
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('remarks')
        .eq('id', customerId)
        .single();

      if (fetchError) {
        Alert.alert('Error', 'Failed to fetch customer details.', [{ text: 'OK', onPress: resolve }]);
        return;
      }

      const timestamp = new Date().toLocaleString();
      const remarksToAppend = newRemarks ? `\n\n[${timestamp}] Status changed to ${status}: ${newRemarks}` : `\n\n[${timestamp}] Status changed to ${status}`;
      const updatedRemarks = (customer.remarks || '') + remarksToAppend;

      const { error } = await supabase
        .from('customers')
        .update({ status, remarks: updatedRemarks })
        .eq('id', customerId);

      if (error) {
        Alert.alert('Error', 'Failed to update customer status.', [{ text: 'OK', onPress: resolve }]);
      } else {
        Alert.alert('Success', 'Customer status updated successfully.', [{ text: 'OK', onPress: resolve }]);
        setStatusChangeRemarks(''); // Clear the remarks input
        fetchCustomers();
      }
    });
  };

  

  const renderCustomerItem = ({ item }) => (
    <View style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, backgroundColor: '#fff' }}>
      {/* Customer Info Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.cell, { flex: 1.5 }]}>{item.book_no || 'N/A'}</Text>
        <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
        <Text style={[styles.cell, { flex: 2 }]}>{item.mobile}</Text>
        <CustomerItemActions
          item={item}
          setIsEditMode={setIsEditMode}
          setSelectedCustomer={setSelectedCustomer}
          setName={setName}
          setMobile={setMobile}
          setEmail={setEmail}
          setBookNo={setBookNo}
          setCustomerType={setCustomerType}
          setAreaId={setAreaId}
          areas={areas}
          setSelectedAreaName={setSelectedAreaName}
          setLatitude={setLatitude}
          setLongitude={setLongitude}
          setRemarks={setRemarks}
          setAmountGiven={setAmountGiven}
          setRepaymentFrequency={setRepaymentFrequency}
          repaymentPlans={repaymentPlans}
          setPlanOptions={setPlanOptions}
          setRepaymentAmount={setRepaymentAmount}
          setDaysToComplete={setDaysToComplete}
          setAdvanceAmount={setAdvanceAmount}
          setLateFee={setLateFee}
          setSelectedPlanId={setSelectedPlanId}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          calculateRepaymentDetails={calculateRepaymentDetails}
          fetchCustomerDocs={fetchCustomerDocs}
          setShowCustomerFormModal={setShowCustomerFormModal}
          openTransactionModal={openTransactionModal}
          openLocationPicker={openLocationPicker}
          openCustomerMap={openCustomerMap}
          handleCloneCustomer={handleCloneCustomer}
          handleChangeStatus={handleChangeStatus}
        />
      </View>
    </View>
  );

  const openCreateCustomerModal = () => {
    if (!repaymentPlans || repaymentPlans.length === 0) {
      Alert.alert('No Repayment Plans', 'No repayment plans are configured. Please contact the administrator to configure repayment plans.');
      return;
    }
    
    // Clear all form data
    setIsEditMode(false);
    setSelectedCustomer(null);
    setName('');
    setMobile('');
    setEmail('');
    setBookNo('');
    setCustomerType('');
    setLatitude(null);
    setLongitude(null);
    setRemarks('');
    setAmountGiven('');
    setDaysToComplete('');
    setAdvanceAmount('');
    setLateFee('');
    setLandmark('');
    setAddress('');
    setRepaymentFrequency('');
    setRepaymentAmount('');
    setStartDate('');
    setEndDate('');
    
    // Reset any error states
    setMissingFields([]);
    
    // Refresh areas if list is empty
    if (areas.length === 0) {
      const userId = user?.id || userProfile?.id;
      const userType = userProfile?.user_type || user?.user_type || user?.user_metadata?.user_type;
      fetchAreasForUser({ userId, userType }).then(areaList => {
        if (areaList && areaList.length > 0) {
          setAreas(areaList);
        } else {
          setAreas([]);
        }
      }).catch(err => console.error('Error refreshing areas on modal open:', err));
    }

    // Show the modal
    setShowCustomerFormModal(true);
  };

  // First handleSaveCustomer removed - keeping only the unified version with repayment_plan_id

  const handleUploadCustomerDoc = (customer) => {
    // To be implemented: open file/image picker and upload logic
    Alert.alert('Upload', 'Upload logic to be implemented');
  };

  const openImageModal = (uri, docOrTransaction = null, type = 'customerDoc') => {
    setDocModalUri(uri);
    setActiveDocModalItem(docOrTransaction ? { type, item: docOrTransaction } : null);
    setShowDocModal(true);
  };

  const handleViewCustomerDocs = async (customer) => {
    setSelectedCustomer(customer);
    await fetchCustomerDocs(customer.id);
    setShowCustomerModal(true);
  };

  // 1. Add upload menu function:
  const handleUploadMenu = () => {
    const currentImages = customerDocs.filter(isImage);
    Alert.alert(
      `Upload Image (${currentImages.length} uploaded)`,
      'Choose an option to upload customer photo:',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Pick from Gallery', onPress: handlePickImages },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  // 2. Take Photo (single, compressed):
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.3,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadFile(result.assets[0].uri, 'image', result.assets[0].mimeType || 'image/jpeg');
        Alert.alert('Success', 'Photo captured and uploaded successfully!');
      } else {
        console.warn('Camera result:', result);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo: ' + error.message);
    }
  };
  // 3. Pick from Gallery (multiple, compressed):
  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.3,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Upload all selected images without limit
        await Promise.all(
          result.assets.map(asset => 
            uploadFile(asset.uri, 'image', asset.mimeType || 'image/jpeg')
          )
        );

        Alert.alert('Success', `${result.assets.length} image(s) uploaded successfully!`);
      } else {
        console.warn('Gallery result:', result);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images: ' + error.message);
    }
  };

  // Upload customer document with auto-bucket creation and base64 fallback
  const uploadFile = async (uri, fileType, mimeType = 'image/jpeg') => {
    try {
      if (!selectedCustomer?.id) {
        Alert.alert('Error', 'No customer selected');
        return;
      }
      console.log('Uploading customer document. user_id:', user?.id, 'customer_id:', selectedCustomer.id);
      const fileExt = (mimeType && mimeType.includes('/')) ? mimeType.split('/')[1] : 'jpg';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;
      const filePath = `customers/${selectedCustomer.id}/${fileName}`;

      const { publicUrl, error: uploadError } = await uploadImageToStorage({
        uri,
        filePath,
        bucketName: 'customerstracker',
        mimeType: mimeType || 'image/jpeg',
      });

      if (uploadError || !publicUrl) {
        console.error('Image upload error:', uploadError);
        Alert.alert('Error', 'Failed to upload file: ' + (uploadError?.message || 'Unknown error'));
        return;
      }

      console.log('Customer image ready. Public URL / Data length:', publicUrl?.length);

      // Store file path and URL in customer_documents table
      const { error: insertError } = await supabase.from('customer_documents').insert({
        customer_id: selectedCustomer.id,
        file_name: fileName,
        file_data: publicUrl, // Save public URL (or fallback data URI)
      });

      if (insertError) {
        console.error('Error inserting customer document:', insertError);
        Alert.alert('Database Error', 'Failed to save document details: ' + insertError.message);
        return;
      }

      fetchCustomerDocs(selectedCustomer.id);
    } catch (error) {
      console.error('Error in uploadFile:', error);
      Alert.alert('Error', 'Failed to upload file: ' + error.message);
    }
  };

  // Delete customer photo from storage and database
  const handleDeleteCustomerDoc = (doc) => {
    if (!doc) return;
    Alert.alert('Delete Image', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteImageFromStorage(doc.file_data, 'customerstracker');
            await supabase.from('customer_documents').delete().eq('id', doc.id);
            if (selectedCustomer?.id) {
              await fetchCustomerDocs(selectedCustomer.id);
            }
            if (docModalUri === doc.file_data) {
              setShowDocModal(false);
              setDocModalUri(null);
              setActiveDocModalItem(null);
            }
            Alert.alert('Success', 'Image deleted successfully.');
          } catch (err) {
            console.error('Error deleting customer photo:', err);
            Alert.alert('Error', 'Failed to delete photo: ' + err.message);
          }
        },
      },
    ]);
  };

  // Delete transaction UPI image
  const handleDeleteTransactionImage = async (transaction) => {
    if (!transaction?.id || !transaction?.upi_image) return;
    Alert.alert('Delete Receipt', 'Are you sure you want to delete this UPI receipt image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteImageFromStorage(transaction.upi_image, 'customerstracker');
            await supabase.from('transactions').update({ upi_image: null }).eq('id', transaction.id);
            if (transactionCustomer?.id) {
              await fetchTransactions(transactionCustomer.id);
            }
            if (docModalUri === transaction.upi_image) {
              setShowDocModal(false);
              setDocModalUri(null);
              setActiveDocModalItem(null);
            }
            Alert.alert('Success', 'Receipt image deleted.');
          } catch (err) {
            console.error('Error deleting transaction image:', err);
            Alert.alert('Error', 'Failed to delete receipt: ' + err.message);
          }
        },
      },
    ]);
  };

  // This useEffect and the customerImageUrls state are no longer needed
  // as we will use file_data directly.
  /*
  useEffect(() => {
    let isMounted = true;
    async function fetchUrls() {
      setLoadingImages(true);
      const urls = {};
      for (const doc of customerDocs.filter(isImage)) {
        // Use the stored file_data directly
        urls[doc.id] = doc.file_data;
      }
      if (isMounted) setCustomerImageUrls(urls);
      setLoadingImages(false);
    }
    if (showCustomerFormModal && isEditMode) fetchUrls();
    return () => { isMounted = false; };
  }, [customerDocs, showCustomerFormModal, isEditMode]);
  */

  // Customer map functions
  const openCustomerMap = (customer = null, mode = 'view') => {
    setMapFocusedCustomer(customer);
    setMapInitialMode(mode);
    setShowCustomerMapModal(true);
  };

  const handleUpdateCustomerLocation = async (customerId, lat, lng) => {
    // Update local state so form reflects it immediately
    const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat);
    const parsedLng = typeof lng === 'number' ? lng : parseFloat(lng);
    setLatitude(parsedLat);
    setLongitude(parsedLng);

    if (customerId) {
      try {
        const { error } = await supabase
          .from('customers')
          .update({
            latitude: parsedLat,
            longitude: parsedLng,
          })
          .eq('id', customerId);

        if (error) {
          Alert.alert('Error', 'Failed to update location: ' + error.message);
        } else {
          Alert.alert('Success', 'Customer location updated successfully!');
          fetchCustomers();
        }
      } catch (error) {
        console.error('Error updating customer location:', error);
        Alert.alert('Error', 'Failed to update customer location');
      }
    }
  };

  const fetchCurrentGpsForForm = async () => {
    try {
      setFetchingGps(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture current GPS coordinates.');
        setFetchingGps(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (loc && loc.coords) {
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
        Alert.alert(
          'Location Captured',
          `GPS location captured successfully:\nLat: ${loc.coords.latitude.toFixed(6)}\nLng: ${loc.coords.longitude.toFixed(6)}`
        );
      }
    } catch (err) {
      console.error('Error fetching GPS for form:', err);
      Alert.alert('Error', 'Failed to get current GPS location: ' + (err.message || err));
    } finally {
      setFetchingGps(false);
    }
  };

  // Location picker functions
  const openLocationPicker = (customer) => {
    setSelectedCustomer(customer);
    setSelectedLocation({
      latitude: customer.latitude || 17.3850,
      longitude: customer.longitude || 78.4867,
    });
    setMapRegion({
      latitude: customer.latitude || 17.3850,
      longitude: customer.longitude || 78.4867,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setShowLocationPicker(true);
  };

  const handleMapPress = (data) => {
    const { latitude, longitude } = data;
    setSelectedLocation({ latitude, longitude });
  };

  const confirmLocationSelection = async () => {
    if (!selectedLocation || !selectedCustomer) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        })
        .eq('id', selectedCustomer.id);

      if (error) {
        Alert.alert('Error', 'Failed to update location: ' + error.message);
      } else {
        Alert.alert('Success', 'Location updated successfully!');
        setShowLocationPicker(false);
        setSelectedLocation(null);
        
        // Refresh customer list
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location');
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setSelectedLocation(newLocation);
      setCurrentRegion({
        ...newLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Could not get current location');
    }
  };

  // Add this helper for transaction UPI image upload
  const uploadTransactionImage = async (uri, transactionId, mimeType = 'image/jpeg') => {
    try {
      const fileExt = (mimeType && mimeType.includes('/')) ? mimeType.split('/')[1] : 'jpg';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;
      const filePath = `transactions/${transactionId}/${fileName}`;

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

      console.log('Transaction image ready:', publicUrl?.substring(0, 50));
      return publicUrl; // Return the full URL or data URI
    } catch (error) {
      Alert.alert('Error', 'Failed to upload UPI image: ' + error.message);
      return null;
    }
  };

  const getTransactionImageUrl = (filePath) => {
    const { data } = supabase.storage.from('customerstracker').getPublicUrl(filePath);
    console.log('Display transaction image. File path:', filePath, 'URL:', data?.publicUrl);
    return data?.publicUrl || '';
  };

  // Update handleUploadUPIImage to use Supabase Storage
  const handleUploadUPIImage = async () => {
    Alert.alert(
      'Select UPI Image',
      'Choose how you want to add the UPI image',
      [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera permission is required to take UPI photos.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
              });
              if (!result.canceled && result.assets[0]) {
                const imageUrl = await uploadTransactionImage(result.assets[0].uri, transactionCustomer.id, result.assets[0].mimeType || 'image/jpeg');
                if (imageUrl) {
                  setNewTransactionUPIImageUrl(imageUrl);
                  Alert.alert('Success', 'UPI image captured and uploaded successfully!');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to capture UPI image');
            }
          }
        },
        {
          text: 'Gallery',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Gallery permission is required to select UPI images.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
              });
              if (!result.canceled && result.assets[0]) {
                const imageUrl = await uploadTransactionImage(result.assets[0].uri, transactionCustomer.id, result.assets[0].mimeType || 'image/jpeg');
                if (imageUrl) {
                  setNewTransactionUPIImageUrl(imageUrl);
                  Alert.alert('Success', 'UPI image selected and uploaded successfully!');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to select UPI image');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleEditCustomer = async (item) => {
    if (!repaymentPlans || repaymentPlans.length === 0) {
      Alert.alert('No Repayment Plans', 'No repayment plans are configured. Please contact the administrator to configure repayment plans.');
      return;
    }
    
    // Check if customer has any transactions
    const hasTransactions = await checkCustomerTransactions(item.id);
    if (hasTransactions) {
      Alert.alert(
        'Cannot Edit Customer',
        'This customer has existing transactions and cannot be edited. Please contact administrator if changes are needed.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsEditMode(true);
    setSelectedCustomer(item);
    setName(item.name);
    setMobile(item.mobile);
    setEmail(item.email);
    setBookNo(item.book_no);
    setCustomerType(item.customer_type || '');
    setAreaId(item.area_id || null);
    const selectedArea = areas.find(a => a.id === item.area_id);
    setSelectedAreaName(selectedArea ? selectedArea.area_name : '');
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setRemarks(item.remarks);
    setLandmark(item.landmark || '');
    setAddress(item.address || '');
    setAmountGiven(item.amount_given ? String(item.amount_given) : '');
    setRepaymentFrequency(item.repayment_frequency || '');
    // Filter plan options based on the customer's repayment frequency
    const filteredPlans = repaymentPlans.filter(p => p.frequency === (item.repayment_frequency || ''));
    setPlanOptions(filteredPlans);
    
    setRepaymentAmount(item.repayment_amount ? String(item.repayment_amount) : '');
    setDaysToComplete(item.days_to_complete ? String(item.days_to_complete) : '');
    setAdvanceAmount(item.advance_amount ? String(item.advance_amount) : '0');
    setLateFee(item.late_fee_per_day ? String(item.late_fee_per_day) : '');
    setSelectedPlanId(item.repayment_plan_id ? String(item.repayment_plan_id) : '');
    
    // Set the repayment plan name for display
    if (item.repayment_plan_id) {
      const plan = filteredPlans.find(p => String(p.id) === String(item.repayment_plan_id));
      if (plan) {
        setSelectedPlanName(plan.name);
        console.log('Found plan name:', plan.name);
      } else {
        setSelectedPlanName('');
        console.log('Plan not found for ID:', item.repayment_plan_id);
      }
    } else {
      setSelectedPlanName('');
      console.log('No repayment_plan_id for item.');
    }

    // Set start and end dates if they exist
    setStartDate(item.start_date || '');
    setEndDate(item.end_date || '');
    console.log('handleEditCustomer - selectedCustomer.repayment_plan_id:', item.repayment_plan_id);
    console.log('handleEditCustomer - selectedPlanId:', (item.repayment_plan_id ? String(item.repayment_plan_id) : ''));
    console.log('handleEditCustomer - selectedPlanName:', (item.repayment_plan_id ? (repaymentPlans.find(p => String(p.id) === String(item.repayment_plan_id))?.name || '') : ''));
    
    fetchCustomerDocs(item.id);
    setShowCustomerFormModal(true);
  };

  const handleCreate = async () => {
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);

    console.log('Create customer started with user:', user);
    
    if (!user?.id) {
      console.error('User ID is missing');
      Alert.alert('Error', 'Please log in again to continue.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Check for missing required fields
      const missingFields = [];
      if (!name) missingFields.push('Name');
      if (!customerType) missingFields.push('Customer Type');
      if (!areaId) missingFields.push('Area');
      if (!amountGiven) missingFields.push('Amount Given');
      if (!daysToComplete) missingFields.push('Days to Complete');
      if (!repaymentFrequency) missingFields.push('Repayment Frequency');
      if (!repaymentAmount) missingFields.push('Repayment Amount');
      if (!selectedPlanId) missingFields.push('Repayment Plan');
      if (!startDate) missingFields.push('Start Date');

      // Log all field values for debugging
      console.log('Field values:', {
        name,
        customerType,
        areaId,
        amountGiven,
        daysToComplete,
        repaymentFrequency,
        repaymentAmount,
        selectedPlanId,
        startDate,
        endDate
      });

      if (missingFields.length > 0) {
        console.error('Missing required fields:', missingFields);
        setMissingFields(missingFields);
        Alert.alert(
          'Required Fields Missing',
          'Please fill in the following fields:\n\n' + missingFields.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Clear missing fields if validation passes
      setMissingFields([]);

      // --- Mobile Number Duplication Check (Alert, but allow proceed) ---
      if (mobile && mobile.trim() !== '') {
        console.log('Checking for duplicate mobile number:', mobile);
        const { data: existingMobileCustomer, error: mobileError } = await supabase
          .from('customers')
          .select('id, name')
          .eq('mobile', mobile)
          .single();

        if (mobileError && mobileError.code !== 'PGRST116') {
          console.error('Error checking for duplicate mobile:', mobileError);
          Alert.alert('Error', 'Failed to check for duplicate mobile number.');
          setIsSubmitting(false);
          return;
        }

        if (existingMobileCustomer) {
          const proceed = await new Promise((resolve) => {
            Alert.alert(
              'Duplicate Mobile Number',
              `A customer with this mobile number (${mobile}) already exists: ${existingMobileCustomer.name}. Do you want to proceed?`,
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Proceed', onPress: () => resolve(true) },
              ],
              { cancelable: false }
            );
          });
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      // --- Area & Card No. Duplication Check (Hard Block) ---
      if (bookNo && bookNo.trim() !== '') {
        console.log('Checking for unique customer: areaId=', areaId, 'bookNo=', bookNo);
        const { data: existingCustomer, error: existingCustomerError } = await supabase
          .from('customers')
          .select('id')
          .eq('area_id', areaId)
          .eq('book_no', bookNo)
          .single();

        console.log('Supabase query result: existingCustomer=', existingCustomer, 'error=', existingCustomerError);

        if (existingCustomerError && existingCustomerError.code !== 'PGRST116') {
          // PGRST116 means no rows found, which is good.
          console.error('Error checking for existing customer:', existingCustomerError);
          Alert.alert('Error', 'Failed to check for existing customer.');
          setIsSubmitting(false);
          return;
        }

        if (existingCustomer) {
          Alert.alert('Error', 'A customer with the same Card No. already exists in this area.');
          setIsSubmitting(false);
          return;
        }
      }

  let lat = latitude;
  let lon = longitude;
  if (!lat || !lon) {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    lat = location.coords.latitude;
    lon = location.coords.longitude;
    setLatitude(lat);
    setLongitude(lon);
  }
  const lateFeeValue = lateFee === '' ? '0' : lateFee;
  // Prepare customer data with proper type conversions
  const customerData = {
    name: (name || '').trim(),
    mobile: mobile ? mobile.trim() : null,
    email: email ? email.trim().toLowerCase() : null,
    book_no: bookNo ? bookNo.trim() : null,
    customer_type: customerType,
    area_id: Number(areaId),
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lon === 'number' ? lon : null,
    remarks: remarks ? remarks.trim() : null,
    landmark: landmark ? landmark.trim() : null,
    address: address ? address.trim() : null,
    amount_given: parseFloat(amountGiven) || 0,
    repayment_frequency: repaymentFrequency,
    repayment_plan_id: Number(selectedPlanId),
    repayment_amount: parseFloat(repaymentAmount) || 0,
    days_to_complete: parseInt(daysToComplete) || 0,
    advance_amount: parseFloat(advanceAmount) || 0,
    late_fee_per_day: parseFloat(lateFee) || 0,
    start_date: startDate ? new Date(startDate).toISOString() : null,
    end_date: endDate ? new Date(endDate).toISOString() : null,
    user_id: user?.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

      // Validate numeric fields
      if (isNaN(Number(amountGiven)) || Number(amountGiven) <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
        return;
      }

      if (isNaN(Number(daysToComplete)) || Number(daysToComplete) <= 0) {
        Alert.alert('Invalid Days', 'Please enter a valid number of days greater than 0');
        return;
      }

      // Log the prepared data for debugging
      console.log('Attempting to insert customer with prepared data:', JSON.stringify(customerData, null, 2));
      
      // First, validate the repayment plan exists
      const { data: planData, error: planError } = await supabase
        .from('repayment_plans')
        .select('id')
        .eq('id', customerData.repayment_plan_id)
        .single();
        
      if (planError || !planData) {
        console.error('Invalid repayment plan:', planError || 'Plan not found');
        Alert.alert('Error', 'Selected repayment plan is invalid or no longer exists');
        return;
      }

      // Insert the customer with validated data
      const { data: insertedData, error: insertError } = await supabase
        .from('customers')
        .insert([customerData])
        .select('*')
        .single();
      
      if (insertError) {
        console.error('Database error creating customer:', insertError);
        
        // Check for specific error types
        if (insertError.code === '23505') {
          Alert.alert('Error', 'A customer with this mobile number or book number already exists');
        } else if (insertError.code === '23503') {
          Alert.alert('Error', 'Invalid area or repayment plan selected');
        } else {
          Alert.alert(
            'Error Creating Customer',
            'Database Error: ' + insertError.message + '\n\nPlease try again or contact support if the problem persists.'
          );
        }
        return;
      }
      
      if (!insertedData?.id) {
        console.error('No customer ID returned after creation');
        Alert.alert('Error', 'Failed to create customer: No ID returned');
        return;
      }
      
      // Set the newly created customer as the selected customer
      setSelectedCustomer(insertedData);
      
      console.log('Customer created successfully:', insertedData);
      
      // Reset form fields
      setName('');
      setMobile('');
      setEmail('');
      setBookNo('');
      setCustomerType('');
      setLatitude(null);
      setLongitude(null);
      setRemarks('');
      setAmountGiven('');
      setRepaymentFrequency('');
      setRepaymentAmount('');
      setDaysToComplete('');
      setAdvanceAmount('');
      setLateFee('');
      setSelectedPlanId('');
      setStartDate('');
      setEndDate('');
      
      Alert.alert('Success', 'Customer created successfully!');
      setShowCustomerFormModal(false);
      
      // Refresh customer list with current filters
      fetchCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while creating the customer. Please try again.\n\nDetails: ' + error.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCustomer = async () => {
    console.log('handleSaveCustomer called with:', {
      isEditMode,
      selectedCustomer,
      name,
      customerType,
      areaId,
      selectedPlanId
    });
    
    // Validate user and selected customer
    if (!user?.id) {
      console.error('User ID is missing');
      Alert.alert('Error', 'Please log in again to continue.');
      return;
    }

    if (!selectedCustomer?.id) {
      console.error('No customer selected for update. Current state:', {
        selectedCustomer,
        isEditMode,
        showCustomerFormModal 
      });
      Alert.alert('Error', 'No customer selected for update');
      return;
    }

    // Validate required fields
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!customerType) missingFields.push('customerType');
    if (!areaId) missingFields.push('areaId');
    if (!amountGiven) missingFields.push('amountGiven');
    if (!daysToComplete) missingFields.push('daysToComplete');
    if (!repaymentFrequency) missingFields.push('repaymentFrequency');
    if (!repaymentAmount) missingFields.push('repaymentAmount');
    if (!selectedPlanId) missingFields.push('repaymentPlan');

    if (missingFields.length > 0) {
      setMissingFields(missingFields);
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Clear missing fields if validation passes
    setMissingFields([]);

    const customerData = {
      name,
      mobile,
      email,
      book_no: bookNo,
      customer_type: customerType,
      area_id: areaId,
      latitude: (latitude !== null && latitude !== undefined && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? parseFloat(latitude) : null,
      longitude: (longitude !== null && longitude !== undefined && !isNaN(parseFloat(longitude)) && parseFloat(longitude) !== 0) ? parseFloat(longitude) : null,
      remarks,
      landmark,
      address,
      amount_given: Number(amountGiven),
      repayment_frequency: repaymentFrequency,
      repayment_plan_id: Number(selectedPlanId),
      repayment_amount: Number(repaymentAmount),
      days_to_complete: Number(daysToComplete),
      advance_amount: Number(advanceAmount),
      late_fee_per_day: Number(lateFee),
      start_date: startDate || null,
      end_date: endDate || null,
    };

    try {
      console.log('Updating customer with ID:', selectedCustomer.id, 'Data:', customerData);
      
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', selectedCustomer.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating customer:', error);
        Alert.alert('Error', 'Failed to update customer: ' + error.message);
        return;
      }

      if (!data) {
        console.error('No data returned after update');
        Alert.alert('Error', 'Failed to update customer: No data returned');
        return;
      }

      console.log('Customer updated successfully:', data);
      Alert.alert('Success', 'Customer updated successfully!');
      setShowCustomerFormModal(false);

      // Refresh customer list with current filters
      fetchCustomers();
    } catch (error) {
      console.error('Error updating customer:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating the customer');
    }
  };

  // Helper function for dynamic frequency labels
  const getFrequencyLabel = (frequency) => {
    switch (frequency) {
      case 'daily': return 'Days to Complete';
      case 'weekly': return 'Weeks to Complete';
      case 'monthly': return 'Months to Complete';
      case 'yearly': return 'Years to Complete';
      default: return 'Days to Complete';
    }
  };

  // Filter customers based on search criteria with comma-separated support
  const filteredCustomers = customers.filter(customer => {
    if (!search) return true;
    
    // Split search terms by comma and trim whitespace
    const searchTerms = search.split(',').map(term => term.trim().toLowerCase()).filter(term => term);
    
    // Check if any search term matches any customer field
    return searchTerms.some(term => {
      // Convert all searchable fields to lowercase strings, handling null/undefined values
      const customerName = (customer.name || '').toLowerCase();
      const customerMobile = (customer.mobile || '').toLowerCase();
      const customerEmail = (customer.email || '').toLowerCase();
      const customerBookNo = (customer.book_no || '').toString().toLowerCase();
      const customerArea = (customer.area_name || '').toLowerCase();

      

      return customerName.includes(term) ||
             customerMobile.includes(term) ||
             customerEmail.includes(term) ||
             customerBookNo.includes(term) ||
             customerArea.includes(term);
    });
  });

  return (
    <View style={styles.container}>
      {/* Top Area Selection Chips */}
      <View style={styles.areaSelectorContainer}>
        <View style={styles.areaSelectorHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <MaterialIcons name="location-on" size={18} color="#007AFF" />
            <Text style={styles.areaSelectorTitle}>Select Area:</Text>
            {selectedAreaName ? (
              <Text style={{ fontSize: 13, color: '#007AFF', fontWeight: '700', marginLeft: 6 }} numberOfLines={1}>
                📍 {selectedAreaName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#007AFF',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 3,
            }}
            onPress={() => openCustomerMap(null)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="map" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>View on Map</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.areaChipsScrollView}
          keyboardShouldPersistTaps="handled"
        >
          {areas && areas.length > 0 ? (
            areas.map((area) => {
              const isSelected = area.id === areaId;
              const areaLabel = area.area_name || area.name || 'Unnamed Area';
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaChip,
                    isSelected && styles.areaChipSelected,
                  ]}
                  onPress={() => {
                    setAreaId(area.id);
                    setSelectedAreaName(areaLabel);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={isSelected ? 'check-circle' : 'location-on'}
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#007AFF'}
                  />
                  <Text
                    style={[
                      styles.areaChipText,
                      isSelected && styles.areaChipTextSelected,
                    ]}
                  >
                    {areaLabel}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={{ color: '#8E8E93', fontSize: 13, fontStyle: 'italic', paddingVertical: 4 }}>
              Loading areas...
            </Text>
          )}
        </ScrollView>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by Card No, Name, Mobile, Email..."
        placeholderTextColor="#8E8E93"
        style={styles.searchInput}
      />
      <View style={{ flexDirection: 'row', backgroundColor: '#E3E6F0', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
        <Text style={[styles.headerCell, { flex: 1.5 }]}>Card No</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Name</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Mobile</Text>
        <Text style={[styles.headerCell, { flex: 2 }]}>Actions</Text>
      </View>
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={item => item.id.toString()}
        style={styles.customerList}
        ListEmptyComponent={
          <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.emptyListText, { fontSize: 16, color: '#555', textAlign: 'center' }]}>
              {!areaId
                ? '📍 Please select an area above to view customers.'
                : 'No customers found in this area.'}
            </Text>
          </View>
        }
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 12 }}>
        <TouchableOpacity onPress={openCreateCustomerModal} style={{ backgroundColor: '#4A90E2', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, alignSelf: 'flex-end' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>+ Add Customer</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={showCustomerFormModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerFormModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isEditMode ? 'Edit Customer' : 'Add Customer'}</Text>
              {isEditMode && (
                <>
                  <TouchableOpacity style={styles.uploadButton} onPress={handleUploadMenu}>
                    <Text style={styles.uploadButtonText}>
                      Upload Photo(s) ({customerDocs.filter(isImage).length})
                    </Text>
                  </TouchableOpacity>
                  {loadingImages ? (
                    <ActivityIndicator size="small" style={{ margin: 8 }} />
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
                      {customerDocs.filter(isImage).map(doc => (
                        <View key={doc.id} style={{ marginRight: 10, marginBottom: 10, position: 'relative' }}>
                          <TouchableOpacity onPress={() => openImageModal(doc.file_data, doc, 'customerDoc')}>
                            {doc.file_data ? (
                              <Image
                                source={{ uri: doc.file_data }}
                                style={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: '#ddd'
                                }}
                                onError={e => console.error('Thumbnail image load error:', { url: doc.file_data, error: e.nativeEvent })}
                              />
                            ) : (
                              <View style={{ width: 60, height: 60, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', borderRadius: 6 }}>
                                <Text style={{ color: '#aaa', fontSize: 10 }}>No Image</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              backgroundColor: '#FF3B30',
                              borderRadius: 12,
                              width: 22,
                              height: 22,
                              justifyContent: 'center',
                              alignItems: 'center',
                              elevation: 4,
                            }}
                            onPress={() => handleDeleteCustomerDoc(doc)}
                          >
                            <MaterialIcons name="close" size={14} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
              <Text style={styles.sectionHeader}>Basic Info</Text>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} />
              <Text style={styles.formLabel}>Mobile</Text>
              <TextInput value={mobile} onChangeText={setMobile} style={styles.input} keyboardType="phone-pad" />
              <Text style={styles.formLabel}>Email</Text>
              <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" />
              <Text style={styles.formLabel}>Card No</Text>
              <TextInput value={bookNo} onChangeText={setBookNo} style={styles.input} />
              <Text style={styles.formLabel}>Customer Type</Text>
              <Picker selectedValue={customerType} onValueChange={setCustomerType} style={[styles.formPicker, isMissing('customerType') && { borderColor: 'red', borderWidth: 2 }]}>
                <Picker.Item label="Select Type" value="" />
                {masterCustomerTypes.map(type => <Picker.Item key={type.id} label={type.status_name} value={type.status_name} />)}
              </Picker>
              <Text style={styles.sectionHeader}>Financials</Text>
              <Text style={styles.formLabel}>Amount Given</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={amountGiven}
                  onChangeText={setAmountGiven}
                  style={[styles.input, { flex: 1, marginRight: 10 }, isMissing('amountGiven') && { borderColor: 'red', borderWidth: 2 }]} 
                  keyboardType="numeric" 
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#4A90E2', padding: 10, borderRadius: 8 }}
                  onPress={() => { setShowCalculatorModal(true); setCalculatorTarget('amountGiven'); }}
                >
                  <MaterialIcons name="calculate" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <Text style={styles.formLabel}>Repayment Frequency</Text>
              <Picker
                selectedValue={repaymentFrequency}
                onValueChange={(val) => {
                  setRepaymentFrequency(val);
                  setSelectedPlanId('');
                  setPlanOptions(val ? repaymentPlans.filter(p => p.frequency === val) : []);
                  setRepaymentAmount('');
                  setAdvanceAmount('');
                  setDaysToComplete('');
                  setLateFee('');
                }}
                style={styles.formPicker}
              >
                <Picker.Item label="Select Frequency" value="" />
                {availableFrequencies.map(freq => (
                  <Picker.Item 
                    key={freq} 
                    label={freq.charAt(0).toUpperCase() + freq.slice(1)} 
                    value={freq} 
                  />
                ))}
              </Picker>
              <Text style={styles.formLabel}>Repayment Plan</Text>
              <Picker 
                selectedValue={selectedPlanId} 
                onValueChange={(val) => {
                  console.log('Create Customer - Picker onValueChange - selectedPlanId before:', selectedPlanId, 'new val:', val);
                  setSelectedPlanId(val);
                  // Trigger auto-calculation immediately when plan is selected
                  if (val && amountGiven) {
                    calculateRepaymentDetails(val, amountGiven, repaymentFrequency);
                  }
                }} 
                style={styles.formPicker} 
                enabled={!!repaymentFrequency && planOptions.length > 0}
              >
                <Picker.Item label="Select Plan" value="" />
                {planOptions.map(plan => {
                  console.log('Create Customer - Picker Item - plan.id:', plan.id, 'plan.name:', plan.name, 'selectedPlanId:', selectedPlanId);
                  return <Picker.Item key={plan.id} label={plan.name} value={String(plan.id)} />;
                })}
              </Picker>
              <Text style={styles.formLabel}>Repayment Amount (auto-calculated)</Text>
              <TextInput value={repaymentAmount} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
              <Text style={styles.formLabel}>Advance Amount (auto-calculated)</Text>
              <TextInput value={advanceAmount} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
              <Text style={styles.formLabel}>{getFrequencyLabel(repaymentFrequency)} (auto-filled)</Text>
              <TextInput value={daysToComplete} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
              <Text style={styles.formLabel}>Late Fee Per Period (auto-filled)</Text>
              <TextInput value={lateFee} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
              
              <Text style={styles.sectionHeader}>Repayment Dates</Text>
              <Text style={styles.formLabel}>Date Range Selection</Text>
              <TouchableOpacity 
                style={[styles.input, { justifyContent: 'center', paddingVertical: 12, backgroundColor: startDate && endDate ? '#e8f5e8' : '#f8f9fa' }]} 
                onPress={() => setShowEnhancedDatePicker(true)}
              >
                <Text style={{ color: startDate && endDate ? '#2e7d32' : '#666', textAlign: 'center', fontSize: 16 }}>
                  {startDate && endDate 
                    ? `${formatDate(startDate)} 📅 ${formatDate(endDate)}`
                    : 'Select Date Range'
                  }
                </Text>
              </TouchableOpacity>
              
              <EnhancedDatePicker
                visible={showEnhancedDatePicker}
                onClose={() => setShowEnhancedDatePicker(false)}
                onDateSelect={onEnhancedDateSelect}
                startDate={startDate}
                endDate={endDate}
                repaymentFrequency={repaymentFrequency}
                daysToComplete={daysToComplete}
              />

              <Text style={styles.sectionHeader}>Location (GPS & Map)</Text>

              {/* Location Card */}
              <View style={{
                backgroundColor: (latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? '#E8F5E9' : '#FFF9C4',
                borderColor: (latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? '#4CAF50' : '#FFC107',
                borderWidth: 1.5,
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                    <MaterialIcons 
                      name={(latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? "location-on" : "location-off"} 
                      size={22} 
                      color={(latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? "#2E7D32" : "#E65100"} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={{ 
                      fontWeight: 'bold', 
                      fontSize: 14, 
                      color: (latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? '#1B5E20' : '#E65100' 
                    }}>
                      {(latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) 
                        ? 'GPS Location Assigned' 
                        : 'No GPS Location Set'}
                    </Text>
                  </View>
                  {(latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? (
                    <TouchableOpacity 
                      onPress={() => { setLatitude(null); setLongitude(null); }} 
                      style={{ backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
                    >
                      <Text style={{ color: '#D32F2F', fontSize: 12, fontWeight: 'bold' }}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {(latitude != null && longitude != null && !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0) ? (
                  <View style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#C8E6C9' }}>
                    <Text style={{ fontSize: 12, color: '#2E7D32', fontWeight: '600' }}>
                      🌐 Lat: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#1B5E20' }}>{parseFloat(latitude).toFixed(6)}</Text>  |  Lng: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#1B5E20' }}>{parseFloat(longitude).toFixed(6)}</Text>
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    Capture live device GPS or tap on map to set/update customer coordinates.
                  </Text>
                )}
                
                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#2E7D32',
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      shadowColor: '#2E7D32',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                    onPress={fetchCurrentGpsForForm}
                    disabled={fetchingGps || isReadOnly}
                  >
                    {fetchingGps ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="my-location" size={18} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Current GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#007AFF',
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      shadowColor: '#007AFF',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                    onPress={() => {
                      openCustomerMap({
                        id: selectedCustomer?.id || null,
                        name: name || 'Customer',
                        latitude: latitude || null,
                        longitude: longitude || null,
                        book_no: bookNo || '',
                        mobile: mobile || '',
                      }, 'pick');
                    }}
                    disabled={isReadOnly}
                  >
                    <MaterialIcons name="map" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Pick on Map</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionHeader}>Other</Text>
        <Text style={styles.formLabel}>Area *</Text>
        <Picker
          selectedValue={areaId ? String(areaId) : ''}
          onValueChange={(itemValue) => setAreaId(itemValue ? Number(itemValue) : null)}
          style={[styles.formPicker, isMissing('Area') && styles.inputError]}
          enabled={!isReadOnly}
        >
          <Picker.Item label="Select Area" value="" />
          {areas.map(area => (
            <Picker.Item key={area.id} label={area.area_name} value={String(area.id)} />
          ))}
        </Picker>

        <Text style={styles.formLabel}>Landmark:</Text>
        <TextInput
          style={styles.input}
          placeholder="Landmark (optional)"
          value={landmark}
          onChangeText={setLandmark}
          editable={!isReadOnly}
        />

        <Text style={styles.formLabel}>Address:</Text>
        <TextInput
          style={styles.input}
          placeholder="Address (optional)"
          value={address}
          onChangeText={setAddress}
          editable={!isReadOnly}
        />

        <Text style={styles.formLabel}>Remarks:</Text>
        <TextInput value={remarks} onChangeText={setRemarks} style={styles.input} multiline numberOfLines={3} />
              {missingFields.length > 0 && (
                <Text style={{ color: 'red', marginBottom: 8 }}>All financial fields are mandatory. Please fill the highlighted fields.</Text>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#ccc', borderRadius: 8, paddingVertical: 12, marginRight: 8, alignItems: 'center' }} onPress={() => setShowCustomerFormModal(false)}>
                  <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#4A90E2', 
                    borderRadius: 8, 
                    paddingVertical: 12, 
                    marginLeft: 8, 
                    alignItems: 'center' 
                  }} 
                  onPress={() => {
                    console.log('Save button pressed, isEditMode:', isEditMode);
                    if (isEditMode) {
                      handleSaveCustomer();
                    } else {
                      handleCreate();
                    }
                  }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{isEditMode ? 'Save' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CalculatorModal
        isVisible={showCalculatorModal}
        onClose={() => setShowCalculatorModal(false)}
        onResult={(result) => {
          if (calculatorTarget === 'amountGiven') {
            setAmountGiven(String(result));
          }
          setShowCalculatorModal(false);
        }}
      />
      <Modal
        visible={showCustomerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCustomer && !isEditing && (
              <>
                <Text style={styles.modalTitle}>{selectedCustomer.name}</Text>
                <Text style={styles.modalDetail}>Mobile: {selectedCustomer.mobile}</Text>
                <Text style={styles.modalDetail}>Email: {selectedCustomer.email}</Text>
                <Text style={styles.modalDetail}>Card No: {selectedCustomer.book_no}</Text>
                <Text style={styles.modalDetail}>Type: {selectedCustomer.customer_type}</Text>
                <Text style={styles.modalDetail}>Status: {selectedCustomer.status}</Text>
                <Text style={styles.modalDetail}>Area ID: {selectedCustomer.area_id}</Text>
                <Text style={styles.modalDetail}>Latitude: {selectedCustomer.latitude}</Text>
                <Text style={styles.modalDetail}>Longitude: {selectedCustomer.longitude}</Text>
                <Text style={styles.modalDetail}>Remarks: {selectedCustomer.remarks}</Text>
                <Text style={styles.modalDetail}>Amount Given: {selectedCustomer.amount_given}</Text>
                <Text style={styles.modalDetail}>Days to Complete: {selectedCustomer.days_to_complete}</Text>
                <Text style={styles.modalDetail}>Advance Amount: {selectedCustomer.advance_amount}</Text>
                <Text style={styles.modalDetail}>Late Fee Per Day: {selectedCustomer.late_fee_per_day}</Text>
                {!isReadOnly && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      Alert.alert('Delete Customer', 'Are you sure you want to delete this customer?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => {
                          await supabase.from('customers').delete().eq('id', selectedCustomer.id);
                          setShowCustomerModal(false);
                          setIsEditing(false);
                          setSelectedCustomer(null);
                          // Refresh customer list
                          fetchCustomers();
                        }}
                      ]);
                    }} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={() => { setShowCustomerModal(false); setIsEditing(false); }} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Documents</Text>
                {customerDocs.filter(isImage).length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8, paddingVertical: 4 }}>
                    {customerDocs.filter(isImage).map(doc => (
                      <View key={doc.id} style={{ marginRight: 12, position: 'relative' }}>
                        <TouchableOpacity onPress={() => openImageModal(doc.file_data, doc, 'customerDoc')}>
                          <Image source={{ uri: doc.file_data }} style={{ width: 64, height: 64, borderRadius: 6, borderWidth: 1, borderColor: '#ccc' }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            backgroundColor: '#FF3B30',
                            borderRadius: 12,
                            width: 22,
                            height: 22,
                            justifyContent: 'center',
                            alignItems: 'center',
                            elevation: 4,
                          }}
                          onPress={() => handleDeleteCustomerDoc(doc)}
                        >
                          <MaterialIcons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {customerDocs.filter(doc => !isImage(doc)).map(doc => (
                  <View key={doc.id} style={[styles.documentItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <TouchableOpacity onPress={() => Linking.openURL(doc.file_data || '')} style={{ flex: 1 }}>
                      <Text style={styles.documentLink}>{doc.file_name} [Download]</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ padding: 6, backgroundColor: '#FFE5E5', borderRadius: 6, marginLeft: 8 }}
                      onPress={() => handleDeleteCustomerDoc(doc)}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
                {!isReadOnly && (
                  <TouchableOpacity onPress={handleAddCustomerDoc} style={styles.addDocumentButton}>
                    <Text style={styles.addDocumentButtonText}>Add Document</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {selectedCustomer && isEditing && !isReadOnly && (
              <ScrollView>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.modalTitle}>Edit Customer</Text>
                  <TouchableOpacity onPress={() => openLocationPicker(selectedCustomer)} style={{ padding: 8 }}>
                    <Text style={{ fontSize: 24 }}>📍</Text>
                  </TouchableOpacity>
                </View>
                {isEditMode && (
                  <>
                    <TouchableOpacity style={styles.uploadButton} onPress={handleUploadMenu}>
                      <Text style={styles.uploadButtonText}>
                        Upload Photo(s) ({customerDocs.filter(isImage).length})
                      </Text>
                    </TouchableOpacity>
              
                    {/* Uploaded Photos Section - Moved to top */}
                    <Text style={styles.sectionHeader}>Uploaded Photos</Text>
                    {customerDocs.filter(isImage).length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                        {loadingImages ? (
                          <ActivityIndicator size="small" style={{ margin: 8 }} />
                        ) : (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
                            {customerDocs.filter(isImage).map(doc => (
                              <View key={doc.id} style={{ marginRight: 10, marginBottom: 10, position: 'relative' }}>
                                <TouchableOpacity onPress={() => openImageModal(doc.file_data, doc, 'customerDoc')}>
                                  <Image source={{ uri: doc.file_data }} style={{ width: 60, height: 60, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' }} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{
                                    position: 'absolute',
                                    top: -6,
                                    right: -6,
                                    backgroundColor: '#FF3B30',
                                    borderRadius: 12,
                                    width: 22,
                                    height: 22,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    elevation: 4,
                                  }}
                                  onPress={() => handleDeleteCustomerDoc(doc)}
                                >
                                  <MaterialIcons name="close" size={14} color="#FFF" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </>
                )}
                
                <Text style={styles.formLabel}>Customer Type</Text>
                <Picker
                  selectedValue={selectedCustomer.customer_type}
                  onValueChange={val => setSelectedCustomer({ ...selectedCustomer, customer_type: val })}
                  style={styles.formPicker}
                >
                  <Picker.Item label="Select Type" value="" />
                  {masterCustomerTypes.map(type => (
                    <Picker.Item key={type.id} label={type.status_name} value={type.status_name} />
                  ))}
                </Picker>

                <Text style={styles.formLabel}>Remarks</Text>
                <TextInput value={selectedCustomer.remarks} onChangeText={val => setSelectedCustomer({ ...selectedCustomer, remarks: val })} style={styles.formInput} multiline numberOfLines={3} />
                <Text style={styles.formLabel}>Amount Given</Text>
                <TextInput 
                  value={selectedCustomer.amount_given} 
                  onChangeText={val => setSelectedCustomer({ ...selectedCustomer, amount_given: val })} 
                  style={isMissing('amount_given') ? styles.formInputError : styles.formInput} 
                  keyboardType="numeric" 
                />
                <Text style={styles.formLabel}>Days to Complete Repayment</Text>
                <TextInput 
                  value={selectedCustomer.days_to_complete} 
                  onChangeText={val => setSelectedCustomer({ ...selectedCustomer, days_to_complete: val })} 
                  style={isMissing('days_to_complete') ? styles.formInputError : styles.formInput} 
                  keyboardType="numeric" 
                />
                <Text style={styles.formLabel}>Advance Amount Taken</Text>
                <TextInput 
                  value={selectedCustomer.advance_amount} 
                  onChangeText={val => setSelectedCustomer({ ...selectedCustomer, advance_amount: val })} 
                  style={isMissing('advance_amount') ? styles.formInputError : styles.formInput} 
                  keyboardType="numeric" 
                />
                <Text style={styles.formLabel}>Late Payment Fee Per Day</Text>
                <TextInput 
                  value={selectedCustomer.late_fee_per_day} 
                  onChangeText={val => setSelectedCustomer({ ...selectedCustomer, late_fee_per_day: val })} 
                  style={isMissing('late_fee_per_day') ? styles.formInputError : styles.formInput} 
                  keyboardType="numeric" 
                />
                <Text style={styles.formLabel}>Repayment Frequency</Text>
                <Picker selectedValue={selectedCustomer.repayment_frequency} onValueChange={val => {
                  setSelectedCustomer({
                    ...selectedCustomer,
                    repayment_frequency: val,
                    repayment_plan_id: '',
                    repayment_amount: '',
                    advance_amount: '',
                    days_to_complete: '',
                    late_fee_per_day: ''
                  });
                  // Update plan options based on frequency
                  if (val) {
                    setPlanOptions(repaymentPlans.filter(p => p.frequency === val));
                  } else {
                    setPlanOptions([]);
                  }
                }} style={styles.formPicker}>
                  <Picker.Item label="Select Frequency" value="" />
                  {availableFrequencies.map(freq => <Picker.Item key={freq} label={freq.charAt(0).toUpperCase() + freq.slice(1)} value={freq} />)}
                </Picker>
                <Text style={styles.formLabel}>Repayment Plan</Text>
                <Picker 
                  selectedValue={selectedPlanId} 
                  onValueChange={val => {
                    console.log('Edit Customer - Plan selected:', val);
                    const plan = repaymentPlans.find(p => String(p.id) === String(val));
                    
                    if (plan && selectedCustomer.amount_given) {
                      const scale = parseFloat(selectedCustomer.amount_given) / parseFloat(plan.base_amount);
                      const calculatedRepaymentAmount = (scale * plan.repayment_per_period).toFixed(2);
                      const calculatedAdvanceAmount = plan.advance_amount ? (scale * plan.advance_amount).toFixed(2) : '0';
                      const calculatedDaysToComplete = plan.periods.toString();
                      const calculatedLateFee = plan.late_fee_per_period ? plan.late_fee_per_period.toString() : '0';
                      
                      console.log('Edit Customer - Calculated values:', {
                        repaymentAmount: calculatedRepaymentAmount,
                        advanceAmount: calculatedAdvanceAmount,
                        daysToComplete: calculatedDaysToComplete,
                        lateFee: calculatedLateFee
                      });
                      
                      setSelectedCustomer(prev => ({
                        ...prev,
                        repayment_plan_id: val,
                        repayment_amount: calculatedRepaymentAmount,
                        advance_amount: calculatedAdvanceAmount,
                        days_to_complete: calculatedDaysToComplete,
                        late_fee_per_day: calculatedLateFee,
                        repayment_frequency: plan.frequency
                      }));
                      
                      // Also update the form state variables for consistency
                      setRepaymentAmount(calculatedRepaymentAmount);
                      setAdvanceAmount(calculatedAdvanceAmount);
                      setDaysToComplete(calculatedDaysToComplete);
                      setLateFee(calculatedLateFee);
                      setRepaymentFrequency(plan.frequency);
                      setSelectedPlanId(String(val));
                      
                      // Removed setSelectedPlanName(plan.name) from here
                    } else {
                      console.log('Edit Customer - Clearing calculated values');
                      setSelectedCustomer(prev => ({
                        ...prev,
                        repayment_plan_id: val,
                        repayment_amount: '',
                        advance_amount: '',
                        days_to_complete: '',
                        late_fee_per_day: ''
                      }));
                      setSelectedPlanName('');
                    }
                  }} 
                  style={styles.formPicker}
                >
                  <Picker.Item label="Select Plan" value="" /> 
                  {planOptions.map(plan => (
                    <Picker.Item key={plan.id} label={plan.name} value={String(plan.id)} />
                  ))}
                </Picker>
                <Text style={styles.formLabel}>Amount Given</Text>
                <TextInput value={selectedCustomer.amount_given} onChangeText={val => {
                  console.log('Edit Customer - Amount changed:', val);
                  const newAmount = val;
                  
                  // Recalculate if plan is selected
                  const plan = repaymentPlans.find(p => String(p.id) === String(selectedCustomer.repayment_plan_id));
                  
                  if (plan && newAmount && parseFloat(newAmount) > 0) {
                    const scale = parseFloat(newAmount) / parseFloat(plan.base_amount);
                    const calculatedRepaymentAmount = (scale * plan.repayment_per_period).toFixed(2);
                    const calculatedAdvanceAmount = plan.advance_amount ? (scale * plan.advance_amount).toFixed(2) : '0';
                    const calculatedDaysToComplete = plan.periods.toString();
                    const calculatedLateFee = plan.late_fee_per_period ? plan.late_fee_per_period.toString() : '0';
                    
                    console.log('Edit Customer - Recalculated from amount change:', {
                      scale,
                      repaymentAmount: calculatedRepaymentAmount,
                      advanceAmount: calculatedAdvanceAmount,
                      daysToComplete: calculatedDaysToComplete,
                      lateFee: calculatedLateFee
                    });
                    
                    setSelectedCustomer(prev => ({
                      ...prev,
                      amount_given: newAmount,
                      repayment_amount: calculatedRepaymentAmount,
                      advance_amount: calculatedAdvanceAmount,
                      days_to_complete: calculatedDaysToComplete,
                      late_fee_per_day: calculatedLateFee,
                    }));
                    
                    // Also update form state for consistency
                    setAmountGiven(newAmount);
                    setRepaymentAmount(calculatedRepaymentAmount);
                    setAdvanceAmount(calculatedAdvanceAmount);
                    setDaysToComplete(calculatedDaysToComplete);
                    setLateFee(calculatedLateFee);
                  } else {
                    console.log('Edit Customer - Clearing calculated values (no plan or amount)');
                    setSelectedCustomer(prev => ({
                      ...prev,
                      amount_given: newAmount,
                      repayment_amount: '',
                      advance_amount: '',
                      days_to_complete: '',
                      late_fee_per_day: '',
                    }));
                    
                    // Also update form state
                    setAmountGiven(newAmount);
                    setRepaymentAmount('');
                    setAdvanceAmount('');
                    setDaysToComplete('');
                    setLateFee('');
                  }
                }} style={styles.input} keyboardType="numeric" />
                <Text style={styles.formLabel}>Repayment Amount (auto-calculated)</Text>
                <TextInput value={selectedCustomer.repayment_amount} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
                <Text style={styles.formLabel}>Advance Amount (auto-calculated)</Text>
                <TextInput value={selectedCustomer.advance_amount} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
                <Text style={styles.formLabel}>
                  {selectedCustomer.repayment_frequency === 'weekly' ? 'Weeks to Complete (auto-filled)' :
                   selectedCustomer.repayment_frequency === 'monthly' ? 'Months to Complete (auto-filled)' :
                   selectedCustomer.repayment_frequency === 'yearly' ? 'Years to Complete (auto-filled)' :
                   'Days to Complete (auto-filled)'}
                </Text>
                <TextInput value={selectedCustomer.days_to_complete} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
                <Text style={styles.formLabel}>Late Fee Per Period (auto-filled)</Text>
                <TextInput value={selectedCustomer.late_fee_per_day} editable={false} style={[styles.input, { backgroundColor: '#eee' }]} />
                
                <Text style={styles.sectionHeader}>Repayment Dates</Text>
                
                {/* Enhanced Date Range Picker Button */}
                <Text style={styles.formLabel}>Select Date Range (Start - End)</Text>
                <TouchableOpacity 
                  style={[
                    styles.input, 
                    { 
                      justifyContent: 'center', 
                      paddingVertical: 16, 
                      backgroundColor: startDate && endDate ? '#E8F5E8' : '#F0F8FF',
                      borderColor: startDate && endDate ? '#4CAF50' : '#007AFF',
                      borderWidth: 2
                    }
                  ]} 
                  onPress={showEnhancedDatePickerModal}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ 
                      fontSize: 16, 
                      fontWeight: 'bold', 
                      color: startDate && endDate ? '#2E7D32' : '#007AFF',
                      marginBottom: 4
                    }}>
                      📅 {startDate && endDate ? 'Date Range Selected' : 'Select Date Range'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ 
                        fontSize: 14, 
                        color: startDate ? '#333' : '#999',
                        fontWeight: startDate ? 'bold' : 'normal'
                      }}>
                        {startDate ? formatDate(startDate) : 'Start Date'}
                      </Text>
                      <Text style={{ marginHorizontal: 8, fontSize: 16, color: '#666' }}>✈️</Text>
                      <Text style={{ 
                        fontSize: 14, 
                        color: endDate ? '#333' : '#999',
                        fontWeight: endDate ? 'bold' : 'normal'
                      }}>
                        {endDate ? formatDate(endDate) : 'End Date'}
                      </Text>
                    </View>
                    {repaymentFrequency && (
                      <Text style={{ 
                        fontSize: 12, 
                        color: '#666', 
                        marginTop: 4,
                        fontStyle: 'italic'
                      }}>
                        Repayment: {repaymentFrequency} | Highlights: {repaymentFrequency === 'daily' ? daysToComplete + ' day intervals' : repaymentFrequency + ' intervals'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={{ maxHeight: 120 }}>
                  <ScrollView>
                    {customerDocs
                      .filter(doc => !isImage(doc))
                      .map(doc => (
                        <View key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <TouchableOpacity onPress={() => Linking.openURL(doc.file_data || '')} style={{ flex: 1 }}>
                            <Text style={styles.documentLink}>{doc.file_name} [Download]</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={async () => {
                            Alert.alert('Delete', 'Are you sure you want to delete this document?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => {
                                await supabase.from('customer_documents').delete().eq('id', doc.id);
                                fetchCustomerDocs(selectedCustomer.id);
                              }}
                            ]);
                          }}>
                            <Text style={{ color: 'red', marginLeft: 8 }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                  </ScrollView>
                </View>
                <TouchableOpacity onPress={async () => {
                  // Save edits
                  const { error } = await supabase.from('customers').update({
                    name: selectedCustomer.name,
                    mobile: selectedCustomer.mobile,
                    email: selectedCustomer.email,
                    book_no: selectedCustomer.book_no,
                    customer_type: selectedCustomer.customer_type,
                    remarks: selectedCustomer.remarks,
                    amount_given: selectedCustomer.amount_given,
                    days_to_complete: selectedCustomer.days_to_complete,
                    advance_amount: selectedCustomer.advance_amount,
                    late_fee_per_day: selectedCustomer.late_fee_per_day,
                    repayment_frequency: selectedCustomer.repayment_frequency,
                    repayment_amount: selectedCustomer.repayment_amount,
                    area_id: selectedCustomer.area_id,
                    start_date: startDate,
                    end_date: endDate
                  }).eq('id', selectedCustomer.id);
                  if (error) {
                    Alert.alert('Error', error.message);
                  } else {
                    Alert.alert('Success', 'Customer updated!');
                    setIsEditing(false);
                    setShowCustomerModal(false);
                    setSelectedCustomer(null);
                    // Refresh customer list
                    fetchCustomers();
                  }
                }} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setIsEditing(false); }} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={showTransactionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTransactionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: 30, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff' }]}> 
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.modalTitle, { flex: 1 }]}>{selectedCustomer?.name} Transactions</Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={handleDownloadTransactions} style={{ paddingHorizontal: 8 }}>
                  <MaterialIcons name="download" size={24} color="#4A90E2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDownloadTransactions} style={{ paddingHorizontal: 8 }}>
                  <MaterialIcons name="share" size={24} color="#4A90E2" />
                </TouchableOpacity>
              </View>
            </View>
            {transactionCustomer && (
              <>
                <FlatList
                  data={transactions}
                  renderItem={({ item }) => (
                    <>
                      <TouchableOpacity onPress={() => setExpandedTransactionId(expandedTransactionId === item.id ? null : item.id)}>
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          borderBottomWidth: 1, 
                          borderColor: '#eee', 
                          paddingVertical: 6,
                                      backgroundColor: areaId ? '#28a745' : '#999999',
                        }}>
                          <Text style={[styles.cell, { flex: 1 }]}>{item.transaction_type}</Text>
                          <Text style={[styles.cell, { flex: 1 }]}>₹{item.amount}</Text>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.cell}>{item.payment_mode || 'Cash'}</Text>
                            {item.payment_mode === 'upi' && item.upi_image && (
                              <Text style={{ color: '#4A90E2', fontSize: 12, marginLeft: 4 }}>📷</Text>
                            )}
                          </View>
                          <Text style={[styles.cell, { flex: 1 }]}>{new Date(item.transaction_date).toLocaleDateString()}</Text>
                        </View>
                      </TouchableOpacity>
                      {expandedTransactionId === item.id && (
                        <View style={{ backgroundColor: '#F7F9FC', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Transaction Details:</Text>
                          <Text>Type: {item.transaction_type}</Text>
                          <Text>Amount: ₹{item.amount}</Text>
                          <Text>Payment Mode: {item.payment_mode || 'Cash'}</Text>
                          <Text>Date: {new Date(item.transaction_date).toLocaleDateString()}</Text>
                          <Text>Remarks: {item.remarks || 'No remarks'}</Text>
                          {item.payment_mode === 'upi' && item.upi_image && (
                            <View style={{ alignItems: 'center', marginTop: 12, backgroundColor: '#F0F4F8', padding: 12, borderRadius: 8 }}>
                              <Text style={{ fontWeight: 'bold', marginBottom: 8, color: '#4A90E2' }}>UPI Payment Receipt</Text>
                              <TouchableOpacity onPress={() => openImageModal(item.upi_image, item, 'transaction')}>
                                <Image
                                  source={{ uri: item.upi_image }}
                                  style={{ width: 120, height: 120, borderRadius: 6, borderWidth: 2, borderColor: '#4A90E2', marginBottom: 8 }}
                                />
                              </TouchableOpacity>
                              <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Tap to view full image</Text>
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#FF3B30',
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  borderRadius: 6,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                }}
                                onPress={() => handleDeleteTransactionImage(item)}
                              >
                                <MaterialIcons name="delete" size={16} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Delete Receipt Image</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          <TouchableOpacity 
                            style={{ marginTop: 10, padding: 8, backgroundColor: '#FF3B30', borderRadius: 6, alignItems: 'center' }}
                            onPress={() => handleDeleteTransaction(item)}
                          >
                             <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Delete Transaction</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                  keyExtractor={item => item.id?.toString() || Math.random().toString()}
                  style={{ backgroundColor: '#fff', minHeight: 100 }}
                  ListEmptyComponent={<Text style={styles.transactionEmpty}>No transactions found.</Text>}
                  ListHeaderComponent={
                    <View>
                      {/* Customer Info and Date Range Display */}
                      <View style={{ backgroundColor: '#E8F4FD', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2E5BBA', marginBottom: 6 }}>Customer: {transactionCustomer.name}</Text>
                        <TouchableOpacity 
                          style={[styles.input, { justifyContent: 'center', paddingVertical: 12, backgroundColor: transactionCustomer?.start_date && transactionCustomer?.end_date ? '#e8f5e8' : '#f8f9fa' }]} 
                          onPress={() => setShowEnhancedDatePicker(true)}
                        >
                          <Text style={{ color: transactionCustomer?.start_date && transactionCustomer?.end_date ? '#2e7d32' : '#666', textAlign: 'center', fontSize: 16 }}>
                            {transactionCustomer?.start_date && transactionCustomer?.end_date 
                              ? `${formatDate(transactionCustomer.start_date)} 📅 ${formatDate(transactionCustomer.end_date)}`
                              : 'View Repayment Dates'
                            }
                          </Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: '#666', fontWeight: '500' }}>💰 Repayment:</Text>
                          <Text style={{ fontSize: 14, color: '#333', fontWeight: 'bold' }}>₹{transactionCustomer.repayment_amount} ({transactionCustomer.repayment_frequency})</Text>
                        </View>
                      </View>

                      {/* Financial Summary - Moved to Top */}
                      <View style={{ backgroundColor: '#F8F9FA', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#495057', marginBottom: 8, textAlign: 'center' }}>💼 Financial Summary</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: 'bold', color: '#DC3545', fontSize: 15 }}>⏳ Pending Amount:</Text>
                          <Text style={{ fontWeight: 'bold', color: '#DC3545', fontSize: 15 }}>₹{getPendingAmount()}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: 'bold', color: '#FD7E14', fontSize: 15 }}>📅 Pending Periods:</Text>
                          <Text style={{ fontWeight: 'bold', color: '#FD7E14', fontSize: 15 }}>{getPendingDays()}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: 'bold', color: '#28A745', fontSize: 15 }}>💵 Cash Received:</Text>
                          <Text style={{ fontWeight: 'bold', color: '#28A745', fontSize: 15 }}>₹{getTotalCashReceived()}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontWeight: 'bold', color: '#007BFF', fontSize: 15 }}>📱 UPI Received:</Text>
                          <Text style={{ fontWeight: 'bold', color: '#007BFF', fontSize: 15 }}>₹{getTotalUpiReceived()}</Text>
                        </View>
                      </View>

                      {/* Add Transaction form */}
                      <View style={{ backgroundColor: '#F7F9FC', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        <Text style={styles.modalTitle}>Add Transaction</Text>
                        
                        {/* Transaction Date Picker */}
                        <Text style={styles.formLabel}>Select Transaction Date</Text>
                        {transactionCustomer?.start_date && transactionCustomer?.end_date && (
                          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                            Customer Repayment Range: {formatDate(transactionCustomer.start_date)} - {formatDate(transactionCustomer.end_date)}
                          </Text>
                        )}
                        <TouchableOpacity 
                          style={[
                            styles.formInput, 
                            { 
                              justifyContent: 'space-between', 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              backgroundColor: transactionDate !== new Date().toISOString().split('T')[0] ? '#FFF3CD' : '#fff',
                              borderColor: transactionDate !== new Date().toISOString().split('T')[0] ? '#856404' : '#ccc',
                              paddingRight: 10 
                            }
                          ]}
                          onPress={() => setShowTransactionDatePicker(true)}
                        >
                          <View>
                            <Text style={{ 
                              color: transactionDate !== new Date().toISOString().split('T')[0] ? '#856404' : '#333',
                              fontWeight: transactionDate !== new Date().toISOString().split('T')[0] ? 'bold' : 'normal'
                            }}>
                              {formatDate(transactionDate)} {transactionDate === new Date().toISOString().split('T')[0] ? '(Today)' : '(Custom Date)'}
                            </Text>
                          </View>
                          <MaterialIcons name="calendar-today" size={24} color="#007AFF" />
                        </TouchableOpacity>
                        {showTransactionDatePicker && (
                          <EnhancedDatePicker
                            visible={showTransactionDatePicker}
                            onClose={() => setShowTransactionDatePicker(false)}
                            onDateSelect={(date) => {
                              setTransactionDate(date.startDate); // In single mode, startDate holds the selected date
                              setShowTransactionDatePicker(false);
                            }}
                            startDate={transactionDate} // Pass the current transactionDate as startDate
                            endDate={transactionCustomer?.end_date}
                            repaymentFrequency={transactionCustomer?.repayment_frequency}
                            daysToComplete={transactionCustomer?.days_to_complete}
                            selectionMode="single"
                          />
                        )}
                        <TextInput value={newTransactionAmount} onChangeText={setNewTransactionAmount} placeholder="Amount" keyboardType="numeric" style={styles.formInput} />
                        <Picker selectedValue={newTransactionType} onValueChange={setNewTransactionType} style={styles.formPicker}>
                          <Picker.Item label="Repayment" value="repayment" />
                          <Picker.Item label="Advance" value="advance" />
                          <Picker.Item label="Late Fee" value="late_fee" />
                          <Picker.Item label="Given" value="given" />
                        </Picker>
                        <Picker selectedValue={newTransactionPaymentType} onValueChange={setNewTransactionPaymentType} style={styles.formPicker}>
                          <Picker.Item label="Select Payment Type" value="" />
                          <Picker.Item label="Cash" value="cash" />
                          <Picker.Item label="UPI" value="upi" />
                        </Picker>
                        {newTransactionPaymentType === 'upi' && (
                          <View style={{ marginVertical: 8 }}>
                            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadUPIImage}>
                              <Text style={styles.uploadButtonText}>
                                {newTransactionUPIImageUrl ? '📷 Change UPI Receipt' : '📷 Add UPI Receipt'}
                              </Text>
                            </TouchableOpacity>
                            {newTransactionUPIImageUrl ? (
                              <View style={{ marginTop: 8, alignItems: 'center', position: 'relative' }}>
                                <TouchableOpacity onPress={() => openImageModal(newTransactionUPIImageUrl)}>
                                  <Image
                                    source={{ uri: newTransactionUPIImageUrl }}
                                    style={{ width: 80, height: 80, borderRadius: 6, borderWidth: 1, borderColor: '#4A90E2' }}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: '#FF3B30',
                                    paddingVertical: 4,
                                    paddingHorizontal: 10,
                                    borderRadius: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 6,
                                  }}
                                  onPress={() => {
                                    deleteImageFromStorage(newTransactionUPIImageUrl, 'customerstracker');
                                    setNewTransactionUPIImageUrl('');
                                  }}
                                >
                                  <MaterialIcons name="delete" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Remove Image</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </View>
                        )}
                        <TextInput value={newTransactionRemarks} onChangeText={setNewTransactionRemarks} placeholder="Remarks" style={styles.formInput} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                          <TouchableOpacity onPress={() => setShowTransactionModal(false)} style={{ flex: 1, backgroundColor: '#ccc', borderRadius: 8, paddingVertical: 12, marginRight: 8, alignItems: 'center' }}>
                            <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#007AFF', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, isTransactionSaving && { opacity: 0.5 }]} onPress={handleAddTransaction} disabled={isTransactionSaving}>
              <MaterialIcons name="add" size={24} color="white" />
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 5 }}>Add Transaction</Text>
            </TouchableOpacity>
                        </View>
                      </View>

                      {/* Transaction grid header row */}
                      <View style={{ flexDirection: 'row', backgroundColor: '#E3E6F0', borderRadius: 6, paddingVertical: 6, marginBottom: 4, alignItems: 'center' }}>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Type</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Amount</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Payment</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Date</Text>
                      </View>
                    </View>
                  }
                />
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={showDocModal} transparent={true} animationType="fade" onRequestClose={() => { setShowDocModal(false); setActiveDocModalItem(null); }}>
        <TouchableOpacity style={styles.modalOverlay} onPressOut={() => { setShowDocModal(false); setActiveDocModalItem(null); }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Image source={{ uri: docModalUri }} style={{ width: 320, height: 320, borderRadius: 8, borderWidth: 3, borderColor: '#4A90E2', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6, resizeMode: 'contain', backgroundColor: '#000' }} />
            <View style={{ flexDirection: 'row', marginTop: 16, alignItems: 'center' }}>
              {activeDocModalItem && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FF3B30',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                  onPress={() => {
                    if (activeDocModalItem.type === 'customerDoc') {
                      handleDeleteCustomerDoc(activeDocModalItem.item);
                    } else if (activeDocModalItem.type === 'transaction') {
                      handleDeleteTransactionImage(activeDocModalItem.item);
                    }
                  }}
                >
                  <MaterialIcons name="delete" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Delete Image</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.docModalCloseButton} onPress={() => { setShowDocModal(false); setActiveDocModalItem(null); }}>
                <Text style={styles.docModalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    
      
      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}

      {/* Enhanced Date Picker Modal */}
      <EnhancedDatePicker
        visible={showEnhancedDatePicker}
        onClose={() => setShowEnhancedDatePicker(false)}
        onDateSelect={onEnhancedDateSelect}
        startDate={startDate}
        endDate={endDate}
        repaymentFrequency={repaymentFrequency}
        daysToComplete={daysToComplete}
      />

      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Status</Text>
            <TextInput
              placeholder="Add remarks (optional)"
              style={styles.input}
              value={statusChangeRemarks}
              onChangeText={setStatusChangeRemarks}
            />
            {selectedCustomer?.status !== 'Active' && (
              <TouchableOpacity style={styles.statusButton} onPress={async () => { await updateCustomerStatus(selectedCustomer.id, 'Active', statusChangeRemarks); setShowStatusModal(false); }}>
                <Text style={styles.statusButtonText}>Active</Text>
              </TouchableOpacity>
            )}
            {selectedCustomer?.status !== 'Inactive' && (
              <TouchableOpacity style={styles.statusButton} onPress={async () => { await updateCustomerStatus(selectedCustomer.id, 'Inactive', statusChangeRemarks); setShowStatusModal(false); }}>
                <Text style={styles.statusButtonText}>Inactive</Text>
              </TouchableOpacity>
            )}
            {selectedCustomer?.status !== 'Closed' && (
              <TouchableOpacity style={styles.statusButton} onPress={async () => {
                const hasOpenTransactions = await checkCustomerHasOpenTransactions(selectedCustomer.id);
                if (hasOpenTransactions) {
                  Alert.alert('Error', 'This customer has pending transactions and cannot be closed.');
                  setShowStatusModal(false);
                } else {
                  await updateCustomerStatus(selectedCustomer.id, 'Closed', statusChangeRemarks);
                  setShowStatusModal(false);
                }
              }}>
                <Text style={styles.statusButtonText}>Closed</Text>
              </TouchableOpacity>
            )}
            {selectedCustomer?.status !== 'Defaulted' && (
              <TouchableOpacity style={styles.statusButton} onPress={async () => { await updateCustomerStatus(selectedCustomer.id, 'Defaulted', statusChangeRemarks); setShowStatusModal(false); }}>
                <Text style={styles.statusButtonText}>Defaulted</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.cancelButton, {marginTop: 10}]} onPress={() => setShowStatusModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customer Map Modal */}
      <CustomerMapModal
        visible={showCustomerMapModal}
        onClose={() => {
          setShowCustomerMapModal(false);
          setMapFocusedCustomer(null);
          setMapInitialMode('view');
        }}
        customers={filteredCustomers && filteredCustomers.length > 0 ? filteredCustomers : customers}
        selectedAreaName={selectedAreaName}
        focusedCustomer={mapFocusedCustomer}
        initialMode={mapInitialMode}
        onUpdateLocation={handleUpdateCustomerLocation}
      />
    </View>
  );
}