import React, { useRef, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import polyline from '@mapbox/polyline';
import Constants from 'expo-constants';
import { emitEvent, onRideBooked, onRideTimeout, clearCallbacks } from '../../utils/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '@clerk/clerk-expo';
import { calculateRideFare, getDistanceFromLatLonInKm } from '../../utils/helpers';
import { getUserIdFromJWT } from '../../utils/jwtDecoder';
import { Images } from '../../constants/Images';
import { rideApi, RideRequestResponse } from '../../services/rideService';
import { logger } from '../../utils/logger';

const { width, height } = Dimensions.get('window');

// Add this at the top of the file or in a declarations.d.ts file if you have one
// declare module '@mapbox/polyline';

export async function saveCompletedRide(ride: any) {
  const history = JSON.parse(await AsyncStorage.getItem('rideHistory') || '[]');
  history.unshift(ride); // Add new ride to the top
  await AsyncStorage.setItem('rideHistory', JSON.stringify(history));
}

export default function RideOptionsScreen({ navigation, route }: any) {
  // Use pickup and drop as state so they can be updated when route params change
  const [pickup, setPickup] = useState(route.params?.pickup || null);
  const [drop, setDrop] = useState(route.params?.drop || null);

  // Update all state when route params change (e.g., when returning from editing)
  useEffect(() => {
    if (route.params?.pickup) {
      setPickup(route.params.pickup);
      logger.debug('📍 Pickup updated from route params:', route.params.pickup);
    }
    if (route.params?.drop) {
      setDrop(route.params.drop);
      logger.debug('📍 Drop updated from route params:', route.params.drop);
    }
  }, [route.params]);

  // Debug: Log current state
  useEffect(() => {
    logger.debug('🔍 RideOptionsScreen - Current state:');
    logger.debug('   - Pickup:', pickup);
    logger.debug('   - Drop:', drop);
    logger.debug('   - Route params:', route.params);
  }, [pickup, drop, route.params]);
  const [selected, setSelected] = useState('bike');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const [rideOptions, setRideOptions] = useState<any[]>([]);


  // Calculate real ride options based on distance and duration
  useEffect(() => {
    logger.debug('🔍 RideOptions - Pickup coordinates:', pickup);
    logger.debug('🔍 RideOptions - Drop coordinates:', drop);
    logger.debug('🔍 RideOptions - Valid pickup?', pickup && pickup.latitude && pickup.longitude);
    logger.debug('🔍 RideOptions - Valid drop?', drop && drop.latitude && drop.longitude);
    
    if (pickup && drop && pickup.latitude && pickup.longitude && drop.latitude && drop.longitude) {
      const distanceKm = getDistanceFromLatLonInKm(
        pickup.latitude,
        pickup.longitude,
        drop.latitude,
        drop.longitude
      );
      
      // Estimate duration based on average speed (25 km/h for bikes)
      const durationMinutes = Math.round((distanceKm / 25) * 60);
      
      // Generate ride options with real calculations
      const options = [
        {
          id: 'bike',
          icon: 'motorbike' as any,
          label: 'Bike',
          eta: '2 mins',
          dropTime: `Drop ${new Date(Date.now() + (durationMinutes + 2) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          tag: 'FASTEST',
          tagColor: '#22c55e',
          ...calculateRideFare(distanceKm, durationMinutes, 'bike')
        },
        {
          id: 'scooty',
          icon: 'scooter' as any,
          label: 'Electric Scooty',
          eta: '3 mins',
          dropTime: `Drop ${new Date(Date.now() + (durationMinutes + 3) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          tag: 'NEW',
          tagColor: '#3b82f6',
          ...calculateRideFare(distanceKm, durationMinutes, 'scooty')
        },
        {
          id: 'auto',
          icon: 'car' as any,
          label: 'Auto',
          eta: '4 mins',
          dropTime: `Drop ${new Date(Date.now() + (durationMinutes + 4) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          tag: 'COMFORT',
          tagColor: '#f59e0b',
          ...calculateRideFare(distanceKm, durationMinutes, 'auto')
        },
      ];
      
      setRideOptions(options);
      logger.debug('✅ Calculated ride options:', options);
    } else {
      logger.debug('❌ Cannot calculate ride options - missing valid coordinates');
      logger.debug('   - Pickup valid:', pickup && pickup.latitude && pickup.longitude);
      logger.debug('   - Drop valid:', drop && drop.latitude && drop.longitude);
    }
  }, [pickup, drop]);


  const mapRef = useRef<MapView>(null);
  const [routeCoords, setRouteCoords] = useState([]);
  
  // Dynamic mock vehicles based on pickup location
  const mockVehicles = useMemo(() => {
    if (!pickup || !pickup.latitude || !pickup.longitude) {
      return [];
    }
    
    // Generate vehicles around the pickup location
    return [
      { id: 1, latitude: pickup.latitude + 0.001, longitude: pickup.longitude + 0.001, heading: 45 },
      { id: 2, latitude: pickup.latitude - 0.001, longitude: pickup.longitude + 0.002, heading: 90 },
      { id: 3, latitude: pickup.latitude + 0.002, longitude: pickup.longitude - 0.001, heading: 120 },
      { id: 4, latitude: pickup.latitude - 0.002, longitude: pickup.longitude - 0.002, heading: 200 },
      { id: 5, latitude: pickup.latitude + 0.0015, longitude: pickup.longitude - 0.0015, heading: 300 },
    ];
  }, [pickup]);

  // Animated vehicle marker (rotation)
  const animatedMarkers = mockVehicles.map((v) => {
    const rotation = useSharedValue(v.heading);
    useEffect(() => {
      rotation.value = withTiming((v.heading + Math.random() * 30) % 360, { duration: 2000 });
    }, []);
    const style = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));
    return { ...v, style };
  });

  // Handlers
  
  const handleBook = async () => {
    // Prevent multiple bookings
    if (isBooking) {
      logger.debug('🚫 Booking already in progress, ignoring duplicate request');
      return;
    }

    // Validate required data
    if (!drop) {
      Alert.alert('Select Destination', 'Please select a destination first.');
      return;
    }


    setIsBooking(true);
    setBookingError(null);
    
    try {
      logger.debug('🚗 === STARTING RIDE BOOKING PROCESS ===');
      logger.debug('🔍 === DETAILED BOOKING FLOW LOG ===');
      
      // Get the selected ride option details
      const selectedRide = rideOptions.find(o => o.id === selected);
      if (!selectedRide) {
        throw new Error('No ride option selected');
      }

      // Do NOT fetch or overwrite pickup with current location here
      // Use the existing pickup value from state (which may be pinned or current location)
      
      // Safely update map region if mapRef is ready and coordinates are valid
      if (
        mapRef.current &&
        pickup &&
        typeof pickup.latitude === 'number' &&
        typeof pickup.longitude === 'number'
      ) {
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: pickup.latitude,
              longitude: pickup.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }, 500);
          }
        }, 500);
      }
      
      logger.debug('📤 Step 1: Preparing ride request data...');
      logger.debug('📍 Pickup:', pickup);
      logger.debug('🎯 Drop:', drop);
      
      // Step 1: Prepare ride request data
      const rideRequest = {
        pickup,
        drop: {
          id: drop.id || '1',
          name: drop.name || drop.address || 'Drop Location',
          address: drop.address || drop.name || 'Drop Location',
          latitude: drop.latitude,
          longitude: drop.longitude,
          type: drop.type || 'recent',
        },
        rideType: selectedRide?.label,
        price: selectedRide?.totalFare,
        userId: await getUserIdFromJWT(getToken), // Use JWT user ID for consistency
      };
      
      logger.debug('🚗 Ride request data prepared:', rideRequest);

      // Step 2: Call API endpoint first
      logger.debug('🌐 === CALLING API ENDPOINT FIRST ===');
      logger.debug('🎯 Step 2: Converting to API payload...');
      const apiPayload = rideApi.convertToApiPayload(rideRequest);
      logger.debug('📦 API Payload:', apiPayload);
      
      logger.debug('🚀 Step 3: Making API call to /api/rides/request...');
      const apiResponse: RideRequestResponse = await rideApi.requestRide(apiPayload, getToken as () => Promise<string>);
      logger.debug('✅ API Response received:', apiResponse);
      logger.debug('📊 API Response Details:');
      logger.debug('   - Ride ID:', apiResponse.id);
      logger.debug('   - Status:', apiResponse.status);
      logger.debug('   - Estimated Fare:', apiResponse.estimatedFare);
      logger.debug('   - Requested At:', apiResponse.requestedAt);
      
      // Step 3: Send Socket.IO event with API response data
      logger.debug('🔌 === SENDING SOCKET.IO EVENT WITH API DATA ===');
      const socketRideRequest = {
        ...rideRequest,
        rideId: apiResponse.id, // Use the ride ID from API response
        estimatedFare: apiResponse.estimatedFare,
        status: apiResponse.status,
      };
      
      logger.debug('🔌 Socket ride request:', socketRideRequest);
      logger.debug('📤 Attempting to emit event: request_ride');
      const success = emitEvent('request_ride', socketRideRequest);
      
      if (!success) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      logger.debug('✅ Socket.IO event sent successfully');
      logger.debug('🎉 === RIDE BOOKING COMPLETED SUCCESSFULLY ===');
      logger.debug('📋 Final Ride Details:');
      logger.debug('   - Ride ID:', apiResponse.id);
      logger.debug('   - Estimated Fare: ₹', apiResponse.estimatedFare.toFixed(2));
      logger.debug('   - Status:', apiResponse.status);
      logger.debug('   - Pickup:', pickup);
      logger.debug('   - Drop:', drop);
      
      // Don't navigate immediately - wait for server response
      // The navigation will happen in the useEffect below when we receive 'ride_booked' event
      
    } catch (error: any) {
      console.error('❌ === RIDE BOOKING FAILED ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      setBookingError(error instanceof Error ? error.message : 'Booking failed. Please try again.');
      Alert.alert('Booking Failed', error instanceof Error ? error.message : 'Booking failed. Please try again.');
    } finally {
      // Don't reset isBooking here - let it stay true until we get server response
      // This prevents multiple button presses
    }
  };

  useEffect(() => {
    const handleRideBooked = (data: any) => {
      logger.debug('✅ Ride booked response received:', data);
      
      // Reset booking state
      setIsBooking(false);
      setBookingError(null);
      
      if (data.success) {
        logger.debug('🎉 Ride booked successfully, navigating to FindingDriver');
        logger.debug('📋 Ride details:', {
          rideId: data.rideId,
          price: data.price,
          destination: drop?.address,
          pickup: pickup?.address
        });
        
        // Navigate to FindingDriver with all necessary data
        navigation.navigate('FindingDriver', { 
          destination: {
            name: drop?.name || drop?.address || 'Destination',
            latitude: drop?.latitude,
            longitude: drop?.longitude
          },
          estimate: {
            fare: data.price,
            distance: '2.5 km',
            duration: '8 mins',
            eta: '5 mins',
          },
          paymentMethod: 'Cash',
          driver: null,
          rideId: data.rideId,
          pickup, // Pass pickup location for polyline
        });
      } else {
        console.error('❌ Ride booking failed on server:', data.message);
        setBookingError(data.message || 'Unable to book ride.');
        Alert.alert('Booking Failed', data.message || 'Unable to book ride.');
      }
    };
    
    const handleRideTimeout = (data: any) => {
      logger.debug('⏰ Ride request timed out:', data);
      setIsBooking(false);
              setBookingError('No pilots found. Please try again.');
              Alert.alert('No Pilots Found', data.message || 'No pilots were found. Please try again.');
    };
    
    
    // Set up callbacks using the proper system
    onRideBooked(handleRideBooked);
    onRideTimeout(handleRideTimeout);
    
    return () => {
      clearCallbacks();
    };
  }, [drop, navigation, pickup]);

  // Cleanup booking state when component unmounts
  useEffect(() => {
    return () => {
      setIsBooking(false);
      setBookingError(null);
    };
  }, []);

  // Fit map to route on mount
  useEffect(() => {
    logger.debug('🗺️ Fitting map to coordinates - Pickup:', pickup, 'Drop:', drop);
    if (mapRef.current && pickup && drop) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([pickup, drop], {
          edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [pickup, drop]);

  // Fetch route directions from current location to drop
  useEffect(() => {
    const fetchRouteDirections = async () => {
      if (!pickup || !drop) {
        setRouteCoords([]);
        return;
      }
      const apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${drop.latitude},${drop.longitude}&key=${apiKey}`;
      try {
        const response = await fetch(url);
        const json = await response.json();
        if (json.routes && json.routes.length) {
          const points = polyline.decode(json.routes[0].overview_polyline.points);
          const coords = points.map((point: [number, number]) => ({ latitude: point[0], longitude: point[1] }));
          setRouteCoords(coords);
        } else {
          setRouteCoords([]);
        }
      } catch (error) {
        setRouteCoords([]);
      }
    };
    fetchRouteDirections();
  }, [pickup, drop]);


  // Using pickup and drop from route.params - no need for useState

  logger.debug('rideOptions:', rideOptions);

  return (
    <View style={styles.container}>
      {/* Map Section at the Top */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={pickup && drop ? {
            latitude: (pickup.latitude + drop.latitude) / 2,
            longitude: (pickup.longitude + drop.longitude) / 2,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : {
            latitude: 20.5937, // fallback to India center
            longitude: 78.9629,
            latitudeDelta: 10,
            longitudeDelta: 10,
          }}
          showsUserLocation
        >
          {/* Render the route from current location (blue dot) to destination (red pin) */}
          {pickup && drop && routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#222"
              strokeWidth={4}
            />
          )}
          {/* Pickup Marker (green pin) */}
          {pickup && (
            <Marker coordinate={pickup} pinColor="#22c55e">
              <Ionicons name="location-sharp" size={32} color="#22c55e" />
            </Marker>
          )}
          {/* Drop Marker (red pin) */}
          {drop && (
            <Marker coordinate={drop} pinColor="#ef4444">
              <Ionicons name="location-sharp" size={32} color="#ef4444" />
            </Marker>
          )}
          {/* Animated Vehicle Markers */}
          {animatedMarkers.map((v) => (
            <Marker key={v.id} coordinate={v} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View style={v.style}>
                <Image
                  source={Images.ICON_ANIMATION_1}
                  style={{ width: 32, height: 32, resizeMode: 'contain' }}
                />
              </Animated.View>
            </Marker>
          ))}
          {/* Current Location Marker (green pin) - updates dynamically */}
          {/* Remove the green pin for the user's current GPS location. Only show the green pin for the selected pickup location. */}
        </MapView>
        {/* Chips overlay */}
        <View style={styles.chipContainer} pointerEvents="box-none">
          <View style={[styles.chip, { left: width * 0.25, top: 30 }]}> 
            <Text numberOfLines={1} style={styles.chipText}>{pickup?.address || 'Pickup Location'}</Text>
          </View>
          <View style={[styles.chip, { left: width * 0.55, top: 80 }]}> 
            <Text numberOfLines={1} style={styles.chipText}>{drop?.address || 'Destination'}</Text>
          </View>
        </View>
       
      </View>


      {/* Bottom Sheet and rest of the UI */}
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#fff' }}>
        <View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, maxHeight: height * 0.35 }}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.35 }}>
              {rideOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.rideOption,
                    selected === opt.id && styles.rideOptionSelected,
                    selected === opt.id && styles.rideOptionShadow,
                  ]}
                  onPress={() => setSelected(opt.id)}
                  activeOpacity={0.8}
                >
                  {/* Vehicle type specific icon */}
                  <Image
                    source={
                      opt.id === 'auto' ? Images.RICKSHAW :
                      opt.id === 'scooty' ? Images.SCOOTER_1 :
                      Images.ICON_ANIMATION
                    }
                    style={{ width: 32, height: 32, marginRight: 16, resizeMode: 'contain' }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
                      <Text style={styles.rideLabel}>{opt.label}</Text>
                      {/* Person icon and seat count */}
                      <Ionicons name="person" size={16} color="#222" style={{ marginLeft: 6, marginRight: 2 }} />
                      <Text style={{ fontWeight: '600', color: '#222', fontSize: 14 }}>{opt.id === 'auto' ? '3' : '1'}</Text>
                    </View>
                    {/* Subtitle */}
                    {opt.id === 'bike' && <Text style={styles.rideSubtitle}>Quick Bike rides</Text>}
                    {opt.id === 'scooty' && <Text style={styles.rideSubtitle}>Electric Scooty rides</Text>}
                    {opt.id === 'auto' && <Text style={styles.rideSubtitle}>Auto rickshaw rides</Text>}
                   
                    <Text style={styles.rideMeta}>{opt.eta} • {opt.dropTime}</Text>
                  </View>
                  {opt.tag && (
                    <View style={[styles.tag, { backgroundColor: opt.tagColor || '#fbbf24' }]}> 
                      <Text style={styles.tagText}>{opt.tag}</Text>
                    </View>
                  )}
                  <Text style={styles.ridePrice}>₹{opt.totalFare}</Text>
                  {/* Checkmark for selected */}
                  {selected === opt.id && <Ionicons name="checkmark" size={22} color="#22c55e" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16, marginTop: 8, marginBottom: 0, borderRadius: 1 }} />
          {/* Sticky Bar with Offers Button */}
          <View style={styles.stickyBar}>
            <TouchableOpacity 
              style={[styles.stickyBtn, { flex: 1, alignItems: 'center', justifyContent: 'center' }]} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Offers')}
            >
              <Ionicons name="pricetag-outline" size={22} color="#22c55e" style={{ marginRight: 8 }} />
              <Text style={[styles.stickyBtnText, { color: '#22c55e' }]}>% Offers</Text>
            </TouchableOpacity>
          </View>
          {/* Book Button - make sure this is OUTSIDE the ScrollView and stickyBar */}
          <TouchableOpacity 
            style={[
              styles.bookBtnFullGreen, 
              isBooking && styles.bookBtnDisabled
            ]} 
            onPress={handleBook} 
            activeOpacity={0.85}
            disabled={isBooking}
          >
            {isBooking ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner size="small" color="#fff" />
                <Text style={styles.bookBtnTextFullGreen}>Booking...</Text>
              </View>
            ) : (
              <Text style={styles.bookBtnTextFullGreen}>
                Book {rideOptions.find(o => o.id === selected)?.label || 'ride'}
              </Text>
            )}
          </TouchableOpacity>
          {bookingError && (
            <Text style={styles.bookingErrorText}>{bookingError}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: {
    width: '100%',
    height: '55%',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  chipContainer: { position: 'absolute', width: '100%', zIndex: 10 },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 120,
    maxWidth: 180,
  },
  chipText: { fontWeight: '600', color: '#222', flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    


    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  rideOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rideOptionSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#e7fbe9',
    shadowOpacity: 0.10,
    elevation: 2,
  },
  rideOptionShadow: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
  },
  rideLabel: { fontWeight: '700', fontSize: 16, color: '#222' },
  rideMeta: { color: '#64748b', fontSize: 13, marginTop: 1 },
  ridePrice: { fontWeight: '700', fontSize: 18, color: '#222', marginLeft: 12 },
  tag: {
    backgroundColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  tagText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 10,
    marginTop: 0,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
  },
  stickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  stickyBtnText: { fontWeight: '700', color: '#222', fontSize: 14 },
  bookBtnFullGreen: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 24,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bookBtnTextFullGreen: {
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  addStopBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    zIndex: 10,
  },
  addStopBackBtn: { padding: 4 },
  addStopText: { fontWeight: '700', color: '#222', fontSize: 15, marginLeft: 8 },
  rideSubtitle: { color: '#64748b', fontSize: 13, marginTop: 1 },
  bottomAreaWrapper: { flex: 1, justifyContent: 'flex-end' },
  bookingErrorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  bookBtnDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 
