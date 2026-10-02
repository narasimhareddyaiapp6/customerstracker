import React, { forwardRef } from 'react';
import { Platform, View, Text, TouchableOpacity, Linking } from 'react-native';

let WebViewComponent;

if (Platform.OS === 'web') {
  WebViewComponent = forwardRef((props, ref) => {
    const { source, style } = props;
    const uri = source?.uri;

    const handleOpenInNewTab = () => {
      if (uri) {
        if (typeof window !== 'undefined' && window.open) {
          window.open(uri, '_blank', 'noopener,noreferrer');
        } else {
          Linking.openURL(uri);
        }
      }
    };

    if (uri) {
      return (
        <View style={[{ flex: 1, width: '100%', height: '100%' }, style]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#334155',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                {uri}
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                Sites like newspapers & astrology restrict iframe embedding (X-Frame-Options).
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleOpenInNewTab}
              style={{
                backgroundColor: '#2563EB',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                Open in New Tab ↗
              </Text>
            </TouchableOpacity>
          </View>
          <iframe
            ref={ref}
            src={uri}
            style={{
              width: '100%',
              height: '100%',
              flex: 1,
              border: 'none',
            }}
            title="WebView Content"
          />
        </View>
      );
    }
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, style]}>
        <Text>WebView is not supported on web with this source.</Text>
      </View>
    );
  });
} else {
  try {
    const { WebView: RNWebView } = require('react-native-webview');
    WebViewComponent = forwardRef((props, ref) => {
      return <RNWebView ref={ref} {...props} />;
    });
  } catch (e) {
    WebViewComponent = forwardRef((props, ref) => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>WebView module not found.</Text>
      </View>
    ));
  }
}

export const WebView = WebViewComponent;
export default WebView;
