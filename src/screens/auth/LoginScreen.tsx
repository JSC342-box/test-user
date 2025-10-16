rimport React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import Button from '../../components/common/Button';
import PhoneInput from '../../components/common/PhoneInput';
import Logo from '../../components/common/Logo';

const INDIA_COUNTRY = { code: '+91', name: 'India', flag: '🇮🇳' };

export default function LoginScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const { signIn, isLoaded } = useSignIn();

  // Prevent back navigation on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  const handleSendOTP = async () => {
    if (!isLoaded) return;

    // Clear previous errors
    setPhoneError('');

    // Validate phone number
    if (phoneNumber.length !== 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }

    if (!/^\d+$/.test(phoneNumber)) {
      setPhoneError('Phone number should contain only digits');
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number for Clerk (add country code)
      const formattedPhone = `${INDIA_COUNTRY.code}${phoneNumber}`;
      
      // Start the sign-in process using the phone number method
      const { supportedFirstFactors } = await signIn.create({
        identifier: formattedPhone,
      });
      
      // Find the phone number factor
      const phoneNumberFactor = supportedFirstFactors?.find((factor: any) => {
        return factor.strategy === 'phone_code';
      }) as any;
      
      if (phoneNumberFactor) {
        // Prepare the phone number verification
        await signIn.prepareFirstFactor({
          strategy: 'phone_code',
          phoneNumberId: phoneNumberFactor.phoneNumberId,
        });
        
        navigation.replace('OTPVerification', {
          phoneNumber: formattedPhone,
          isSignIn: true,
        });
      }
    } catch (err: any) {
      console.error('Error:', err);
      setPhoneError(err.errors?.[0]?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigation.replace('SignUp');
  };


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Logo size={350} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Enter your mobile number to sign in
            </Text>
          </View>

          <View style={styles.form}>
            <PhoneInput
              label="Mobile Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              country={INDIA_COUNTRY}
              error={phoneError}
              showCountrySelector={false}
            />

            <Button
              title="Send OTP"
              onPress={handleSendOTP}
              loading={isLoading}
              fullWidth
              disabled={phoneNumber.length !== 10}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.linkText}>Terms of Service</Text> and{' '}
              <Text style={styles.linkText}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  title: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    flex: 1,
    paddingTop: Layout.spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Layout.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Layout.spacing.md,
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
  },
  signUpButton: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
  },
  signUpText: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  signUpLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: Layout.spacing.lg,
  },
  termsText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
