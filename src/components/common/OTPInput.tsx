import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { extractBestOTP, clipboardContainsOTP, isValidOTP } from '../../utils/otpUtils';

export interface OTPInputRef {
  focusIndex: (index: number) => void;
}

interface OTPInputProps {
  length: number;
  value: string[];
  onChange: (value: string[]) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  showPasteButton?: boolean;
  error?: boolean;
  disabled?: boolean;
  manualOnly?: boolean; // When true, disable clipboard/paste and force manual entry
}

const OTPInput = forwardRef<OTPInputRef, OTPInputProps>(OTPInputInternal);

export default OTPInput;

function OTPInputInternal({
  length,
  value,
  onChange,
  onComplete,
  autoFocus = true,
  showPasteButton = true,
  error = false,
  disabled = false,
  manualOnly = false,
}: OTPInputProps, ref: React.Ref<OTPInputRef>) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [successAnimation] = useState(new Animated.Value(0));
  // Expose imperative focus control
  useImperativeHandle(ref, () => ({
    focusIndex: (index: number) => {
      const clamped = Math.max(0, Math.min(length - 1, index));
      inputRefs.current[clamped]?.focus();
    },
  }), [length]);


  // Animation functions
  const triggerShakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate(100);
    }
  }, [shakeAnimation]);

  const triggerSuccessAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(successAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(successAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [successAnimation]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [autoFocus]);

  // Listen for clipboard changes to detect OTP (disabled in manualOnly mode)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (!manualOnly && Platform.OS === 'android') {
      // On Android, we'll check clipboard periodically since we can't listen to changes directly
      interval = setInterval(async () => {
        try {
          const clipboardContent = await Clipboard.getStringAsync();
          if (clipboardContent) {
            const otpCode = extractBestOTP(clipboardContent, length);
            if (otpCode && !isListening) {
              console.log('OTP detected in clipboard:', otpCode);
              
              // Fill the OTP inputs
              const newOtp = new Array(length).fill('');
              for (let i = 0; i < Math.min(otpCode.length, length); i++) {
                newOtp[i] = otpCode[i];
              }
              
              onChange(newOtp);
              
              // Focus the next empty input or the last one
              const nextEmptyIndex = newOtp.findIndex(digit => !digit);
              const focusIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : length - 1;
              inputRefs.current[focusIndex]?.focus();
              
              // Clear clipboard after auto-fill
              await Clipboard.setStringAsync('');
              
              // Call onComplete if all digits are filled
              if (newOtp.every(digit => digit !== '')) {
                onComplete?.(newOtp.join(''));
              }
            }
          }
        } catch (error) {
          console.log('Error checking clipboard:', error);
        }
      }, 1000); // Check every second
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [length, onChange, onComplete, isListening, manualOnly]);

  const handleOtpChange = useCallback((inputValue: string, index: number) => {
    if (disabled) return;
    
    const newOtp = [...value];
    
    // Handle deletion explicitly (empty string from backspace)
    if (inputValue.length === 0) {
      if (newOtp[index]) {
        newOtp[index] = '';
      }
      onChange(newOtp);
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    
    // Handle single digit input
    if (inputValue.length === 1) {
      // Validate that it's a digit
      if (!/^\d$/.test(inputValue)) {
        triggerShakeAnimation();
        return;
      }
      
      newOtp[index] = inputValue;
      
      // Auto-focus next input
      if (inputValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (inputValue.length > 1) {
      // Prevent paste in manual-only mode
      if (manualOnly) {
        triggerShakeAnimation();
        return;
      }
      // Handle paste operation - extract digits only (allowed when not manualOnly)
      const digits = inputValue.replace(/\D/g, '').split('');
      if (digits.length === 0) {
        triggerShakeAnimation();
        return;
      }
      for (let i = 0; i < Math.min(digits.length, length - index); i++) {
        newOtp[index + i] = digits[i];
      }
      const nextEmptyIndex = newOtp.findIndex(digit => !digit);
      const focusIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : length - 1;
      inputRefs.current[focusIndex]?.focus();
    }
    
    onChange(newOtp);
    
    // Call onComplete if all digits are filled and valid
    if (newOtp.every(digit => digit !== '')) {
      const otpString = newOtp.join('');
      if (isValidOTP(otpString, length)) {
        triggerSuccessAnimation();
        onComplete?.(otpString);
      }
    }
  }, [length, onChange, onComplete, value, disabled, triggerShakeAnimation, triggerSuccessAnimation, manualOnly]);

  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key !== 'Backspace') return;
    
    // If current box has a value, clear it
    if (value[index]) {
      const newOtp = [...value];
      newOtp[index] = '';
      onChange(newOtp);
      // After clearing, move focus to previous input (go back)
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    
    // Otherwise move left and clear previous value
    if (index > 0) {
      const prevIndex = index - 1;
      inputRefs.current[prevIndex]?.focus();
      if (value[prevIndex]) {
        const newOtp = [...value];
        newOtp[prevIndex] = '';
        onChange(newOtp);
      }
    }
  }, [value, onChange]);

  const handlePasteOTP = async () => {
    if (disabled) return;
    
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        const otpCode = extractBestOTP(clipboardContent, length);
        if (otpCode && isValidOTP(otpCode, length)) {
          console.log('Pasting OTP from clipboard:', otpCode);
          
          // Fill the OTP inputs
          const newOtp = new Array(length).fill('');
          for (let i = 0; i < Math.min(otpCode.length, length); i++) {
            newOtp[i] = otpCode[i];
          }
          
          onChange(newOtp);
          
          // Focus the next empty input or the last one
          const nextEmptyIndex = newOtp.findIndex(digit => !digit);
          const focusIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : length - 1;
          inputRefs.current[focusIndex]?.focus();
          
          // Clear clipboard after paste
          await Clipboard.setStringAsync('');
          
          // Trigger success animation
          triggerSuccessAnimation();
          
          // Call onComplete if all digits are filled
          if (newOtp.every(digit => digit !== '')) {
            onComplete?.(newOtp.join(''));
          }
          
          // Show success feedback without blocking UI
          setTimeout(() => {
            Alert.alert('✅ Success', 'OTP pasted successfully!');
          }, 100);
        } else {
          triggerShakeAnimation();
          Alert.alert('❌ No Valid OTP', `No valid ${length}-digit OTP code found in clipboard.\n\nPlease copy the OTP from your SMS and try again.`);
        }
      } else {
        triggerShakeAnimation();
        Alert.alert('📋 Clipboard Empty', 'Clipboard is empty.\n\nPlease copy the OTP from your SMS and try again.');
      }
    } catch (error) {
      console.error('Error pasting OTP:', error);
      triggerShakeAnimation();
      Alert.alert('❌ Error', 'Failed to paste OTP. Please try again.');
    }
  };

  const handleInputFocus = useCallback((index: number) => {
    // Enforce sequential entry: always focus the first empty index
    const firstEmptyIndex = value.findIndex(digit => !digit);
    const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : length - 1;
    if (index !== targetIndex) {
      inputRefs.current[targetIndex]?.focus();
      return;
    }
    // Highlight the focused input
    inputRefs.current[targetIndex]?.setNativeProps({
      style: { borderColor: Colors.primary, borderWidth: 2 }
    });
  }, [value, length]);

  const handleInputBlur = useCallback((index: number) => {
    // Reset border style
    inputRefs.current[index]?.setNativeProps({
      style: { borderColor: Colors.border, borderWidth: 1 }
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.otpContainer,
          {
            transform: [
              { translateX: shakeAnimation },
              { scale: successAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.05]
              })}
            ]
          }
        ]}
      >
        {Array.from({ length }, (_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.inputWrapper,
              {
                transform: [
                  { scale: successAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1]
                  })}
                ]
              }
            ]}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                value[index] && styles.otpInputFilled,
                error && styles.otpInputError,
                disabled && styles.otpInputDisabled,
              ]}
              value={value[index]}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
            onFocus={() => handleInputFocus(index)}
              onBlur={() => handleInputBlur(index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              editable={!disabled}
              placeholder="•"
              placeholderTextColor={Colors.gray300}
            />
            {value[index] && (
              <Animated.View
                style={[
                  styles.checkmark,
                  {
                    opacity: successAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1]
                    })
                  }
                ]}
              >
                <Ionicons name="checkmark" size={16} color={Colors.success} />
              </Animated.View>
            )}
          </Animated.View>
        ))}
      </Animated.View>
      
      {showPasteButton && !manualOnly && (
        <TouchableOpacity 
          style={[styles.pasteButton, disabled && styles.pasteButtonDisabled]} 
          onPress={handlePasteOTP}
          disabled={disabled}
        >
          <Ionicons 
            name="clipboard-outline" 
            size={20} 
            color={disabled ? Colors.gray400 : Colors.primary} 
          />
        </TouchableOpacity>
      )}
      
      {/* Help tip removed as requested */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.lg,
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.gray50,
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    elevation: 4,
  },
  otpInputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight || '#FEF2F2',
  },
  otpInputDisabled: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
    opacity: 0.6,
  },
  checkmark: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pasteButtonDisabled: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
    opacity: 0.6,
  },
  pasteButtonText: {
    fontSize: Layout.fontSize.md,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Layout.spacing.xs,
  },
  pasteButtonTextDisabled: {
    color: Colors.gray400,
  },
  helpText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Layout.spacing.md,
  },
});
