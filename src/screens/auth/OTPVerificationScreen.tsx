import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSignIn, useSignUp, useUser, useAuth } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import Button from '../../components/common/Button';
import OTPInput, { OTPInputRef } from '../../components/common/OTPInput';
import { logJWTDetails } from '../../utils/jwtDecoder';
import { useAssignUserType } from '../../utils/helpers';

export default function OTPVerificationScreen({ navigation, route }: any) {
  const { phoneNumber, isSignIn } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const otpRef = useRef<OTPInputRef | null>(null);
  
  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { user } = useUser();
  const { getToken } = useAuth();

  // Assign customer type to user
  useAssignUserType('customer');

  // Handle Android hardware back: return to Login screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isLoading) return true; // prevent navigating while verifying
      navigation.replace('Login');
      return true;
    });

    return () => backHandler.remove();
  }, [navigation, isLoading]);

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

  const handleOtpChange = (value: string[]) => {
    setOtp(value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleOtpComplete = (otpString: string) => {
    console.log('OTP completed:', otpString);
    // Optionally auto-verify when OTP is complete
    // handleVerifyOTP();
  };

  const handleClearOTP = () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setAttempts(0);
    // Move focus back to the first input
    setTimeout(() => {
      otpRef.current?.focusIndex(0);
    }, 50);
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    console.log('OTPVerificationScreen - Verifying OTP:', otpString);
    console.log('OTPVerificationScreen - Is Sign In:', isSignIn);
    console.log('OTPVerificationScreen - Phone Number:', phoneNumber);
    
    if (otpString.length !== 6) {
      setError('Please enter complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

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
          if (completeSignIn.createdSessionId) {
            await setSignInActive({ session: completeSignIn.createdSessionId });
            console.log('OTPVerificationScreen - Active session set successfully');
            
            // Get JWT token and log details
            if (typeof getToken === 'function') {
              try {
                const token = await getToken({ template: 'my_app_token' });
                if (token) {
                  console.log('OTPVerificationScreen - JWT token obtained successfully');
                  logJWTDetails(token);
                }
              } catch (tokenError) {
                console.error('OTPVerificationScreen - Error getting JWT token:', tokenError);
              }
            }
            
            // Navigate to home screen
            navigation.replace('Home');
          } else {
            console.error('OTPVerificationScreen - No session ID in complete sign in');
            Alert.alert('Error', 'Sign in completed but no session created. Please try again.');
          }
        } else {
          console.error('OTPVerificationScreen - Sign in not complete:', completeSignIn?.status);
          setAttempts(prev => prev + 1);
          setError(`Invalid OTP. Please check the code and try again. (Attempt ${attempts + 1}/3)`);
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
        console.log('OTPVerificationScreen - Sign up status:', completeSignUp?.status);
        console.log('OTPVerificationScreen - Phone verification status:', completeSignUp?.verifications?.phoneNumber?.status);
        console.log('OTPVerificationScreen - Created session ID:', completeSignUp?.createdSessionId);
        
        // Check if phone number is verified
        const isPhoneVerified = completeSignUp?.verifications?.phoneNumber?.status === 'verified';
        console.log('OTPVerificationScreen - Is phone verified:', isPhoneVerified);
        
        if (isPhoneVerified) {
          console.log('OTPVerificationScreen - Phone verification successful!');
          console.log('OTPVerificationScreen - Missing fields:', completeSignUp?.missingFields);
          
          // Set userType in Clerk metadata immediately after phone verification
          if (user) {
            try {
              await user.update({
                unsafeMetadata: { ...user.unsafeMetadata, type: 'customer' }
              });
              console.log('OTPVerificationScreen - User type set to customer after phone verification');
              
              // Force new JWT with updated userType
              if (typeof getToken === 'function') {
                const newToken = await getToken({ template: 'my_app_token', skipCache: true });
                console.log('OTPVerificationScreen - New JWT with userType after phone verification:', newToken ? 'Generated' : 'Failed');
              }
            } catch (metadataErr) {
              console.error('OTPVerificationScreen - Error setting user type after phone verification:', metadataErr);
            }
          }
          
          // Check if we have all required fields (phone is verified, but we still need first_name and last_name)
          if (completeSignUp?.missingFields?.length === 0) {
            console.log('OTPVerificationScreen - All required fields completed, setting active session...');
            
            if (completeSignUp.createdSessionId) {
              await setSignUpActive({ session: completeSignUp.createdSessionId });
              console.log('OTPVerificationScreen - Active session set successfully');
              
              // Get JWT token and log details
              if (typeof getToken === 'function') {
                try {
                  const token = await getToken({ template: 'my_app_token' });
                  if (token) {
                    console.log('OTPVerificationScreen - JWT token obtained successfully');
                    logJWTDetails(token);
                  }
                } catch (tokenError) {
                  console.error('OTPVerificationScreen - Error getting JWT token:', tokenError);
                }
              }
              
              // Navigate to home screen
              navigation.replace('Home');
            } else {
              console.error('OTPVerificationScreen - No session ID in complete sign up');
              Alert.alert('Error', 'Sign up completed but no session created. Please try again.');
            }
          } else {
            console.log('OTPVerificationScreen - Missing required fields, navigating to complete profile...');
            // Navigate to complete profile screen
            navigation.replace('CompleteProfile', {
              phoneNumber,
              isSignUp: true,
            });
          }
        } else {
          console.error('OTPVerificationScreen - Phone verification failed:', completeSignUp?.verifications?.phoneNumber?.status);
          setAttempts(prev => prev + 1);
          setError(`Invalid OTP. Please check the code and try again. (Attempt ${attempts + 1}/3)`);
        }
      }
    } catch (err: any) {
      console.error('OTPVerificationScreen - Error during verification:', err);
      setAttempts(prev => prev + 1);
      setError(`Verification failed. ${err.errors?.[0]?.message || 'Please check your OTP and try again.'} (Attempt ${attempts + 1}/3)`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      if (isSignIn) {
        // For sign in, we need to prepare the phone number verification again
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
        // For sign up, prepare phone number verification
        if (signUp) {
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        }
      }
      
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError('');
      setAttempts(0);
      
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
          {/* Back button removed to prevent going back to previous screens */}
        </View>

        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </Text>
            <Text style={styles.instructionText}>
              Enter the code manually or use the number pad
            </Text>
          </View>

          <OTPInput
            ref={otpRef}
            length={6}
            value={otp}
            onChange={handleOtpChange}
            onComplete={handleOtpComplete}
            autoFocus={true}
            showPasteButton={false}
            manualOnly={false}
            error={!!error}
            disabled={isLoading}
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={handleClearOTP}
              disabled={isLoading}
            >
              <Ionicons name="refresh" size={18} color={Colors.textSecondary} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              {canResend ? (
                <TouchableOpacity onPress={handleResendOTP} disabled={isLoading}>
                  <Text style={styles.resendText}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.timerText}>
                  Resend OTP in {timer}s
                </Text>
              )}
            </View>
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
  instructionText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Layout.spacing.sm,
    fontStyle: 'italic',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorLight || '#FEF2F2',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.error,
    marginLeft: Layout.spacing.xs,
    textAlign: 'center',
    flex: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    backgroundColor: Colors.gray50,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearButtonText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Layout.spacing.xs,
    fontWeight: '500',
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