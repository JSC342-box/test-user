import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSignIn, useSignUp, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import Button from '../../components/common/Button';
import { useAssignUserType } from '../../utils/helpers';

export default function OTPVerificationScreen({ navigation, route }: any) {
  const { phoneNumber, isSignIn } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  
  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { user } = useUser();
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Assign customer type to user
  useAssignUserType('customer');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    console.log('OTPVerificationScreen - Verifying OTP:', otpString);
    console.log('OTPVerificationScreen - Is Sign In:', isSignIn);
    console.log('OTPVerificationScreen - Phone Number:', phoneNumber);
    
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter complete OTP');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignIn) {
        // Sign in flow
        console.log('OTPVerificationScreen - Attempting sign in with OTP...');
        console.log('OTPVerificationScreen - SignIn object:', signIn);
        
        if (!signIn) {
          console.error('OTPVerificationScreen - SignIn object is null');
          Alert.alert('Error', 'Authentication service not available. Please try again.');
          return;
        }
        
        const completeSignIn = await signIn.attemptFirstFactor({
          strategy: 'phone_code',
          code: otpString,
        });

        console.log('OTPVerificationScreen - Sign in result:', completeSignIn);

        if (completeSignIn?.status === 'complete') {
          console.log('OTPVerificationScreen - Sign in successful, setting active session...');
          console.log('OTPVerificationScreen - Created session ID:', completeSignIn.createdSessionId);
          
          // Set user type as customer
          if (user) {
            await user.update({
              unsafeMetadata: { ...user.unsafeMetadata, type: 'customer' }
            });
            console.log('OTPVerificationScreen - User type set to customer');
          }
          
          if (setSignInActive) {
            await setSignInActive({ session: completeSignIn.createdSessionId });
            console.log('OTPVerificationScreen - Session activated successfully');
          } else {
            console.error('OTPVerificationScreen - setSignInActive is not available');
          }
          // Don't navigate manually - the auth state change will handle it
        } else {
          console.log('OTPVerificationScreen - Sign in failed, status:', completeSignIn?.status);
          console.log('OTPVerificationScreen - Complete signin object:', completeSignIn);
        }
      } else {
        // Sign up flow
        console.log('OTPVerificationScreen - Attempting sign up with OTP...');
        console.log('OTPVerificationScreen - SignUp object:', signUp);
        
        if (!signUp) {
          console.error('OTPVerificationScreen - SignUp object is null');
          Alert.alert('Error', 'Authentication service not available. Please try again.');
          return;
        }
        
        const completeSignUp = await signUp.attemptPhoneNumberVerification({
          code: otpString,
        });

        console.log('OTPVerificationScreen - Sign up result:', completeSignUp);
        console.log('OTPVerificationScreen - Phone verification status:', completeSignUp?.verifications?.phoneNumber?.status);

        // Check if phone number is verified
        const isPhoneVerified = completeSignUp?.verifications?.phoneNumber?.status === 'verified';
        console.log('OTPVerificationScreen - Is phone verified:', isPhoneVerified);

        if (isPhoneVerified) {
          console.log('OTPVerificationScreen - Phone verification successful!');
          console.log('OTPVerificationScreen - Missing fields:', completeSignUp?.missingFields);
          
          // Set user type as customer
          if (user) {
            await user.update({
              unsafeMetadata: { ...user.unsafeMetadata, type: 'customer' }
            });
            console.log('OTPVerificationScreen - User type set to customer');
          }
          
          if (setSignUpActive && completeSignUp.createdSessionId) {
            await setSignUpActive({ session: completeSignUp.createdSessionId });
            console.log('OTPVerificationScreen - Session activated successfully');
          } else {
            console.error('OTPVerificationScreen - setSignUpActive is not available or no session ID');
          }
          // Navigate to profile setup for new users
          navigation.navigate('ProfileSetup');
        } else {
          console.log('OTPVerificationScreen - Phone verification failed');
          console.log('OTPVerificationScreen - Complete signup object:', completeSignUp);
        }
      }
    } catch (err: any) {
      console.error('OTPVerificationScreen - OTP Verification Error:', err);
      console.error('OTPVerificationScreen - Error details:', err.errors);
      console.error('OTPVerificationScreen - Error message:', err.message);
      console.error('OTPVerificationScreen - Error code:', err.code);
      
      let errorMessage = 'Invalid OTP. Please try again.';
      if (err?.errors?.[0]?.message) {
        errorMessage = err.errors[0].message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      if (isSignIn) {
        // For sign in, we need to get the phone number factor again
        if (signIn) {
          const { supportedFirstFactors } = await signIn.create({
            identifier: phoneNumber,
          });

          const phoneNumberFactor = supportedFirstFactors?.find((factor: any) => {
            return factor.strategy === 'phone_code';
          }) as any;

          if (phoneNumberFactor) {
            await signIn.prepareFirstFactor({
              strategy: 'phone_code',
              phoneNumberId: phoneNumberFactor.phoneNumberId,
            });
          }
        }
      } else {
        if (signUp) {
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        }
      }
      
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      Alert.alert('Success', 'OTP sent successfully');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                Resend OTP in {timer}s
              </Text>
            )}
          </View>

          <Button
            title="Verify & Continue"
            onPress={handleVerifyOTP}
            loading={isLoading}
            fullWidth
            disabled={otp.join('').length !== 6}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
  },
  backButton: {
    padding: Layout.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  title: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.md,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneNumber: {
    fontWeight: '600',
    color: Colors.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.lg,
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.gray50,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  resendText: {
    fontSize: Layout.fontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  timerText: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
});