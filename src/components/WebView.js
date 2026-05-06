import React, { forwardRef } from 'react';
import { Platform, View, Text } from 'react-native';

let WebViewComponent;

if (Platform.OS === 'web') {
  WebViewComponent = forwardRef((props, ref) => {
    const { source, style } = props;
    if (source && source.uri) {
      return (
        <iframe
          ref={ref}
          src={source.uri}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            ...style,
          }}
          title="WebView Content"
        />
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
