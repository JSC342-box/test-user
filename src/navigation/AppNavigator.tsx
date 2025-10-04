import React, { useEffect } from 'react';
import { DeviceEventEmitter, Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../store/NotificationContext';

// Auth Screens
import AppSplashScreen from '../screens/auth/AppSplashScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Home Screens
import HomeScreen from '../screens/home/HomeScreen';
import LocationSearchScreen from '../screens/home/LocationSearchScreen';
import RideEstimateScreen from '../screens/home/RideEstimateScreen';
import ConfirmRideScreen from '../screens/home/ConfirmRideScreen';
import ScheduleRideScreen from '../screens/home/ScheduleRideScreen';
import ComingSoonScreen from '../screens/home/ComingSoonScreen';
import OffersScreen from '../screens/home/OffersScreen';
import DropLocationSelectorScreen from '../screens/home/DropLocationSelectorScreen';
import DropPinLocationScreen from '../screens/home/DropPinLocationScreen';
import RideOptionsScreen from '../screens/home/RideOptionsScreen';

// Support Screens
import HelpSupportScreen from '../screens/support/HelpSupportScreen';
import RideIssuesScreen from '../screens/support/RideIssuesScreen';
import AccidentReportScreen from '../screens/support/AccidentReportScreen';
import AccidentDetailsScreen from '../screens/support/AccidentDetailsScreen';
import PersonalInfoUpdateScreen from '../screens/support/PersonalInfoUpdateScreen';
import CancellationFeeScreen from '../screens/support/CancellationFeeScreen';
import DriverUnprofessionalScreen from '../screens/support/DriverUnprofessionalScreen';
import VehicleUnexpectedScreen from '../screens/support/VehicleUnexpectedScreen';
import LostItemScreen from '../screens/support/LostItemScreen';
import AccountIssuesScreen from '../screens/support/AccountIssuesScreen';
import PaymentsIssuesScreen from '../screens/support/PaymentsIssuesScreen';
import OtherIssuesScreen from '../screens/support/OtherIssuesScreen';
import TermsConditionScreen from '../screens/support/TermsConditionScreen';
import CaptainVehicleIssuesScreen from '../screens/support/CaptainVehicleIssuesScreen';
import ParcelIssuesScreen from '../screens/support/ParcelIssuesScreen';

// Ride Screens
import FindingDriverScreen from '../screens/ride/FindingDriverScreen';
import LiveTrackingScreen from '../screens/ride/LiveTrackingScreen';
import RideInProgressScreen from '../screens/ride/RideInProgressScreen';
import ChatScreen from '../screens/ride/ChatScreen';
import RideSummaryScreen from '../screens/ride/RideSummaryScreen';
import RideDetailsScreen from '../screens/ride/RideDetailsScreen';

// Profile Screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import RideHistoryScreen from '../screens/profile/RideHistoryScreen';
import HistoryDetailScreen from '../screens/profile/HistoryDetailScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PersonalDetailsScreen from '../screens/profile/PersonalDetailsScreen';
import AboutScreen from '../screens/profile/AboutScreen';
import PaymentScreen from '../screens/profile/PaymentScreen';
import RidePaymentScreen from '../screens/ride/PaymentScreen';
import WebViewPaymentScreen from '../screens/ride/WebViewPaymentScreen';
import PostRidePaymentScreen from '../screens/ride/PostRidePaymentScreen';
import PrivacySecurityScreen from '../screens/profile/PrivacySecurityScreen';
import LanguageSettingsScreen from '../screens/profile/LanguageSettingsScreen';

import { Colors } from '../constants/Colors';
import { Layout } from '../constants/Layout';
import { useTranslation } from 'react-i18next';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Wallet') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          paddingBottom: Math.max(insets.bottom, Layout.spacing.sm),
          paddingTop: Layout.spacing.sm,
          height: Layout.buttonHeight + Math.max(insets.bottom, Layout.spacing.sm),
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: Layout.fontSize.xs,
          fontWeight: '600',
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('common.home') }} />
      <Tab.Screen name="History" component={RideHistoryScreen} options={{ title: t('common.history') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('common.profile') }} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen 
        name="Splash" 
        component={AppSplashScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="Onboarding" 
        component={SplashScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="SignUp" 
        component={SignUpScreen}
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="OTPVerification" 
        component={OTPVerificationScreen}
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ProfileSetup" 
        component={ProfileSetupScreen}
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function MainNavigator() {
  const { initializeNotifications } = useNotifications();

  useEffect(() => {
    const initializeNotificationsAsync = async () => {
      try {
        console.log('🔔 App: Initializing notifications in MainNavigator...');
        await initializeNotifications();
        console.log('✅ App: Notifications initialized successfully');
      } catch (error) {
        console.error('❌ App: Failed to initialize notifications:', error);
      }
    };

    // Initialize notifications when MainNavigator mounts
    initializeNotificationsAsync();

    // Listen to global ride cancelled event (fallback when no screen listener is active)
    const sub = DeviceEventEmitter.addListener('ride_cancelled_global', (data: any) => {
      try {
        Alert.alert('Ride Cancelled', data?.message || 'Your ride has been cancelled.');
      } catch {}
      // Navigate to Home tab
      // We don't have a global navigationRef here, so push to TabNavigator default
      // by leveraging the stack structure: replace initial route to TabNavigator
      // Consumers in screens already navigate Home; this is a safe fallback.
    });

    return () => {
      sub.remove();
    };
  }, [initializeNotifications]);

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName="TabNavigator"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      {/* Main App with Tabs */}
      <Stack.Screen name="TabNavigator" component={TabNavigator} />
      
      {/* Home Flow */}
      <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
      <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
      <Stack.Screen name="RideEstimate" component={RideEstimateScreen} />
      <Stack.Screen name="ConfirmRide" component={ConfirmRideScreen} />
      <Stack.Screen name="ScheduleRide" component={ScheduleRideScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      <Stack.Screen name="Offers" component={OffersScreen} />
      <Stack.Screen name="DropLocationSelector" component={DropLocationSelectorScreen} />
      <Stack.Screen name="DropPinLocation" component={DropPinLocationScreen} />
      
      {/* Support Flow */}
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="RideIssues" component={RideIssuesScreen} />
      <Stack.Screen name="AccidentReport" component={AccidentReportScreen} />
      <Stack.Screen name="AccidentDetails" component={AccidentDetailsScreen} />
      <Stack.Screen name="PersonalInfoUpdate" component={PersonalInfoUpdateScreen} />
      <Stack.Screen name="CancellationFee" component={CancellationFeeScreen} />
      <Stack.Screen name="DriverUnprofessional" component={DriverUnprofessionalScreen} />
      <Stack.Screen name="VehicleUnexpected" component={VehicleUnexpectedScreen} />
      <Stack.Screen name="LostItem" component={LostItemScreen} />
      <Stack.Screen name="AccountIssues" component={AccountIssuesScreen} />
      <Stack.Screen name="PaymentsIssues" component={PaymentsIssuesScreen} />
      <Stack.Screen name="OtherIssues" component={OtherIssuesScreen} />
      <Stack.Screen name="TermsCondition" component={TermsConditionScreen} />
      <Stack.Screen name="CaptainVehicleIssues" component={CaptainVehicleIssuesScreen} />
      <Stack.Screen name="ParcelIssues" component={ParcelIssuesScreen} />
      
      {/* Ride Flow */}
      <Stack.Screen 
        name="FindingDriver" 
        component={FindingDriverScreen} 
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="LiveTracking" 
        component={LiveTrackingScreen} 
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="RideInProgress" 
        component={RideInProgressScreen} 
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <Stack.Screen name="RidePayment" component={RidePaymentScreen as any} />
      <Stack.Screen name="WebViewPayment" component={WebViewPaymentScreen as any} />
      <Stack.Screen name="PostRidePayment" component={PostRidePaymentScreen as any} />

      <Stack.Screen name="RideSummary" component={RideSummaryScreen} />
      <Stack.Screen name="RideDetails" component={RideDetailsScreen as any} />
      <Stack.Screen name="RateDriver" component={require('../screens/ride/RateDriverScreen').default} />
      
      {/* Profile Flow */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="HistoryDetail" component={HistoryDetailScreen} />
      
      {/* Debug Flow */}
        <Stack.Screen name="ConnectionTest" component={require('../screens/debug/ConnectionTestScreen').default} />
  <Stack.Screen name="LivePaymentTest" component={require('../screens/debug/LivePaymentTestScreen').default} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading screen while checking auth state
  if (!isLoaded) {
    return null; // or a loading screen component
  }

  return isSignedIn ? <MainNavigator /> : <AuthNavigator />;
}
