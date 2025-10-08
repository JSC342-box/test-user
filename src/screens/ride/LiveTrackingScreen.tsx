import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Modal,
  Share,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { onRideStatus, onDriverLocation, onRideCompleted, clearCallbacks, getSocket, cancelRide } from '../../utils/socket';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Images } from '../../constants/Images';
import ConnectionStatus from '../../components/common/ConnectionStatus';
import PinDisplay from '../../components/common/PinDisplay';
import { useAuth } from '@clerk/clerk-expo';
import { rideService } from '../../services/rideService';
import { useNotifications } from '../../store/NotificationContext';
import BackendNotificationService from '../../services/backendNotificationService';
import RoutingService from '../../services/routingService';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withRepeat,
  interpolate,
  runOnJS,
  Easing
} from 'react-native-reanimated';
import { logger } from '../../utils/logger';

export default function LiveTrackingScreen({ navigation, route }: any) {
  const { destination, estimate, driver, rideId, origin, driverArrived } = route.params;
  const { getToken } = useAuth();
  const { getStoredToken } = useNotifications();
  
  logger.debug('LiveTrackingScreen: Component initialized with params', {
    destination,
    estimate,
    driver,
    rideId,
    origin
  });
  
  const [rideStatus, setRideStatus] = useState('arriving');
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [driverPath, setDriverPath] = useState<{latitude: number, longitude: number}[]>([]);
  const [routePath, setRoutePath] = useState<{latitude: number, longitude: number}[]>([]);

  const [pathUpdateCount, setPathUpdateCount] = useState(0);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [otpCode, setOtpCode] = useState('0824'); // Default fallback
  const [pilotName, setPilotName] = useState('Anderson'); // Default fallback
  const [driverRating, setDriverRating] = useState<number | null>(null); // Driver rating from backend
  const [isNewDriver, setIsNewDriver] = useState(false); // Track if driver is new
  const [driverPhoneNumber, setDriverPhoneNumber] = useState<string | null>(null); // Real phone number from backend
  const [realDriverName, setRealDriverName] = useState<string | null>(null); // Real driver name from backend
  const [isLoadingRideData, setIsLoadingRideData] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false); // State for cancel button loading
  const [driverInfoState, setDriverInfoState] = useState<{
    id: string;
    name: string;
    phone: string;
    eta?: string;
    vehicleType?: string;
    vehicleModel?: string;
    photo?: string;
    vehicleNumber?: string;
    vehicleColor?: string;
  }>({
    id: driver?.id || '',
    name: driver?.name || pilotName,
    phone: driver?.phone || '',
    eta: driver?.eta,
    vehicleType: driver?.vehicleType,
    vehicleModel: driver?.vehicleModel
  });

  // Use state to store current driver ID so useEffect can depend on it
  const [currentDriverId, setCurrentDriverId] = useState(driverInfoState.id);

  // Update current driver ID when driverInfoState changes
  useEffect(() => {
    setCurrentDriverId(driverInfoState.id);
    logger.debug('Updated driver ID', { id: driverInfoState.id });
  }, [driverInfoState.id]);

  // Flag to prevent multiple API calls
  const hasFetchedRideDetails = useRef(false);

  // Cancel ride function
  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? A cancellation fee may apply.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              logger.debug('🚫 User initiated ride cancellation:', { rideId });
              
              // Emit cancel ride event
              const success = cancelRide(rideId, 'User cancelled ride');
              
              if (success) {
                logger.debug('✅ Cancel ride event emitted successfully');
                // The socket will handle the response and navigation
              } else {
                logger.error('❌ Failed to emit cancel ride event');
                Alert.alert('Error', 'Failed to cancel ride. Please try again.');
                setIsCancelling(false);
              }
            } catch (error) {
              logger.error('❌ Error cancelling ride:', error);
              Alert.alert('Error', 'An error occurred while cancelling the ride. Please try again.');
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  // State to track if we're receiving real-time updates
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);

  // Prevent back navigation during ride tracking
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Always prevent back navigation during ride tracking
      Alert.alert(
        'Ride in Progress',
        'You cannot go back while your ride is in progress. Please wait for the ride to complete.',
        [
          { text: 'OK', style: 'default' }
        ]
      );
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Animation values for driver marker
  const driverRotation = useSharedValue(0);
  const driverScale = useSharedValue(1);
  const driverOpacity = useSharedValue(1);
  const pulseAnimation = useSharedValue(0);
  
  // Smooth animation values for driver location
  const animatedLatitude = useSharedValue(0);
  const animatedLongitude = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  
  // State for animated driver location (for marker coordinate)
  const [animatedDriverLocation, setAnimatedDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  
  const mapRef = useRef<MapView>(null);

  // Pulsing animation effect
  useEffect(() => {
    pulseAnimation.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1, // Infinite repeat
      true // Reverse animation
    );
  }, []);

  // Set initial driver location only if no real location is available
  useEffect(() => {
    // Only set initial location if we don't have any driver location and we're in development
    // AND we haven't received any real driver location updates yet
    if (!driverLocation && __DEV__ && !lastLocationUpdate) {
      logger.debug('🧪 Setting initial driver location for development testing');
      let initialDriverLocation;
      
      if (origin && origin.latitude && origin.longitude) {
        // Use origin as reference if available
        initialDriverLocation = {
          latitude: origin.latitude + 0.001, // Slightly north of pickup
          longitude: origin.longitude + 0.001  // Slightly east of pickup
        };
      } else if (destination && destination.latitude && destination.longitude) {
        // Use destination as reference if origin not available
        initialDriverLocation = {
          latitude: destination.latitude - 0.001, // Slightly south of destination
          longitude: destination.longitude - 0.001  // Slightly west of destination
        };
      } else {
        // Don't set hardcoded coordinates - wait for real driver location
        logger.debug('🧪 Waiting for real driver location instead of using hardcoded coordinates');
        return;
      }
      
      setDriverLocation(initialDriverLocation);
      logger.debug('🧪 Initial driver location set for testing:', initialDriverLocation);
    }
  }, [origin, destination, driverLocation, lastLocationUpdate]);


  // Summary log for driver location updates
  useEffect(() => {
    if (locationUpdateCount > 0) {
      logger.debug('📊 Driver Location Summary:', {
        totalUpdates: locationUpdateCount,
        pathLength: driverPath.length,
        lastUpdate: lastLocationUpdate?.toLocaleTimeString()
      });
    }
  }, [locationUpdateCount, driverPath.length, lastLocationUpdate]);

  // Smooth animation function for driver marker
  const animateDriverToLocation = (newLocation: {latitude: number, longitude: number}) => {
    if (!driverLocation) {
      // First location - set immediately without animation
      animatedLatitude.value = newLocation.latitude;
      animatedLongitude.value = newLocation.longitude;
      setAnimatedDriverLocation(newLocation);
      return;
    }

    // Calculate bearing for rotation
    const bearing = calculateBearing(driverLocation, newLocation);
    driverRotation.value = bearing;

    // Start smooth animation
    isAnimating.value = true;
    
    logger.debug('🎬 Starting smooth animation from:', driverLocation, 'to:', newLocation);
    
    // Create worklets for logging that run on JS thread
    const logLatitudeComplete = () => {
      logger.debug('✅ Latitude animation completed');
    };
    
    const logLongitudeComplete = () => {
      logger.debug('✅ Longitude animation completed');
    };

    // Animate latitude and longitude over 5 seconds
    animatedLatitude.value = withTiming(
      newLocation.latitude,
      { duration: 5000, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(logLatitudeComplete)();
        }
      }
    );
    
    animatedLongitude.value = withTiming(
      newLocation.longitude,
      { duration: 5000, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(logLongitudeComplete)();
          isAnimating.value = false;
        }
      }
    );
    
    // Update animated location state during animation
    const updateAnimatedLocation = () => {
      setAnimatedDriverLocation({
        latitude: animatedLatitude.value,
        longitude: animatedLongitude.value
      });
    };
    
    // Update every 100ms during animation
    const animationInterval = setInterval(() => {
      if (isAnimating.value) {
        updateAnimatedLocation();
      } else {
        clearInterval(animationInterval);
      }
    }, 100);
  };

  // Update location tracking when driver location changes
  useEffect(() => {
    if (driverLocation) {
      setLastLocationUpdate(new Date());
      
      // Start smooth animation to new location
      animateDriverToLocation(driverLocation);
    }
  }, [driverLocation]);

  // Calculate bearing between two points for car rotation
  const calculateBearing = (start: {latitude: number, longitude: number}, end: {latitude: number, longitude: number}) => {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;
    
    const startLat = toRad(start.latitude);
    const startLng = toRad(start.longitude);
    const endLat = toRad(end.latitude);
    const endLng = toRad(end.longitude);
    
    const dLng = endLng - startLng;
    
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    
    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  };



  // Calculate distance between two points in meters
  const calculateDistance = (point1: {latitude: number, longitude: number}, point2: {latitude: number, longitude: number}) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Animated style for driver marker
  const animatedDriverStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(pulseAnimation.value, [0, 1], [1, 1.2]);
    return {
      transform: [
        { rotate: `${driverRotation.value}deg` },
        { scale: driverScale.value * pulseScale }
      ],
      opacity: driverOpacity.value,
    };
  });

  // Coordinate validation function
  const validateAndProcessCoordinates = (lat: number, lng: number) => {
    // Ensure coordinates are numbers and within valid ranges
    if (typeof lat !== 'number' || typeof lng !== 'number' || 
        isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      logger.debug('🚫 Invalid coordinates received:', { lat, lng });
      return null;
    }
    
    // Ensure consistent precision (7 decimal places for ~1cm accuracy)
    const processedLat = parseFloat(lat.toFixed(7));
    const processedLng = parseFloat(lng.toFixed(7));
    
    logger.debug('✅ Coordinate validation passed:', {
      originalLat: lat,
      originalLng: lng,
      processedLat: processedLat,
      processedLng: processedLng,
      latPrecision: processedLat.toString().split('.')[1]?.length || 0,
      lngPrecision: processedLng.toString().split('.')[1]?.length || 0
    });
    
    return { latitude: processedLat, longitude: processedLng };
  };

  // Update driver location with animation and path tracking
  const updateDriverLocationWithAnimation = (newLocation: {latitude: number, longitude: number}) => {
    logger.debug('🔄 Updating driver location from:', driverLocation, 'to:', newLocation);
    
    // Validate the new location
    if (!newLocation || !newLocation.latitude || !newLocation.longitude ||
        isNaN(newLocation.latitude) || isNaN(newLocation.longitude)) {
      logger.debug('🚫 Invalid new location data, skipping update');
      return;
    }
    
    // Additional validation for coordinate ranges
    if (newLocation.latitude < -90 || newLocation.latitude > 90 || 
        newLocation.longitude < -180 || newLocation.longitude > 180) {
      logger.debug('🚫 Coordinates out of valid range, skipping update');
      return;
    }
    
    logger.debug('✅ Coordinates validation passed:', {
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      latInRange: newLocation.latitude >= -90 && newLocation.latitude <= 90,
      lngInRange: newLocation.longitude >= -180 && newLocation.longitude <= 180
    });
    
    if (driverLocation) {
      // Calculate bearing for car rotation
      const bearing = calculateBearing(driverLocation, newLocation);
      
      // Animate rotation
      driverRotation.value = withTiming(bearing, { duration: 500 });
      
      // Add a small scale animation for movement feedback
      driverScale.value = withSpring(1.1, { damping: 10 }, () => {
        driverScale.value = withSpring(1, { damping: 10 });
      });
    }
    
    // Update driver location state immediately
    setDriverLocation(newLocation);
    
    // Update driver path for polyline
    setDriverPath(prev => {
      const lastPoint = prev[prev.length - 1];
      // Only add new point if it's different from the last one (to avoid duplicates)
      if (!prev.length || !lastPoint || 
          Math.abs(lastPoint.latitude - newLocation.latitude) > 0.00001 || 
          Math.abs(lastPoint.longitude - newLocation.longitude) > 0.00001) {
        const newPath = [...prev, newLocation];
        // Keep only last 50 points to prevent memory issues
        if (newPath.length > 50) {
          newPath.splice(0, newPath.length - 50);
        }
        setPathUpdateCount(prev => prev + 1);
        logger.debug('🛣️ Updated driver path, new length:', newPath.length);
        return newPath;
      }
      logger.debug('🛣️ Path not updated - duplicate location');
      return prev;
    });
    
    // Immediately update map region to follow driver
    if (mapRef.current) {
      logger.debug('📷 Animating map to follow driver location:', newLocation);
      const region = {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      logger.debug('📷 Map region to animate to:', region);
      
      mapRef.current.animateToRegion(region, 1000); // 1 second animation
      
      // Also force a map update after animation
      setTimeout(() => {
        if (mapRef.current) {
          logger.debug('📷 Forcing map region update after animation');
          mapRef.current.animateToRegion(region, 0);
        }
      }, 1100);
    } else {
      logger.debug('⚠️ Map reference not available for region update');
    }
    
    logger.debug('✅ Driver location update completed successfully');
  };

  // Debug effect to log when driverRating changes
  useEffect(() => {
    logger.debug('⭐ LiveTrackingScreen: Driver rating state changed to:', driverRating);
    logger.debug('⭐ LiveTrackingScreen: Is new driver:', isNewDriver);
  }, [driverRating, isNewDriver]);



  // Log when custom motorcycle icon is being used
  useEffect(() => {
    logger.debug('🏍️ Using custom motorcycle icon (iconAnimation1.png) for driver marker');
    logger.debug('🏍️ Icon source:', Images.ICON_ANIMATION_1);
    logger.debug('🏍️ Icon description: Top-down view of person riding motorcycle with green glow effect');
  }, []);

  // Transform driver name to replace "Driver" with "Pilot" if it contains "Driver"
  const transformDriverName = (name: string) => {
    if (name && name.includes('Driver')) {
      return name.replace(/Driver/g, 'Pilot');
    }
    return name;
  };

  // Handle driver arrived notification
  const handleDriverArrived = async () => {
    try {
      logger.debug('🚗 Driver arrived at pickup location');
      
      // Get the user's push token
      const tokenData = await getStoredToken();
      if (tokenData?.token) {
        const backendService = BackendNotificationService.getInstance();
        await backendService.sendDriverArrivedNotification(tokenData.token, {
          rideId: rideId,
          driverId: driver?.id || 'unknown',
                        driverName: driverInfoState.name,
          pickupLocation: origin?.name || 'Your pickup location'
        });
        logger.debug('✅ Driver arrived notification sent');
      }
      
      // Update ride status
      setRideStatus('arrived');
    } catch (error) {
      console.error('❌ Error sending driver arrived notification:', error);
    }
  };
  
  const driverInfo = {
    ...driver,
    name: driver?.name ? transformDriverName(driver.name) : pilotName
  };



  // Fetch ride details from backend to get real OTP and pilot name
  useEffect(() => {
    const fetchRideDetails = async () => {
      if (!rideId) {
        logger.debug('⚠️ LiveTrackingScreen: Missing rideId, skipping API call');
        setIsLoadingRideData(false);
        return;
      }

      // Prevent multiple API calls
      if (hasFetchedRideDetails.current) {
        logger.debug('⚠️ LiveTrackingScreen: Already fetched ride details, skipping duplicate call');
        return;
      }

      try {
        hasFetchedRideDetails.current = true;
        logger.debug('🔍 LiveTrackingScreen: Fetching ride details from backend...');
        logger.debug('🎯 Ride ID:', rideId);
        
        const token = await getToken();
        const response = await rideService.getRideDetailsForOTP(rideId, token || undefined);
        
        if (response.success && response.data) {
          logger.debug('✅ LiveTrackingScreen: Successfully fetched ride details:', response.data);
          logger.debug('🔍 LiveTrackingScreen: Full response data structure:', JSON.stringify(response.data, null, 2));
          
          // Update OTP from backend
          if (response.data.otp) {
            logger.debug('🔐 LiveTrackingScreen: Setting OTP from backend:', response.data.otp);
            setOtpCode(response.data.otp);
          }
          
          // Update pilot name from backend - check multiple possible fields
          let pilotNameFromBackend = null;
          
          if (response.data.driver?.firstName) {
            pilotNameFromBackend = response.data.driver.firstName;
            logger.debug('👨‍✈️ LiveTrackingScreen: Found pilot name in driver.firstName:', pilotNameFromBackend);
          } else if (response.data.driver?.name) {
            pilotNameFromBackend = response.data.driver.name;
            logger.debug('👨‍✈️ LiveTrackingScreen: Found pilot name in driver.name:', pilotNameFromBackend);
          } else if (response.data.pilot?.firstName) {
            pilotNameFromBackend = response.data.pilot.firstName;
            logger.debug('👨‍✈️ LiveTrackingScreen: Found pilot name in pilot.firstName:', pilotNameFromBackend);
          } else if (response.data.pilot?.name) {
            pilotNameFromBackend = response.data.pilot.name;
            logger.debug('👨‍✈️ LiveTrackingScreen: Found pilot name in pilot.name:', pilotNameFromBackend);
          }
          
          if (pilotNameFromBackend) {
            // Don't transform the name, use it as is from backend
            logger.debug('👨‍✈️ LiveTrackingScreen: Setting pilot name from backend:', pilotNameFromBackend);
            setPilotName(pilotNameFromBackend);
            setRealDriverName(pilotNameFromBackend); // Store in real driver name state
          } else {
            console.warn('⚠️ LiveTrackingScreen: No pilot name found in backend response');
          }
          
          // Update driver rating from backend - check multiple possible fields
          let ratingFromBackend = null;
          
          logger.debug('🔍 LiveTrackingScreen: Checking for driver rating in response data...');
          logger.debug('🔍 LiveTrackingScreen: driver object:', response.data.driver);
          logger.debug('🔍 LiveTrackingScreen: pilot object:', response.data.pilot);
          
          if (response.data.driver?.rating !== null && response.data.driver?.rating !== undefined) {
            ratingFromBackend = response.data.driver.rating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in driver.rating:', ratingFromBackend);
          } else if (response.data.pilot?.rating !== null && response.data.pilot?.rating !== undefined) {
            ratingFromBackend = response.data.pilot.rating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in pilot.rating:', ratingFromBackend);
          } else if (response.data.driver?.averageRating !== null && response.data.driver?.averageRating !== undefined) {
            ratingFromBackend = response.data.driver.averageRating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in driver.averageRating:', ratingFromBackend);
          } else if (response.data.pilot?.averageRating !== null && response.data.pilot?.averageRating !== undefined) {
            ratingFromBackend = response.data.pilot.averageRating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in pilot.averageRating:', ratingFromBackend);
          } else if (response.data.driver?.driverRating !== null && response.data.driver?.driverRating !== undefined) {
            ratingFromBackend = response.data.driver.driverRating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in driver.driverRating:', ratingFromBackend);
          } else if (response.data.pilot?.driverRating !== null && response.data.pilot?.driverRating !== undefined) {
            ratingFromBackend = response.data.pilot.driverRating;
            logger.debug('⭐ LiveTrackingScreen: Found driver rating in pilot.driverRating:', ratingFromBackend);
          }
          
          logger.debug('🔍 LiveTrackingScreen: Final ratingFromBackend value:', ratingFromBackend);
          
          // Fix: Check if rating exists (including 0) instead of just truthy values
          if (ratingFromBackend !== null && ratingFromBackend !== undefined) {
            logger.debug('⭐ LiveTrackingScreen: Setting driver rating from backend:', ratingFromBackend);
            const ratingValue = parseFloat(String(ratingFromBackend));
            logger.debug('⭐ LiveTrackingScreen: Parsed rating value:', ratingValue);
            // If rating is 0, it means no rating yet, so we can show a default or skip
            if (ratingValue > 0) {
              setDriverRating(ratingValue);
              setIsNewDriver(false);
              logger.debug('⭐ LiveTrackingScreen: Set as rated driver with rating:', ratingValue);
            } else {
              logger.debug('⭐ LiveTrackingScreen: Driver has no rating yet (rating: 0)');
              // Show "New Driver" indicator for drivers with rating 0
              setDriverRating(0);
              setIsNewDriver(true);
              logger.debug('⭐ LiveTrackingScreen: Set as new driver');
            }
          } else {
            console.warn('⚠️ LiveTrackingScreen: No driver rating found in backend response');
            // Don't set fallback rating - only show when real data is available
          }
          
          // Update driver phone number from backend - check multiple possible fields
          let phoneFromBackend = null;
          
          logger.debug('📞 LiveTrackingScreen: Checking for driver phone in response data...');
          logger.debug('📞 LiveTrackingScreen: driver object:', response.data.driver);
          logger.debug('📞 LiveTrackingScreen: pilot object:', response.data.pilot);
          
          if (response.data.driver?.phoneNumber) {
            phoneFromBackend = response.data.driver.phoneNumber;
            logger.debug('📞 LiveTrackingScreen: Found driver phone in driver.phoneNumber:', phoneFromBackend);
          } else if (response.data.pilot?.phoneNumber) {
            phoneFromBackend = response.data.pilot.phoneNumber;
            logger.debug('📞 LiveTrackingScreen: Found driver phone in pilot.phoneNumber:', phoneFromBackend);
          } else if (response.data.driver?.phone) {
            phoneFromBackend = response.data.driver.phone;
            logger.debug('📞 LiveTrackingScreen: Found driver phone in driver.phone:', phoneFromBackend);
          } else if (response.data.pilot?.phone) {
            phoneFromBackend = response.data.pilot.phone;
            logger.debug('📞 LiveTrackingScreen: Found driver phone in pilot.phone:', phoneFromBackend);
          }
          
          if (phoneFromBackend) {
            logger.debug('📞 LiveTrackingScreen: Setting driver phone from backend:', phoneFromBackend);
            setDriverPhoneNumber(phoneFromBackend);
          } else {
            console.warn('⚠️ LiveTrackingScreen: No driver phone found in backend response');
          }
          
          // Update other ride details if available
          if (response.data.status) {
            logger.debug('📊 LiveTrackingScreen: Setting ride status from backend:', response.data.status);
            setRideStatus(response.data.status);
          }
          
          // Update driver info with correct driver ID from backend
          if (response.data?.driver?.id) {
            const driverId = response.data.driver.id;
            logger.debug('🆔 LiveTrackingScreen: Updating driver info with backend driver ID:', driverId);
            // Update the driver info to use the correct driver ID from backend
            // This ensures we listen for location updates from the correct driver
            setDriverInfoState(prev => ({
              ...prev,
              id: driverId, // Use the actual driver ID from backend
              name: response.data!.driver!.firstName || prev.name,
              phone: response.data!.driver!.phoneNumber || prev.phone,
              // Keep vehicle info consistent with the scooter icon
              vehicleType: 'scooter',
              vehicleModel: 'Scooter',
              vehicleColor: 'Green',
              vehicleNumber: '3M53AF2'
            }));
          }
        } else {
          console.warn('⚠️ LiveTrackingScreen: Failed to fetch ride details:', response.message);
        }
      } catch (error) {
        console.error('❌ LiveTrackingScreen: Error fetching ride details:', error);
      } finally {
        setIsLoadingRideData(false);
        
        // Fallback: If no rating was set, use the rating from backend response
        if (driverRating === null) {
          logger.debug('🔄 LiveTrackingScreen: No rating set, using fallback logic');
          // Set as new driver for testing
          setDriverRating(0);
          setIsNewDriver(true);
          logger.debug('🔄 LiveTrackingScreen: Set fallback rating as new driver');
        }
      }
    };

    fetchRideDetails();

    // Cleanup function to reset flag when component unmounts
    return () => {
      hasFetchedRideDetails.current = false;
    };
  }, [rideId]); // Removed getToken from dependencies to prevent infinite loop

  useEffect(() => {
    logger.debug('�� LiveTrackingScreen: Setting up ride status and driver location listeners');
    logger.debug('🔧 Current rideId:', rideId);
    logger.debug('🔧 Current driverInfo:', driverInfoState);
    
    // Listen for real-time ride status and driver location updates
    onRideStatus((data: { rideId: string; status: string; message?: string; }) => {
      logger.debug('🔄 LiveTrackingScreen received ride status update:', data);
      logger.debug('🔄 Checking if rideId matches:', data.rideId, '===', rideId);
      
      if (data.rideId === rideId) {
        logger.debug('✅ RideId matches, updating status from', rideStatus, 'to', data.status);
        setRideStatus(data.status);
        
        // Only handle completion and cancellation here
        // Driver arrival and ride start are handled by direct socket listeners
        if (data.status === 'completed') {
          logger.debug('✅ Ride completed, waiting for QR payment modal from driver');
          // Don't navigate immediately - wait for QR payment flow
        }
        if (data.status === 'cancelled') {
          logger.debug('❌ Ride cancelled');
          Alert.alert('Ride Cancelled', (data as any).message || 'Your ride has been cancelled.');
          navigation.navigate('TabNavigator', { screen: 'Home' });
        }
      } else {
        logger.debug('🚫 Ignoring ride status update for different ride:', data.rideId, 'expected:', rideId);
      }
    });

    // Listen for ride completed event specifically
    onRideCompleted((data: { rideId: string; status: string; message: string; timestamp: number; }) => {
      logger.debug('✅ LiveTrackingScreen received ride completed event:', data);
      logger.debug('✅ Checking if rideId matches:', data.rideId, '===', rideId);
      
      if (data.rideId === rideId) {
        logger.debug('✅ Ride completed event matches current ride, waiting for QR payment');
        // Don't navigate immediately - wait for QR payment flow
      } else {
        logger.debug('🚫 Ignoring ride completed event for different ride:', data.rideId, 'expected:', rideId);
      }
    });

    onDriverLocation((data: { driverId: string; latitude: number; longitude: number; timestamp?: number; }) => {
      logger.debug('📍 Received driver location update:', data);
      logger.debug('📍 Current driver ID:', currentDriverId);
      logger.debug('📍 Driver ID match:', data.driverId === currentDriverId);
      logger.debug('📍 Location data validation:', {
        hasLatitude: typeof data.latitude === 'number' && !isNaN(data.latitude),
        hasLongitude: typeof data.longitude === 'number' && !isNaN(data.longitude),
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : 'No timestamp'
      });
      
      // Enhanced validation for location data
      if (!data.latitude || !data.longitude || 
          isNaN(data.latitude) || isNaN(data.longitude) ||
          data.latitude === 0 || data.longitude === 0) {
        logger.debug('🚫 Invalid location data received, ignoring update');
        return;
      }
      
      if (data.driverId === currentDriverId) {
        setLocationUpdateCount(prev => prev + 1);
        
        // Use coordinate validation function to ensure consistency
        const validatedLocation = validateAndProcessCoordinates(data.latitude, data.longitude);
        if (!validatedLocation) {
          logger.debug('🚫 Coordinate validation failed, ignoring update');
          return;
        }
        
        // Log coordinate details for debugging (only in development)
        if (__DEV__) {
          logger.debug('✅ Valid driver location received:', validatedLocation);
          logger.debug('🔍 Coordinate details:', {
            received: validatedLocation,
            latPrecision: validatedLocation.latitude.toString().split('.')[1]?.length || 0,
            lngPrecision: validatedLocation.longitude.toString().split('.')[1]?.length || 0,
            timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : 'No timestamp'
          });
        }
        
        // Update driver location with animation and path tracking
        updateDriverLocationWithAnimation(validatedLocation);
        
        // Update real-time status
        setLastLocationUpdate(new Date());
        
        // Fetch updated route path when driver moves
        if (origin?.latitude && origin?.longitude) {
          fetchRoutePath(validatedLocation, { latitude: origin.latitude, longitude: origin.longitude });
        }
        
        // Only log in development mode
        if (__DEV__) {
          logger.debug('✅ Driver location updated successfully');
        }
      } else {
        // Only log driver ID mismatch in development mode
        if (__DEV__) {
          logger.debug('🚫 Driver ID mismatch, ignoring location update');
          logger.debug('🚫 Expected driver ID:', currentDriverId);
          logger.debug('🚫 Received driver ID:', data.driverId);
        }
      }
    });
    
    return () => {
      logger.debug('🧹 LiveTrackingScreen: Cleaning up ride status and driver location listeners');
      clearCallbacks();
    };
  }, [rideId, navigation, destination, estimate, currentDriverId]); // Added currentDriverId to re-run when driver ID changes

  // Set initial driver location near pickup point
  useEffect(() => {
    if (!driverLocation && origin?.latitude && origin?.longitude) {
      const initialDriverLocation = {
        latitude: origin.latitude + 0.001, // 100m away from pickup
        longitude: origin.longitude + 0.001
      };
      logger.debug('📍 Setting initial driver location:', initialDriverLocation);
      setDriverLocation(initialDriverLocation);
      setDriverPath([initialDriverLocation]);
    }
  }, [origin, driverLocation]);

  // Test socket connection
  useEffect(() => {
    const testSocketConnection = () => {
      logger.debug('🧪 Testing socket connection...');
      const socket = getSocket();
      if (socket && socket.connected) {
        logger.debug('✅ Socket is connected, emitting test event');
        socket.emit('test_event', { message: 'Hello from customer app', timestamp: Date.now() });
      } else {
        logger.debug('❌ Socket is not connected');
      }
    };

    // Test after 2 seconds
    const timer = setTimeout(testSocketConnection, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch route path when driver location or pickup point changes
  useEffect(() => {
    if (driverLocation && origin?.latitude && origin?.longitude) {
      fetchRoutePath(driverLocation, { latitude: origin.latitude, longitude: origin.longitude });
    }
  }, [driverLocation, origin]);

  // Listen for driver_arrived event to show MPIN entry
  useEffect(() => {
    logger.debug('🔧 LiveTrackingScreen: Setting up direct socket listeners');
    logger.debug('🔧 Current rideId for direct listeners:', rideId);
    
    const handleDriverArrived = async (data: { rideId: string; driverId: string; message?: string; status?: string }) => {
      logger.debug('🎯 LiveTrackingScreen received driver_arrived event:', data);
      logger.debug('🎯 Checking if rideId matches:', data.rideId, '===', rideId);
      
      if (data.rideId === rideId) {
        logger.debug('🚗 Driver arrived at pickup location, staying on LiveTrackingScreen');
        logger.debug('🚗 OTP is already displayed on this screen for customer to share');
        
        // Send push notification for driver arrived
        try {
          logger.debug('🚗 Sending driver arrived push notification...');
          
          // Get the user's push token
          const tokenData = await getStoredToken();
          if (tokenData?.token) {
            const backendService = BackendNotificationService.getInstance();
            await backendService.sendDriverArrivedNotification(tokenData.token, {
              rideId: data.rideId,
              driverId: data.driverId,
              driverName: driverInfoState.name,
              pickupLocation: origin?.name || 'Your pickup location'
            });
            logger.debug('✅ Driver arrived push notification sent successfully');
          } else {
            logger.debug('⚠️ No push token available for driver arrived notification');
          }
          
          // Update ride status
          setRideStatus('arrived');
        } catch (error) {
          console.error('❌ Error sending driver arrived notification:', error);
        }
        
        // Stay on LiveTrackingScreen - OTP is already displayed here
        // Customer can share the OTP with the driver directly from this screen
      } else {
        logger.debug('🚫 Ignoring driver_arrived event for different ride:', data.rideId, 'expected:', rideId);
      }
    };

    // Listen for ride_started event to go to ride in progress
    const handleRideStarted = (data: { rideId: string; driverId: string; message?: string; status?: string }) => {
      logger.debug('🎯 LiveTrackingScreen received ride_started event:', data);
      logger.debug('🎯 Checking if rideId matches:', data.rideId, '===', rideId);
      
      if (data.rideId === rideId) {
        logger.debug('🚀 Ride started, navigating to RideInProgress');
        logger.debug('🚀 Current screen state before navigation:', { rideStatus });
        
        navigation.replace('RideInProgress', {
          driver: driverInfoState,
          rideId,
          destination,
          origin,
          estimate, // Add the estimate data
        });
      } else {
        logger.debug('🚫 Ignoring ride_started event for different ride:', data.rideId, 'expected:', rideId);
      }
    };

    // Handle ride cancellation
    const handleRideCancelled = (data: { rideId: string; message?: string; status?: string }) => {
      logger.debug('❌ LiveTrackingScreen received ride_cancelled event:', data);
      logger.debug('❌ Checking if rideId matches:', data.rideId, '===', rideId);
      
      if (data.rideId === rideId) {
        logger.debug('✅ Processing ride cancellation for correct ride');
        setIsCancelling(false); // Reset cancel button state
        
        Alert.alert(
          'Ride Cancelled',
          data.message || 'Your ride has been cancelled.',
          [
            {
              text: 'OK',
              onPress: () => {
                logger.debug('🚀 Navigating to home screen after ride cancellation');
                navigation.replace('TabNavigator', { screen: 'Home' });
              }
            }
          ]
        );
      } else {
        logger.debug('🚫 Ignoring ride_cancelled event for different ride:', data.rideId, 'expected:', rideId);
      }
    };

    // Handle ride cancellation success (when user cancels)
    const handleRideCancellationSuccess = (data: { message: string; cancellationFee: number }) => {
      logger.debug('✅ LiveTrackingScreen received ride_cancellation_success event:', data);
      setIsCancelling(false); // Reset cancel button state
      
      const message = data.cancellationFee > 0 
        ? `${data.message}\n\nCancellation fee: ₹${data.cancellationFee}`
        : data.message;
      
      Alert.alert(
        'Ride Cancelled',
        message,
        [
          {
            text: 'OK',
            onPress: () => {
              logger.debug('🚀 Navigating to home screen after user cancellation');
              navigation.replace('TabNavigator', { screen: 'Home' });
            }
          }
        ]
      );
    };

    // Handle ride cancellation error
    const handleRideCancellationError = (data: { message: string }) => {
      logger.debug('❌ LiveTrackingScreen received ride_cancellation_error event:', data);
      setIsCancelling(false); // Reset cancel button state
      
      Alert.alert(
        'Cancellation Failed',
        data.message || 'Failed to cancel ride. Please try again.',
        [{ text: 'OK' }]
      );
    };

    // Add event listeners
    const socket = require('../../utils/socket').getSocket();
    if (socket) {
      logger.debug('🔗 Adding direct socket listeners to socket:', socket.id);
      logger.debug('🔗 Socket connected:', socket.connected);
      socket.on('driver_arrived', handleDriverArrived);
      socket.on('ride_started', handleRideStarted);
      socket.on('ride_cancelled', handleRideCancelled);
      socket.on('ride_cancellation_success', handleRideCancellationSuccess);
      socket.on('ride_cancellation_error', handleRideCancellationError);
    } else {
      console.warn('⚠️ No socket available for direct event listeners');
    }

    return () => {
      if (socket) {
        logger.debug('🧹 LiveTrackingScreen: Cleaning up direct socket listeners');
      socket.off('driver_arrived', handleDriverArrived);
      socket.off('ride_started', handleRideStarted);
      socket.off('ride_cancelled', handleRideCancelled);
      socket.off('ride_cancellation_success', handleRideCancellationSuccess);
      socket.off('ride_cancellation_error', handleRideCancellationError);
      }
    };
  }, [rideId, driverInfo, navigation, destination, origin]);

  const handleChat = () => {
    logger.debug('🔗 Navigating to Chat with data:', { 
      ride: { rideId: rideId },
      driver: driverInfo,
      userId: route.params.userId || 'user123'
    });
    navigation.navigate('Chat', { 
      ride: { rideId: rideId },
      driver: driverInfo,
      userId: route.params.userId || 'user123'
    });
  };

  const handleCall = () => {
    setCallModalVisible(true);
  };

  const handleCallNow = () => {
    setCallModalVisible(false);
    const phoneToCall = driverPhoneNumber || driverInfoState.phone;
    if (phoneToCall) {
      logger.debug('📞 LiveTrackingScreen: Calling driver with phone:', phoneToCall);
      Linking.openURL(`tel:${phoneToCall}`);
    } else {
      Alert.alert('No phone number available');
    }
  };

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Who do you want to call?',
      [
        { text: 'Police', onPress: () => Linking.openURL('tel:100') },
        { text: 'Ambulance', onPress: () => Linking.openURL('tel:108') },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleCompleteRide = () => {
    navigation.navigate('RideSummary', {
      destination,
      estimate,
      driver: driverInfo,
    });
  };

  const onShareTrip = async () => {
    try {
      await Share.share({
        message: 'Check out my trip details! [Add trip info or link here]',
      });
    } catch (error: any) {
      alert('Error sharing: ' + (error?.message || error?.toString() || 'Unknown error'));
    }
  };



  // Function to fetch real road route between driver and pickup using Google Directions API
  const fetchRoutePath = async (driverPos: {latitude: number, longitude: number}, pickupPos: {latitude: number, longitude: number}) => {
    try {
      logger.debug('🛣️ Fetching real road route from Google Directions API...');
      const routingService = RoutingService.getInstance();
      
      // Try to get real route from Google Directions API first
      const routeResponse = await routingService.getRoute(driverPos, pickupPos, 'driving');
      
      if (routeResponse.success && routeResponse.route) {
        logger.debug('✅ Got real road route with', routeResponse.route.length, 'points');
        setRoutePath(routeResponse.route);
      } else {
        // Fallback to generated path if API fails
        logger.debug('⚠️ Google Directions API failed, using fallback path');
        const curvedPath = routingService.generateCurvedPath(driverPos, pickupPos, 30);
        logger.debug('🛣️ Generated fallback path with', curvedPath.length, 'points');
        setRoutePath(curvedPath);
      }
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      // Fallback to generated path
      const routingService = RoutingService.getInstance();
      const curvedPath = routingService.generateCurvedPath(driverPos, pickupPos, 30);
      logger.debug('🛣️ Generated fallback path with', curvedPath.length, 'points');
      setRoutePath(curvedPath);
    }
  };

  // Function to get the appropriate driver icon based on vehicle type
  const getDriverIcon = () => {
    const vehicleType = driverInfoState?.vehicleType?.toLowerCase() || '';
    const vehicleModel = driverInfoState?.vehicleModel?.toLowerCase() || '';
    
    // For bike/scooter rides, use the scooter image from assets
    if (vehicleType.includes('scooter') || vehicleType.includes('bike') || vehicleModel.includes('scooter') || vehicleModel.includes('bike')) {
      return 'scooter'; // Use scooter image
    } else if (vehicleType.includes('car') || vehicleModel.includes('civic') || vehicleModel.includes('car')) {
      return 'car-sport'; // Car icon
    } else if (vehicleType.includes('auto') || vehicleModel.includes('auto')) {
      return 'car'; // Auto rickshaw icon
    } else {
      return 'scooter'; // Default to scooter for bike rides
    }
  };

  // Force center map on driver location for debugging
  const forceCenterOnDriver = () => {
    if (driverLocation && mapRef.current) {
      logger.debug('🔧 Force centering map on driver location:', driverLocation);
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.005, // Zoom in closer
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  // Force center map on exact driver app coordinates - removed hardcoded coordinates

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Connection Status */}
      <ConnectionStatus />

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: origin?.latitude || destination?.latitude || 17.4448,
            longitude: origin?.longitude || destination?.longitude || 78.3498,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          region={driverLocation ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : {
            latitude: origin?.latitude || destination?.latitude || 17.4448,
            longitude: origin?.longitude || destination?.longitude || 78.3498,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          showsBuildings={false}
          showsIndoors={false}
          showsIndoorLevelPicker={false}
          showsPointsOfInterest={false}
          mapType="standard"
          followsUserLocation={false}
          onMapReady={() => {
            logger.debug('🗺️ Map is ready');
            // If we have driver location, center the map on it
            if (driverLocation) {
              logger.debug('🗺️ Centering map on driver location:', driverLocation);
              mapRef.current?.animateToRegion({
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000);
            }
          }}
        >
          {/* Enhanced polyline visualization */}
          {/* Route from driver to pickup point - actual road path */}
          {routePath.length > 0 && (
            <Polyline
              coordinates={routePath}
              strokeColor="#000000"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              zIndex={3}
            />
          )}
          
          {/* Driver's traveled path (polyline) */}
          {driverPath.length > 1 && (
            <Polyline
              coordinates={driverPath}
              strokeColor={Colors.success}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
          )}
          
          {/* Route from pickup to destination when ride is in progress */}
          {rideStatus === 'in_progress' && origin && origin.latitude && origin.longitude && 
           destination && destination.latitude && destination.longitude && (
            <Polyline
              coordinates={[
                { latitude: origin.latitude, longitude: origin.longitude },
                { latitude: destination.latitude, longitude: destination.longitude }
              ]}
              strokeColor={Colors.warning}
              strokeWidth={5}
              lineDashPattern={[10, 5]}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
          )}
          {/* Route progress indicator - animated dot moving along the route */}
          {rideStatus === 'arriving' && driverLocation && origin && origin.latitude && origin.longitude && (
            <Marker 
              coordinate={{
                latitude: (driverLocation.latitude + origin.latitude) / 2,
                longitude: (driverLocation.longitude + origin.longitude) / 2
              }}
            >
              <Animated.View style={[styles.progressIndicator, animatedDriverStyle]}>
                <View style={styles.progressDot} />
              </Animated.View>
            </Marker>
          )}
          {animatedDriverLocation && (
            <Marker 
              coordinate={animatedDriverLocation}
              title="Driver"
              onPress={() => {
                logger.debug('📍 Driver marker pressed at:', animatedDriverLocation);
              }}
            >
              <Animated.View style={[styles.driverMarker, animatedDriverStyle]}>
                <Image 
                  source={
                    driverInfoState?.vehicleType?.toLowerCase().includes('auto') || 
                    driverInfoState?.vehicleModel?.toLowerCase().includes('auto') 
                      ? Images.RICKSHAW 
                      : driverInfoState?.vehicleType?.toLowerCase().includes('scooter') || 
                        driverInfoState?.vehicleType?.toLowerCase().includes('bike') ||
                        driverInfoState?.vehicleModel?.toLowerCase().includes('scooter') || 
                        driverInfoState?.vehicleModel?.toLowerCase().includes('bike')
                        ? Images.SCOOTER_1
                        : Images.ICON_ANIMATION_1
                  }
                  style={{ width: 40, height: 40 }}
                  resizeMode="contain"
                />
              </Animated.View>
            </Marker>
          )}
          {/* Pickup marker */}
          {origin && origin.latitude && origin.longitude && (
            <Marker coordinate={{ latitude: origin.latitude, longitude: origin.longitude }} title="Pickup">
              <View style={styles.pickupMarker}>
                <Ionicons name="location" size={24} color={Colors.white} />
              </View>
            </Marker>
          )}
          {destination && destination.latitude && destination.longitude && (
            <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title="Destination" pinColor={Colors.coral} />
          )}
          
          {/* Test marker removed - was causing confusion with wrong coordinates */}
        </MapView>
        
        {/* Debug overlay for driver location coordinates */}
        {__DEV__ && driverLocation && (
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>
              🚗 Driver Location: {driverLocation.latitude.toFixed(6)}, {driverLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.debugText}>
              📍 Updates: {locationUpdateCount} | Path: {driverPath.length}
            </Text>
            <Text style={styles.debugText}>
              ⏰ Last Update: {lastLocationUpdate?.toLocaleTimeString() || 'Never'}
            </Text>
            <View style={styles.debugButtons}>
              <TouchableOpacity style={styles.debugButton} onPress={forceCenterOnDriver}>
                <Text style={styles.debugButtonText}>Center on Driver</Text>
              </TouchableOpacity>
                          <TouchableOpacity style={styles.debugButton} onPress={() => logger.debug('Debug button removed')}>
              <Text style={styles.debugButtonText}>Center on Exact</Text>
            </TouchableOpacity>
              <TouchableOpacity 
                style={styles.debugButton} 
                onPress={() => {
                  const exactCoords = { latitude: 17.452078, longitude: 78.3935025 };
                  logger.debug('🔧 Force centering map on latest driver coordinates:', exactCoords);
                  if (mapRef.current) {
                    mapRef.current.animateToRegion({
                      latitude: exactCoords.latitude,
                      longitude: exactCoords.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }, 1000);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Center on Latest</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Driver Arrival Status */}
        <View style={styles.arrivalSection}>
          <Text style={styles.arrivalText}>{realDriverName || pilotName} is arriving soon</Text>
        </View>

        {/* Driver and Vehicle Details */}
        <View style={styles.driverSection}>
          <View style={styles.driverInfo}>
            <Image 
              source={
                driverInfoState?.vehicleType?.toLowerCase().includes('auto') || 
                driverInfoState?.vehicleModel?.toLowerCase().includes('auto') 
                  ? Images.RICKSHAW 
                  : driverInfoState?.vehicleType?.toLowerCase().includes('scooter') || 
                    driverInfoState?.vehicleType?.toLowerCase().includes('bike') ||
                    driverInfoState?.vehicleModel?.toLowerCase().includes('scooter') || 
                    driverInfoState?.vehicleModel?.toLowerCase().includes('bike')
                    ? Images.SCOOTER_1
                    : Images.ICON_ANIMATION_1
              } 
              style={styles.driverPhoto} 
            />
          </View>
          
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{realDriverName || pilotName}</Text>
                          <Text style={styles.licensePlate}>{driverInfoState.vehicleNumber || '3M53AF2'}</Text>
              <Text style={styles.vehicleInfo}>
                {driverInfoState.vehicleModel || 'Scooter'} - {driverInfoState.vehicleColor || 'Green'}
              </Text>
            <View style={styles.ratingContainer}>
              {driverRating !== null && (
                <>
                  {isNewDriver ? (
                    <View style={styles.newDriverContainer}>
                      <Ionicons name="star" size={16} color={Colors.warning} />
                      <Text style={styles.newDriverText}>New Driver</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= driverRating ? "star" : "star-outline"}
                            size={16}
                            color={star <= driverRating ? Colors.warning : Colors.gray300}
                          />
                        ))}
                      </View>
                      <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
          
          {/* ETA Badge */}
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>
              {(driverInfoState.eta || '5 minutes').replace(/\D/g, '') + ' MIN'}
            </Text>
          </View>
        </View>

        {/* PIN Display */}
        <View style={styles.pinSection}>
          <PinDisplay 
            pin={otpCode} 
            onShare={onShareTrip}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={handleChat}>
            <Text style={styles.messageButtonText}>Send a message</Text>
          </TouchableOpacity>
          
          {/* Driver Arrived Button - Only show when driver is arriving */}
          {rideStatus === 'arriving' && (
            <TouchableOpacity 
              style={[styles.messageButton, { backgroundColor: Colors.success }]} 
              onPress={handleDriverArrived}
            >
              <Text style={[styles.messageButtonText, { color: Colors.white }]}>
                🚗 Pilot Arrived
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.iconButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color={Colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={onShareTrip}>
              <Ionicons name="share" size={20} color={Colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.emergencyButton} onPress={handleSOS}>
              <Ionicons name="shield" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancel Button */}
        <View style={styles.cancelButtonContainer}>
          <TouchableOpacity 
            style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]} 
            onPress={handleCancelRide}
            disabled={isCancelling}
          >
            <Ionicons 
              name={isCancelling ? "hourglass" : "close-circle"} 
              size={20} 
              color={isCancelling ? Colors.gray400 : Colors.error} 
            />
            <Text style={[styles.cancelButtonText, isCancelling && styles.cancelButtonTextDisabled]}>
              {isCancelling ? 'Cancelling...' : 'Cancel Ride'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Call Modal */}
      <Modal
        visible={callModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCallModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.callModal}>
            <Text style={styles.modalTitle}>Call Pilot</Text>
            <Text style={styles.modalDriverName}>{pilotName}</Text>
            <Text style={styles.modalPhone}>{driverPhoneNumber || driverInfoState.phone || 'No phone number'}</Text>
            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              <TouchableOpacity style={styles.modalButton} onPress={handleCallNow}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ccc', marginLeft: 10 }]} onPress={() => setCallModalVisible(false)}>
                <Text style={[styles.modalButtonText, { color: '#222' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  driverMarker: {
    // Remove background styling since iconAnimation1.png has its own glow effect
    alignItems: 'center',
    justifyContent: 'center',
    // Add a subtle shadow for better visibility on map
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success, // Green pin
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  arrivalSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  arrivalText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative', // Add this for absolute positioning of ETA badge
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  vehicleImage: {
    width: 60,
    height: 36,
    backgroundColor: Colors.gray200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  licensePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    flex: 1,
    marginRight: 16,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  iconButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.gray200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cameraCount: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: -8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModal: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: 320,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.primary,
  },
  modalDriverName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text,
  },
  modalPhone: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  newDriverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7', // Light warning background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newDriverText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
    marginLeft: 4,
  },
  etaBadge: {
    backgroundColor: '#1e40af', // Blue color matching PIN
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  etaText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  emergencyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.gray200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  progressIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  debugOverlay: {
    position: 'absolute',
    top: 100,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  debugText: {
    color: Colors.white,
    fontSize: 12,
    marginBottom: 2,
  },
  debugButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  debugButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButtonContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
    borderColor: Colors.gray400,
  },
  cancelButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'System',
  },
  cancelButtonTextDisabled: {
    color: Colors.gray400,
  },


});
