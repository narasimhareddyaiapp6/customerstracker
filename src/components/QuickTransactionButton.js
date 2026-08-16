import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const QuickTransactionButton = ({ onPress, style, showLabel = true }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Subtle breathing scale pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Smooth blinking flash effect on the icon & beacon dot
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );

    // 3. Glowing ripple / halo ping
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    );

    pulse.start();
    blink.start();
    glow.start();

    return () => {
      pulse.stop();
      blink.stop();
      glow.stop();
    };
  }, [pulseAnim, blinkAnim, glowAnim]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Alert.alert('Quick Transaction', 'Quick transaction logic not implemented yet.');
    }
  };

  const haloScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.25],
  });

  const haloOpacity = glowAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.5, 0.25, 0],
  });

  const dotScale = blinkAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.75, 1.25],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {/* Animated glowing halo ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.haloRing,
          {
            transform: [{ scale: haloScale }],
            opacity: haloOpacity,
          },
        ]}
      />

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          activeOpacity={0.75}
          accessibilityLabel="Quick Transaction"
          accessibilityRole="button"
          accessibilityHint="Opens Quick Transaction screen"
        >
          {/* Animated blinking flash icon */}
          <Animated.View style={[styles.iconContainer, { opacity: blinkAnim }]}>
            <MaterialIcons name="flash-on" size={17} color="#FFFFFF" />
          </Animated.View>

          {showLabel && <Text style={styles.buttonText}>Quick Tx</Text>}

          {/* Small blinking beacon dot */}
          <Animated.View
            style={[
              styles.liveDot,
              {
                opacity: blinkAnim,
                transform: [{ scale: dotScale }],
              },
            ]}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 20,
    backgroundColor: '#FF9500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500', // Vibrant amber/orange highlight
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFA726',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 3,
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginLeft: 4,
  },
});

export default QuickTransactionButton;