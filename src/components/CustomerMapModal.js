import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import WebView from './WebView';

export default function CustomerMapModal({
  visible,
  onClose,
  customers = [],
  selectedAreaName = '',
  focusedCustomer = null,
  initialMode = 'view', // 'view' or 'pick'
  onUpdateLocation = null,
}) {
  const [currentMode, setCurrentMode] = useState(initialMode || 'view');
  const [pinningCustomer, setPinningCustomer] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Filter customers with valid coordinates
  const customersWithCoords = useMemo(() => {
    return (customers || []).filter(
      c => c && c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined &&
           !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)) &&
           parseFloat(c.latitude) !== 0 && parseFloat(c.longitude) !== 0
    );
  }, [customers]);

  const customersWithoutCoords = useMemo(() => {
    return (customers || []).filter(
      c => !c || c.latitude === null || c.latitude === undefined || c.longitude === null || c.longitude === undefined ||
           isNaN(parseFloat(c.latitude)) || isNaN(parseFloat(c.longitude)) ||
           parseFloat(c.latitude) === 0 || parseFloat(c.longitude) === 0
    );
  }, [customers]);

  // Handle initialization when modal opens or focused customer/initialMode changes
  useEffect(() => {
    if (visible) {
      const mode = initialMode || 'view';
      setCurrentMode(mode);

      if (focusedCustomer) {
        setPinningCustomer(focusedCustomer);
        const hasCoords = focusedCustomer.latitude != null &&
          focusedCustomer.longitude != null &&
          !isNaN(parseFloat(focusedCustomer.latitude)) &&
          parseFloat(focusedCustomer.latitude) !== 0;

        if (hasCoords) {
          setSelectedCoords({
            lat: parseFloat(focusedCustomer.latitude),
            lng: parseFloat(focusedCustomer.longitude),
          });
        } else {
          // If in pick mode or unpinned, provide default coords and enter pick mode
          setCurrentMode('pick');
          if (customersWithCoords.length > 0) {
            setSelectedCoords({
              lat: parseFloat(customersWithCoords[0].latitude),
              lng: parseFloat(customersWithCoords[0].longitude),
            });
          } else {
            setSelectedCoords({ lat: 17.3850, lng: 78.4867 });
          }
        }
      } else {
        setPinningCustomer(null);
        setSelectedCoords(null);
      }
    }
  }, [focusedCustomer, visible, initialMode, customersWithCoords]);

  // Default center calculation
  const defaultCenter = useMemo(() => {
    if (focusedCustomer && focusedCustomer.latitude && focusedCustomer.longitude && !isNaN(parseFloat(focusedCustomer.latitude))) {
      return { lat: parseFloat(focusedCustomer.latitude), lng: parseFloat(focusedCustomer.longitude), zoom: 16 };
    }
    if (selectedCoords) {
      return { lat: selectedCoords.lat, lng: selectedCoords.lng, zoom: 16 };
    }
    if (customersWithCoords.length > 0) {
      const avgLat = customersWithCoords.reduce((sum, c) => sum + parseFloat(c.latitude), 0) / customersWithCoords.length;
      const avgLng = customersWithCoords.reduce((sum, c) => sum + parseFloat(c.longitude), 0) / customersWithCoords.length;
      return { lat: avgLat, lng: avgLng, zoom: 13 };
    }
    return { lat: 17.3850, lng: 78.4867, zoom: 12 };
  }, [focusedCustomer, customersWithCoords, selectedCoords]);

  // Build Leaflet HTML
  const leafletHtml = useMemo(() => {
    const isPickMode = currentMode === 'pick';
    const activeCustomer = pinningCustomer || focusedCustomer;
    const activeCustomerName = activeCustomer ? (activeCustomer.name || 'Customer') : '';
    const focusedId = focusedCustomer && focusedCustomer.id ? String(focusedCustomer.id) : null;
    
    const initialLat = selectedCoords ? selectedCoords.lat : defaultCenter.lat;
    const initialLng = selectedCoords ? selectedCoords.lng : defaultCenter.lng;
    const initialZoom = defaultCenter.zoom;

    const markersJson = JSON.stringify(
      customersWithCoords.map(c => ({
        id: String(c.id),
        name: c.name || 'Customer',
        book_no: c.book_no || '',
        mobile: c.mobile || '',
        amount_given: c.amount_given || 0,
        repayment_amount: c.repayment_amount || 0,
        address: c.address || '',
        landmark: c.landmark || '',
        status: c.status || 'Active',
        lat: parseFloat(c.latitude),
        lng: parseFloat(c.longitude),
      }))
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .custom-pin {
            background-color: #007AFF;
            color: #FFFFFF;
            border: 2px solid #FFFFFF;
            border-radius: 20px;
            padding: 5px 10px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            white-space: nowrap;
            display: inline-block;
            text-align: center;
            transition: all 0.3s ease;
          }
          .custom-pin.closed { background-color: #333333; }
          .custom-pin.defaulted { background-color: #E53935; }
          .custom-pin.active { background-color: #2E7D32; }

          /* Prominently Highlighted Pin for Selected Customer */
          .custom-pin.highlighted {
            background-color: #FF6F00 !important;
            border: 3px solid #FFF59D !important;
            color: #FFFFFF !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            box-shadow: 0 0 16px rgba(255, 111, 0, 0.95), 0 3px 8px rgba(0,0,0,0.4) !important;
            transform: scale(1.18);
            z-index: 9999 !important;
            animation: pulseGlow 1.8s infinite;
          }

          @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 0 rgba(255, 111, 0, 0.8), 0 3px 8px rgba(0,0,0,0.4); }
            70% { box-shadow: 0 0 0 12px rgba(255, 111, 0, 0), 0 3px 8px rgba(0,0,0,0.4); }
            100% { box-shadow: 0 0 0 0 rgba(255, 111, 0, 0), 0 3px 8px rgba(0,0,0,0.4); }
          }

          .popup-card {
            padding: 4px;
            min-width: 200px;
            font-family: sans-serif;
          }
          .popup-title {
            font-size: 15px;
            font-weight: bold;
            color: #1A237E;
            margin-bottom: 4px;
          }
          .popup-title.highlighted-title {
            color: #E65100;
          }
          .popup-sub {
            font-size: 13px;
            color: #444;
            margin-bottom: 3px;
          }
          .popup-badge {
            display: inline-block;
            background: #E8F4FD;
            color: #007AFF;
            font-size: 11px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 6px;
          }
          .popup-badge.highlighted-badge {
            background: #FFF3E0;
            color: #E65100;
            border: 1px solid #FFE0B2;
          }
          .popup-btn {
            display: block;
            background-color: #007AFF;
            color: #FFFFFF !important;
            text-align: center;
            padding: 6px 10px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            font-size: 12px;
            margin-top: 6px;
          }
          .popup-btn.call {
            background-color: #2E7D32;
            margin-top: 4px;
          }
          .popup-btn.repin {
            background-color: #FF6F00;
            margin-top: 4px;
          }
          .pin-toast {
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 35, 126, 0.92);
            color: #FFFFFF;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 3px 10px rgba(0,0,0,0.35);
            text-align: center;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        ${isPickMode ? '<div class="pin-toast">📍 Tap map or drag marker to set location</div>' : ''}
        <script>
          function postMessageToApp(data) {
            var msg = JSON.stringify(data);
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(msg);
              }
            } catch (e) {}
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(msg, '*');
              }
            } catch (e) {}
          }

          window.repinCustomer = function(customerId) {
            postMessageToApp({ type: 'start_repin', customerId: customerId });
          };

          const map = L.map('map').setView([${initialLat}, ${initialLng}], ${initialZoom});

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          const isPickMode = ${isPickMode};
          const focusedId = ${focusedId ? JSON.stringify(focusedId) : 'null'};
          const activeCustName = ${JSON.stringify(activeCustomerName)};
          const customers = ${markersJson};
          const markers = [];
          let focusedMarker = null;
          let activePickMarker = null;

          // Render all customer markers on the map
          customers.forEach(c => {
            const isFocused = focusedId && (c.id === focusedId);
            const statusClass = (c.status || '').toLowerCase();
            const highlightClass = isFocused ? 'highlighted' : '';
            const badgePrefix = isFocused ? '⭐ ' : '';
            const badgeText = badgePrefix + (c.book_no ? 'Card #' + c.book_no : c.name);
            
            const icon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div class="custom-pin ' + statusClass + ' ' + highlightClass + '">' + badgeText + '</div>',
              iconSize: null,
              iconAnchor: [30, 20]
            });

            const gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng;
            
            let popupContent = '<div class="popup-card">' +
              '<div class="popup-title ' + (isFocused ? 'highlighted-title' : '') + '">' + (isFocused ? '⭐ ' : '') + (c.name || 'Customer') + '</div>' +
              (c.book_no ? '<div class="popup-badge ' + (isFocused ? 'highlighted-badge' : '') + '">Card No: ' + c.book_no + '</div>' : '') +
              (c.mobile ? '<div class="popup-sub">📱 ' + c.mobile + '</div>' : '') +
              (c.amount_given ? '<div class="popup-sub">💰 Given: ₹' + c.amount_given + '</div>' : '') +
              (c.repayment_amount ? '<div class="popup-sub">💵 Repayment: ₹' + c.repayment_amount + '</div>' : '') +
              (c.address || c.landmark ? '<div class="popup-sub">📍 ' + (c.landmark || c.address) + '</div>' : '') +
              (c.mobile ? '<a class="popup-btn call" href="tel:' + c.mobile + '">📞 Call Customer</a>' : '') +
              '<a class="popup-btn" target="_blank" href="' + gmapsUrl + '">🗺️ Open in Google Maps</a>' +
              '<a class="popup-btn repin" href="javascript:void(0)" onclick="window.repinCustomer(\\'' + c.id + '\\')">📍 Change Location Pin</a>' +
            '</div>';

            const marker = L.marker([c.lat, c.lng], { 
              icon: icon,
              zIndexOffset: isFocused ? 1000 : 0
            }).addTo(map).bindPopup(popupContent);
            
            markers.push(marker);

            if (isFocused) {
              focusedMarker = marker;
            }
          });

          // Pick Mode Behavior (Interactive Pinning)
          if (isPickMode) {
            activePickMarker = L.marker([${initialLat}, ${initialLng}], {
              draggable: true,
              autoPan: true,
              zIndexOffset: 2000
            }).addTo(map);

            activePickMarker.bindPopup('<b>📍 ' + (activeCustName || 'Selected Location') + '</b><br>Lat: ' + (${initialLat}).toFixed(5) + '<br>Lng: ' + (${initialLng}).toFixed(5) + '<br><i>(Drag marker or tap map to move)</i>').openPopup();

            activePickMarker.on('dragend', function(e) {
              const pos = e.target.getLatLng();
              activePickMarker.bindPopup('<b>📍 ' + (activeCustName || 'Selected Location') + '</b><br>Lat: ' + pos.lat.toFixed(5) + '<br>Lng: ' + pos.lng.toFixed(5)).openPopup();
              postMessageToApp({ type: 'location_selected', lat: pos.lat, lng: pos.lng });
            });

            map.on('click', function(e) {
              const lat = e.latlng.lat;
              const lng = e.latlng.lng;
              if (activePickMarker) {
                activePickMarker.setLatLng([lat, lng]);
                activePickMarker.bindPopup('<b>📍 ' + (activeCustName || 'Selected Location') + '</b><br>Lat: ' + lat.toFixed(5) + '<br>Lng: ' + lng.toFixed(5)).openPopup();
              } else {
                activePickMarker = L.marker([lat, lng], { draggable: true, zIndexOffset: 2000 }).addTo(map);
              }
              postMessageToApp({ type: 'location_selected', lat: lat, lng: lng });
            });
          } else {
            // View Mode: Auto-Focus and Open Details Popup for Selected Customer
            if (focusedMarker) {
              map.setView(focusedMarker.getLatLng(), 16);
              setTimeout(function() {
                focusedMarker.openPopup();
              }, 300);
            } else if (markers.length > 1) {
              const group = new L.featureGroup(markers);
              map.fitBounds(group.getBounds().pad(0.15));
            } else if (markers.length === 1) {
              markers[0].openPopup();
            }
          }
        </script>
      </body>
      </html>
    `;
  }, [customersWithCoords, defaultCenter, pinningCustomer, focusedCustomer, currentMode, selectedCoords]);

  const handleMessage = (event) => {
    try {
      const data = typeof event.nativeEvent.data === 'string' 
        ? JSON.parse(event.nativeEvent.data) 
        : event.nativeEvent.data;

      if (data && data.type === 'location_selected') {
        setSelectedCoords({
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
        });
      } else if (data && data.type === 'start_repin') {
        // User clicked "Change Location Pin" inside a customer popup
        const cust = (customers || []).find(c => String(c.id) === String(data.customerId));
        if (cust) {
          setPinningCustomer(cust);
          if (cust.latitude && cust.longitude) {
            setSelectedCoords({
              lat: parseFloat(cust.latitude),
              lng: parseFloat(cust.longitude),
            });
          }
          setCurrentMode('pick');
        }
      }
    } catch (e) {
      console.warn('Map postMessage error:', e);
    }
  };

  const handleConfirmLocation = () => {
    if (!selectedCoords) {
      Alert.alert('No Location Selected', 'Please tap on the map to choose a location point.');
      return;
    }
    const customerId = pinningCustomer ? pinningCustomer.id : (focusedCustomer ? focusedCustomer.id : null);
    if (onUpdateLocation) {
      onUpdateLocation(customerId, selectedCoords.lat, selectedCoords.lng);
    }
    onClose();
  };

  const openInNativeMaps = () => {
    const targetCust = pinningCustomer || focusedCustomer || (customersWithCoords.length > 0 ? customersWithCoords[0] : null);
    if (selectedCoords) {
      const lat = selectedCoords.lat;
      const lon = selectedCoords.lng;
      const scheme = Platform.select({
        ios: `maps:0,0?q=${lat},${lon}(${targetCust?.name || 'Customer'})`,
        android: `geo:0,0?q=${lat},${lon}(${targetCust?.name || 'Customer'})`,
      });
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      Linking.openURL(Platform.OS === 'web' ? webUrl : scheme).catch(() => Linking.openURL(webUrl));
    } else if (targetCust && targetCust.latitude && targetCust.longitude) {
      const lat = parseFloat(targetCust.latitude);
      const lon = parseFloat(targetCust.longitude);
      const scheme = Platform.select({
        ios: `maps:0,0?q=${lat},${lon}(${targetCust.name || 'Customer'})`,
        android: `geo:0,0?q=${lat},${lon}(${targetCust.name || 'Customer'})`,
      });
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      Linking.openURL(Platform.OS === 'web' ? webUrl : scheme).catch(() => Linking.openURL(webUrl));
    }
  };

  const isPickMode = currentMode === 'pick';
  const activeCustomer = pinningCustomer || focusedCustomer;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isPickMode
                ? `📍 Pin Location: ${activeCustomer?.name || 'Customer'}`
                : (focusedCustomer ? `⭐ ${focusedCustomer.name}` : `🗺️ ${selectedAreaName || 'Customers Map'}`)}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {isPickMode
                ? (selectedCoords ? `Lat: ${selectedCoords.lat.toFixed(5)}, Lng: ${selectedCoords.lng.toFixed(5)}` : 'Tap or drag pin to position')
                : (focusedCustomer
                    ? (focusedCustomer.book_no ? `Card #${focusedCustomer.book_no} | ${focusedCustomer.mobile || 'No mobile'}` : `${focusedCustomer.mobile || 'Customer Details'}`)
                    : `${customersWithCoords.length} of ${customers.length} customer(s) mapped`)}
            </Text>
          </View>

          {/* Action buttons on header */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {focusedCustomer && !isPickMode && (
              <TouchableOpacity
                style={styles.repinHeaderBtn}
                onPress={() => {
                  setPinningCustomer(focusedCustomer);
                  if (focusedCustomer.latitude && focusedCustomer.longitude) {
                    setSelectedCoords({
                      lat: parseFloat(focusedCustomer.latitude),
                      lng: parseFloat(focusedCustomer.longitude),
                    });
                  }
                  setCurrentMode('pick');
                }}
              >
                <MaterialIcons name="edit-location" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.repinHeaderBtnText}>Move Pin</Text>
              </TouchableOpacity>
            )}

            {!isPickMode && (focusedCustomer || customersWithCoords.length > 0) && (
              <TouchableOpacity style={styles.directionsBtn} onPress={openInNativeMaps}>
                <MaterialIcons name="navigation" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.directionsBtnText}>Maps App</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Map View */}
        <View style={styles.mapWrapper}>
          <WebView
            source={{ html: leafletHtml }}
            style={styles.map}
            onMessage={handleMessage}
            onLoadEnd={() => setMapLoaded(true)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>

        {/* Bottom Confirm Location Bar (in pick/pin mode) */}
        {isPickMode && (
          <View style={styles.confirmBar}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.confirmTitle} numberOfLines={1}>
                📍 {activeCustomer?.name || 'Customer'}
              </Text>
              <Text style={styles.confirmSubtitle}>
                {selectedCoords 
                  ? `Lat: ${selectedCoords.lat.toFixed(6)}, Lng: ${selectedCoords.lng.toFixed(6)}` 
                  : 'Tap on the map to choose point'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {focusedCustomer && !initialMode?.includes('pick') && (
                <TouchableOpacity
                  style={styles.cancelPinBtn}
                  onPress={() => setCurrentMode('view')}
                >
                  <Text style={styles.cancelPinText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveLocationBtn, !selectedCoords && { backgroundColor: '#B0BEC5' }]}
                onPress={handleConfirmLocation}
                disabled={!selectedCoords}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check-circle" size={18} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.saveLocationBtnText}>Set Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Unpinned Customer List Bar (if any without GPS in View All mode) */}
        {!focusedCustomer && !isPickMode && customersWithoutCoords.length > 0 && onUpdateLocation && (
          <View style={styles.unpinnedContainer}>
            <Text style={styles.unpinnedTitle}>
              ⚠️ {customersWithoutCoords.length} Customer(s) without GPS location:
            </Text>
            <View style={styles.unpinnedChips}>
              {customersWithoutCoords.slice(0, 6).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.unpinnedChip}
                  onPress={() => {
                    setPinningCustomer(c);
                    if (c.latitude && c.longitude) {
                      setSelectedCoords({ lat: parseFloat(c.latitude), lng: parseFloat(c.longitude) });
                    }
                    setCurrentMode('pick');
                  }}
                >
                  <MaterialIcons name="add-location" size={14} color="#007AFF" style={{ marginRight: 4 }} />
                  <Text style={styles.unpinnedChipText} numberOfLines={1}>
                    {c.book_no ? `#${c.book_no} ${c.name}` : c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 50 : 14,
    paddingBottom: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    elevation: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  repinHeaderBtn: {
    backgroundColor: '#FF6F00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  repinHeaderBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  directionsBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  directionsBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#E9ECEF',
  },
  mapWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  confirmSubtitle: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cancelPinBtn: {
    backgroundColor: '#ECEFF1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPinText: {
    color: '#455A64',
    fontWeight: 'bold',
    fontSize: 13,
  },
  saveLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  saveLocationBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  unpinnedContainer: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    maxHeight: 120,
  },
  unpinnedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 6,
  },
  unpinnedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unpinnedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  unpinnedChipText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});
