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
import { onRideStatus, onDriverLocation, onRideCompleted, clearCallbacks, getSocket } from '../../utils/socket';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Images } from '../../constants/Images';
import ConnectionStatus from '../../components/common/ConnectionStatus';
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

export default function RideInProgressScreen({ navigation, route }: any) {
  const { destination, driver, rideId, origin, mpinVerified, estimate } = route.params;
  const { getToken } = useAuth();
  const { getStoredToken } = useNotifications();
  
  logger.debug('RideInProgressScreen: Component initialized with params', {
    destination,
    estimate,
    driver,
    rideId,
    origin
  });
  
  const [rideStatus, setRideStatus] = useState('in_progress');
  const [currentETA, setCurrentETA] = useState('25 mins');
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [driverPath, setDriverPath] = useState<{latitude: number, longitude: number}[]>([]);
  const [routePath, setRoutePath] = useState<{latitude: number, longitude: number}[]>([]);
  const [overallTripRoute, setOverallTripRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [rideProgress, setRideProgress] = useState(0);
  const [pathUpdateCount, setPathUpdateCount] = useState(0);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const [isLoadingRideData, setIsLoadingRideData] = useState(true);
  
  const driverInfo = driver;
  const mapRef = useRef<MapView>(null);

  // Animated values for smooth driver marker animation
  const animatedLatitude = useSharedValue(0);
  const animatedLongitude = useSharedValue(0);
  const driverRotation = useSharedValue(0);
  const driverScale = useSharedValue(1);
  const driverOpacity = useSharedValue(1);
  const pulseAnimation = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  // Animated driver location state
  const [animatedDriverLocation, setAnimatedDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);

  // Prevent back navigation during ride in progress
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Always prevent back navigation during ride in progress
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

  // Start pulse animation for driver marker
  useEffect(() => {
    pulseAnimation.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  // Function to animate driver to new location smoothly
  const animateDriverToLocation = (newLocation: {latitude: number, longitude: number}) => {
    if (!driverLocation) {
      // First location, set immediately
      animatedLatitude.value = newLocation.latitude;
      animatedLongitude.value = newLocation.longitude;
      setAnimatedDriverLocation(newLocation);
      return;
    }

    isAnimating.value = true;
    
    // Create worklets for logging that run on JS thread
    const logLatitudeComplete = () => {
      logger.debug('Latitude animation completed');
    };
    
    const logLongitudeComplete = () => {
      logger.debug('Longitude animation completed');
    };
    
    // Animate latitude
    animatedLatitude.value = withTiming(
      newLocation.latitude,
      { duration: 5000, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(logLatitudeComplete)();
        }
      }
    );
    
    // Animate longitude
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

  // Update location tracking when driver location changes
  useEffect(() => {
    if (driverLocation) {
      setLastLocationUpdate(new Date());
      
      // Start smooth animation to new location
      animateDriverToLocation(driverLocation);
    }
  }, [driverLocation]);

  // Update driver location with animation and path tracking
  const updateDriverLocationWithAnimation = (newLocation: {latitude: number, longitude: number}) => {
    logger.location('Updating driver location', { from: driverLocation, to: newLocation });
    
    // Validate the new location
    if (!newLocation || !newLocation.latitude || !newLocation.longitude ||
        isNaN(newLocation.latitude) || isNaN(newLocation.longitude)) {
      logger.warn('Invalid new location data, skipping update');
      return;
    }
    
    // Additional validation for coordinate ranges
    if (newLocation.latitude < -90 || newLocation.latitude > 90 || 
        newLocation.longitude < -180 || newLocation.longitude > 180) {
      logger.warn('Coordinates out of valid range, skipping update');
      return;
    }
    
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
        logger.debug('Updated driver path', { length: newPath.length });
        return newPath;
      }
      logger.debug('Path not updated - duplicate location');
      return prev;
    });
    
    // Immediately update map region to follow driver
    if (mapRef.current) {
      logger.debug('Animating map to follow driver location', newLocation);
      const region = {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      mapRef.current.animateToRegion(region, 1000); // 1 second animation
    }
    
    logger.debug('Driver location update completed successfully');
  };

  // Function to fetch real road route between driver and destination using Google Directions API
  const fetchRoutePath = async (driverPos: {latitude: number, longitude: number}, destPos: {latitude: number, longitude: number}) => {
    try {
      logger.api('Fetching real road route from Google Directions API', { driverPos, destPos });
      
      const routingService = RoutingService.getInstance();
      
      // Try to get real route from Google Directions API first
      const routeResponse = await routingService.getRoute(driverPos, destPos, 'driving');
      
      logger.api('Route response received', routeResponse);
      
      if (routeResponse.success && routeResponse.route && routeResponse.route.length > 0) {
        logger.success('Got real road route', { 
          pointCount: routeResponse.route.length,
          firstPoint: routeResponse.route[0],
          lastPoint: routeResponse.route[routeResponse.route.length - 1]
        });
        setRoutePath(routeResponse.route);
      } else {
        // Fallback to generated path if API fails
        logger.warn('Google Directions API failed or returned empty route, using fallback path');
        const curvedPath = routingService.generateCurvedPath(driverPos, destPos, 50);
        logger.debug('Generated fallback path', { pointCount: curvedPath.length });
        setRoutePath(curvedPath);
      }
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      // Fallback to generated path
      const routingService = RoutingService.getInstance();
      const curvedPath = routingService.generateCurvedPath(driverPos, destPos, 50);
      logger.debug('Generated fallback path', { pointCount: curvedPath.length });
      setRoutePath(curvedPath);
    }
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

  useEffect(() => {
    logger.debug('RideInProgressScreen mounted', { params: route.params, mpinVerified });
    
    // Listen for real-time ride status and driver location updates
    onRideStatus((data: { rideId: string; status: string; message?: string; }) => {
      if (data.rideId === rideId) {
        logger.debug('Ride status update', data);
        setRideStatus(data.status);
        
        if (data.status === 'completed') {
          logger.success('Ride completed, navigating to payment screen');
          // Convert fare from INR to paise for payment
          const fareInINR = estimate?.fare || 73; // Default to 73 INR
          const paymentAmount = Math.round(fareInINR * 100); // Convert to paise
          logger.info('Payment details', { fareInINR, paymentAmount });
          
          // Navigate to post-ride payment screen
          navigation.navigate('PostRidePayment', {
            rideId,
            amount: paymentAmount,
            destination,
            driver: driverInfo,
            estimate: estimate || { fare: fareInINR },
          });
        } else if (data.status === 'cancelled') {
          Alert.alert('Ride Cancelled', data.message || 'Your ride has been cancelled.');
          navigation.navigate('TabNavigator', { screen: 'Home' });
        }
      }
    });

    // Listen for ride completed event specifically (backup for payment flow)
    onRideCompleted((data: { rideId: string; status: string; message: string; timestamp: number; }) => {
      logger.debug('RideInProgressScreen received ride completed event', data);
      logger.debug('Checking if rideId matches', { received: data.rideId, expected: rideId });
      
      if (data.rideId === rideId) {
        logger.success('Ride completed event matches current ride, navigating to payment screen');
        // Convert fare from INR to paise for payment
        const fareInINR = estimate?.fare || 73; // Default to 73 INR
        const paymentAmount = Math.round(fareInINR * 100); // Convert to paise
        logger.info('Payment details from completed event', { fareInINR, paymentAmount });
        
        // Navigate to post-ride payment screen
        navigation.navigate('PostRidePayment', {
          rideId,
          amount: paymentAmount,
          destination,
          driver: driverInfo,
          estimate: estimate || { fare: fareInINR },
        });
      } else {
        logger.debug('Ignoring ride completed event for different ride', { received: data.rideId, expected: rideId });
      }
    });

    onDriverLocation((data: { driverId: string; latitude: number; longitude: number; }) => {
      logger.location('Driver location update', data);
      setLocationUpdateCount(prev => prev + 1);
      
      const newLocation = { latitude: data.latitude, longitude: data.longitude };
      updateDriverLocationWithAnimation(newLocation);
      
      // Fetch route path when we have both driver location and destination
      if (destination && destination.latitude && destination.longitude) {
        fetchRoutePath(newLocation, destination);
      }
    });

    return () => {
      clearCallbacks();
    };
  }, [rideId, navigation, destination, origin, estimate, driverInfo]);

  // Add direct socket listener for ride cancellation
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleRideCancelled = (data: { rideId: string; message?: string; status?: string }) => {
        logger.debug('❌ RideInProgressScreen received ride_cancelled event:', data);
        logger.debug('❌ Checking if rideId matches:', data.rideId, '===', rideId);
        
        if (data.rideId === rideId) {
          logger.debug('✅ Processing ride cancellation for correct ride');
          Alert.alert(
            'Ride Cancelled',
            data.message || 'Your ride has been cancelled by the driver.',
            [
              {
                text: 'OK',
                onPress: () => {
                  logger.debug('🚀 Navigating to home screen after driver cancellation');
                  navigation.replace('TabNavigator', { screen: 'Home' });
                }
              }
            ]
          );
        } else {
          logger.debug('🚫 Ignoring ride_cancelled event for different ride:', data.rideId, 'expected:', rideId);
        }
      };

      socket.on('ride_cancelled', handleRideCancelled);

      return () => {
        socket.off('ride_cancelled', handleRideCancelled);
      };
    }
  }, [rideId, navigation]);

  // Initial route fetching when component mounts or when we have coordinates
  useEffect(() => {
    logger.debug('Initial route fetching setup', { driverLocation, destination });
    
    // If we have driver location and destination, fetch the route immediately
    if (driverLocation && destination?.latitude && destination?.longitude) {
      logger.debug('Fetching initial route from driver to destination');
      fetchRoutePath(driverLocation, destination);
    }
    
    // Also fetch route from pickup to destination for the overall trip route
    if (origin?.latitude && origin?.longitude && 
        destination?.latitude && destination?.longitude) {
      logger.debug('Fetching overall trip route from pickup to destination');
      fetchOverallTripRoute(origin, destination);
    }
  }, [driverLocation, destination, origin]);

  // Function to fetch overall trip route from pickup to destination
  const fetchOverallTripRoute = async (pickupPos: {latitude: number, longitude: number}, destPos: {latitude: number, longitude: number}) => {
    try {
      logger.api('Fetching overall trip route from Google Directions API', { pickupPos, destPos });
      
      const routingService = RoutingService.getInstance();
      
      // Try to get real route from Google Directions API first
      const routeResponse = await routingService.getRoute(pickupPos, destPos, 'driving');
      
      logger.api('Overall trip route response', routeResponse);
      
      if (routeResponse.success && routeResponse.route && routeResponse.route.length > 0) {
        logger.success('Got overall trip route', {
          pointCount: routeResponse.route.length,
          firstPoint: routeResponse.route[0],
          lastPoint: routeResponse.route[routeResponse.route.length - 1]
        });
        // Store this as a separate route for the overall trip visualization
        setOverallTripRoute(routeResponse.route);
      } else {
        // Fallback to generated path if API fails
        logger.warn('Google Directions API failed for overall trip or returned empty route, using fallback path');
        const curvedPath = routingService.generateCurvedPath(pickupPos, destPos, 50);
        logger.debug('Generated fallback overall trip path', { pointCount: curvedPath.length });
        setOverallTripRoute(curvedPath);
      }
    } catch (error) {
      console.error('❌ Error fetching overall trip route:', error);
      // Fallback to generated path
      const routingService = RoutingService.getInstance();
      const curvedPath = routingService.generateCurvedPath(pickupPos, destPos, 50);
      logger.debug('Generated fallback overall trip path', { pointCount: curvedPath.length });
      setOverallTripRoute(curvedPath);
    }
  };

  // Function to get the appropriate driver icon based on vehicle type
  const getDriverIcon = () => {
    const vehicleType = driverInfo?.vehicleType?.toLowerCase() || '';
    const vehicleModel = driverInfo?.vehicleModel?.toLowerCase() || '';
    
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

  const getStatusText = () => {
    switch (rideStatus) {
      case 'in_progress':
        return 'Heading to destination';
      case 'completed':
        return 'Ride completed';
      case 'cancelled':
        return 'Ride cancelled';
      default:
        return 'Ride in progress';
    }
  };

  const getProgressPercentage = () => {
    // Calculate progress based on distance covered
    if (driverPath.length < 2) return 0;
    
    const totalDistance = calculateTotalDistance();
    const coveredDistance = calculateCoveredDistance();
    
    if (totalDistance === 0) return 0;
    
    const percentage = Math.min(95, (coveredDistance / totalDistance) * 100);
    return Math.round(percentage);
  };

  const calculateTotalDistance = () => {
    if (!origin || !destination) return 0;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = origin.latitude * Math.PI / 180;
    const φ2 = destination.latitude * Math.PI / 180;
    const Δφ = (destination.latitude - origin.latitude) * Math.PI / 180;
    const Δλ = (destination.longitude - origin.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const calculateCoveredDistance = () => {
    if (driverPath.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < driverPath.length; i++) {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = driverPath[i-1].latitude * Math.PI / 180;
      const φ2 = driverPath[i].latitude * Math.PI / 180;
      const Δφ = (driverPath[i].latitude - driverPath[i-1].latitude) * Math.PI / 180;
      const Δλ = (driverPath[i].longitude - driverPath[i-1].longitude) * Math.PI / 180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      totalDistance += R * c;
    }
    
    return totalDistance;
  };

  const handleChat = () => {
    logger.debug('Navigating to Chat', { 
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
    const phoneToCall = driverInfo?.phone;
    if (phoneToCall) {
      logger.info('Calling driver', { phone: phoneToCall });
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

  const onShareTrip = async () => {
    try {
      await Share.share({
        message: 'Check out my trip details! [Add trip info or link here]',
      });
    } catch (error: any) {
      alert('Error sharing: ' + (error?.message || error?.toString() || 'Unknown error'));
    }
  };

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
            latitude: driverLocation?.latitude || destination?.latitude || 17.4448,
            longitude: driverLocation?.longitude || destination?.longitude || 78.3498,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          region={driverLocation ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : {
            latitude: destination?.latitude || 17.4448,
            longitude: destination?.longitude || 78.3498,
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
            logger.debug('Map is ready');
            // If we have driver location, center the map on it
            if (driverLocation) {
              logger.debug('Centering map on driver location', driverLocation);
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
          {/* Route from driver to destination - actual road path (Black) */}
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
          
          {/* Driver's traveled path (polyline) - Green */}
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
          
          {/* Overall trip route from pickup to destination - real road path (Black) */}
          {overallTripRoute.length > 0 && (
            <Polyline
              coordinates={overallTripRoute}
              strokeColor="#000000"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
          )}
          
          {/* Animated driver marker */}
          {animatedDriverLocation && (
            <Marker 
              coordinate={animatedDriverLocation}
              title="Driver"
              onPress={() => {
                logger.debug('Driver marker pressed', animatedDriverLocation);
              }}
            >
              <Animated.View style={[styles.driverMarker, animatedDriverStyle]}>
                <Image 
                  source={
                    driverInfo?.vehicleType?.toLowerCase().includes('auto') || 
                    driverInfo?.vehicleModel?.toLowerCase().includes('auto') 
                      ? Images.RICKSHAW 
                      : driverInfo?.vehicleType?.toLowerCase().includes('scooter') || 
                        driverInfo?.vehicleType?.toLowerCase().includes('bike') ||
                        driverInfo?.vehicleModel?.toLowerCase().includes('scooter') || 
                        driverInfo?.vehicleModel?.toLowerCase().includes('bike')
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
          
          {/* Destination marker */}
          {destination && destination.latitude && destination.longitude && (
            <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title="Destination" pinColor={Colors.coral} />
          )}
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
              🛣️ Route Path: {routePath.length} points
            </Text>
            <Text style={styles.debugText}>
              🛣️ Overall Trip: {overallTripRoute.length} points
            </Text>
            <Text style={styles.debugText}>
              ⏰ Last Update: {lastLocationUpdate?.toLocaleTimeString() || 'Never'}
            </Text>
          </View>
        )}
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusContent}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
            <Text style={styles.etaText}>{currentETA} remaining</Text>
          </View>
          <View style={styles.statusRight}>
            <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
              <Ionicons name="chatbubble" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleSOS}>
              <Ionicons name="warning" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
          </View>
          <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
        </View>
      </View>

      {/* Trip Card */}
      <View style={styles.tripCard}>
        <View style={styles.routeInfo}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeAddress}>{origin?.name || 'Your location'}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routePoint}>
            <View style={styles.destinationDot} />
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress}>{destination?.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tripActions}>
          <TouchableOpacity style={styles.shareButton} onPress={onShareTrip}>
            <Ionicons name="share" size={16} color={Colors.primary} />
            <Text style={styles.shareText}>Share Trip</Text>
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
            <Text style={styles.modalDriverName}>{driverInfo?.name || 'Pilot'}</Text>
            <Text style={styles.modalPhone}>{driverInfo?.phone || 'No phone number'}</Text>
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
    backgroundColor: '#f8f9fa',
  },
  mapContainer: {
    flex: 1,
  },
  statusBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLeft: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  etaText: {
    fontSize: 14,
    color: '#666',
  },
  statusRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tripCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeInfo: {
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    marginRight: 12,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF5A5F',
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 5,
    marginBottom: 16,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 12,
    color: '#666',
  },
  tripActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
  },
  shareText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDriverName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  debugOverlay: {
    position: 'absolute',
    top: 100, // Adjust as needed
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
  driverMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 