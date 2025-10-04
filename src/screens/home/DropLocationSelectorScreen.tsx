import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Keyboard, KeyboardAvoidingView, Platform, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { Modal as RNModal } from 'react-native';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as Location from 'expo-location';
import { HYDERABAD_POPULAR_PLACES, getCategoryIcon, getCategoryColor } from '../../constants/HyderabadPopularPlaces';
import CategorizedLocationList from '../../components/common/CategorizedLocationList';
import { logger } from '../../utils/logger';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function isValidLocation(loc: any) {
  return (
    loc &&
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number'
  );
}

// Enhanced location validation with detailed error messages
function validateLocationForRebook(location: any, locationType: 'pickup' | 'dropoff'): { isValid: boolean; error?: string } {
  if (!location) {
    return { isValid: false, error: `${locationType === 'pickup' ? 'Pickup' : 'Dropoff'} location is missing.` };
  }
  
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return { isValid: false, error: `${locationType === 'pickup' ? 'Pickup' : 'Dropoff'} location coordinates are invalid.` };
  }
  
  if (location.latitude === 0 && location.longitude === 0) {
    return { isValid: false, error: `${locationType === 'pickup' ? 'Pickup' : 'Dropoff'} location coordinates are not set.` };
  }
  
  return { isValid: true };
}

// Helper: Default location (Hyderabad)
// const DEFAULT_LOCATION = {
//   latitude: 17.4448,
//   longitude: 78.3498,
//   address: 'Default Current Location',
//   name: 'Current Location',
// };

export default function DropLocationSelectorScreen({ navigation, route }: any) {
  const [dropLocation, setDropLocation] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [editing, setEditing] = useState<'drop' | 'current' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocationQuery, setCurrentLocationQuery] = useState('');
  const [dropLocationQuery, setDropLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedLocations, setSavedLocations] = useState<{ home?: any; work?: any; custom?: any[] }>({});
  const isFocused = useIsFocused();
  const [fadeAnim] = useState(new Animated.Value(0));
  const autoProceedHandled = useRef(false);
  const [forWhom, setForWhom] = useState<'me' | 'friend'>('me');
  const [showForWhomModal, setShowForWhomModal] = useState(false);
  const [friendName] = useState('');
  const [friendPhone] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const dropInputRef = useRef<TextInput>(null);
  const currentInputRef = useRef<TextInput>(null);

  // Fetch actual current location on component mount
  useEffect(() => {
    const fetchCurrentLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          logger.debug('Location permission denied');
          return;
        }
        
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        });
        
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          address: 'Current Location',
          name: 'Current Location',
        };
        
        // Reverse geocode to get actual address
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.coords.latitude},${loc.coords.longitude}&key=${Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
          );
          const data = await response.json();
          if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            coords.address = result.formatted_address;
            
            // Extract location name from address components
            const locality = result.address_components?.find((comp: any) =>
              comp.types.includes('locality') || comp.types.includes('sublocality')
            );
            if (locality) {
              coords.name = locality.long_name;
            } else {
              coords.name = result.formatted_address.split(',')[0];
            }
          }
        } catch (geocodeError) {
          logger.debug('Failed to reverse geocode current location, using fallback:', geocodeError);
        }
        
        setCurrentLocation(coords);
        logger.debug('Current location fetched:', coords);
      } catch (error) {
        logger.debug('Error fetching current location:', error);
        // Don't set current location if there's an error
      }
    };

    fetchCurrentLocation();
  }, []);

    // Function to get current location reliably
  const getCurrentLocationReliably = async (): Promise<any> => {
    setIsGettingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }
      
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });
      
      // Reverse geocode to get actual address
      let currentAddress = 'Current Location';
      let currentName = 'Current Location';
      
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.coords.latitude},${loc.coords.longitude}&key=${Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.results.length > 0) {
          const result = data.results[0];
          currentAddress = result.formatted_address;
          
          // Extract location name from address components
          const locality = result.address_components?.find((comp: any) =>
            comp.types.includes('locality') || comp.types.includes('sublocality')
          );
          if (locality) {
            currentName = locality.long_name;
          } else {
            currentName = result.formatted_address.split(',')[0];
          }
        }
      } catch (geocodeError) {
        logger.debug('Failed to reverse geocode current location, using fallback:', geocodeError);
      }
      
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: currentAddress,
        name: currentName,
      };
    } catch (error) {
      logger.debug('Error getting current location:', error);
      // Return fallback location
      return {
        latitude: 17.4448, // Fallback to static Hyderabad
        longitude: 78.3498,
        address: 'Hyderabad, Telangana, India',
        name: 'Hyderabad',
      };
    } finally {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => {
    if (route.params?.pickup) {
      setCurrentLocation(route.params.pickup);
      if (editing === 'current') {
        setCurrentLocationQuery(route.params.pickup.address || route.params.pickup.name || '');
        setSearchQuery(route.params.pickup.address || route.params.pickup.name || '');
      }
    }
    if (route.params?.destination || route.params?.drop) {
      const dropParam = route.params?.destination || route.params?.drop;
      setDropLocation(dropParam);
      if (editing === 'drop') {
        setDropLocationQuery(dropParam.address || dropParam.name || '');
        setSearchQuery(dropParam.address || dropParam.name || '');
      }
      // Always auto-proceed to RideOptions if destination is set from map (but not when editing drop)
      if (!autoProceedHandled.current && route.params?.type !== 'pickup' && route.params?.type !== 'drop') {
        autoProceedHandled.current = true;
        setTimeout(async () => {
          // For rebook scenarios or when editing drop, use the provided pickup location instead of current location
          let pickupLocation = (route.params?.isRebook || route.params?.type === 'drop') && route.params?.pickup 
            ? route.params.pickup 
            : (isValidLocation(currentLocation) ? currentLocation : null);
          
          // If we don't have a valid pickup location and it's not a rebook or drop edit, try to get current location
          if (!pickupLocation && !route.params?.isRebook && route.params?.type !== 'drop') {
            pickupLocation = await getCurrentLocationReliably();
          }
          
          // If still no pickup location, use fallback
          if (!pickupLocation) {
            pickupLocation = {
              latitude: 17.4448, // Fallback to static Hyderabad if dynamic fails
              longitude: 78.3498,
              address: 'Hyderabad, Telangana, India',
              name: 'Hyderabad',
            };
          }
          
          // Enhanced validation for rebook scenarios
          const pickupValidation = validateLocationForRebook(pickupLocation, 'pickup');
          const dropoffValidation = validateLocationForRebook(dropParam, 'dropoff');
          
          if (!pickupValidation.isValid) {
            Alert.alert(
              'Location Error', 
              pickupValidation.error || 'Pickup location is not available. Please try again.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Retry', 
                  onPress: async () => {
                    const newLocation = await getCurrentLocationReliably();
                    if (newLocation && validateLocationForRebook(newLocation, 'pickup').isValid) {
                      navigation.navigate('RideOptions', {
                        pickup: newLocation,
                        drop: route.params.destination,
                        forWhom,
                        friendName,
                        friendPhone,
                      });
                    } else {
                      Alert.alert('Error', 'Still unable to get your location. Please try again later.');
                    }
                  }
                }
              ]
            );
            return;
          }
          
          if (!dropoffValidation.isValid) {
            Alert.alert(
              'Location Error', 
              dropoffValidation.error || 'Dropoff location is not available. Please try again.',
              [{ text: 'OK' }]
            );
            return;
          }
          
          navigation.navigate('RideOptions', {
            pickup: pickupLocation,
            drop: dropParam,
            forWhom,
            friendName,
            friendPhone,
          });
        }, 300);
      }
    } else {
      autoProceedHandled.current = false;
    }
  }, [route.params?.pickup, route.params?.destination, route.params?.drop, currentLocation, forWhom, friendName, friendPhone]);

  useEffect(() => {
    if ((editing === 'drop' || editing === 'current') && searchQuery.length > 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, editing]);

  useEffect(() => {
    logger.debug('dropLocation changed:', dropLocation);
  }, [dropLocation]);

  useEffect(() => {
    if (!currentLocation) {
      setCurrentLocation({
        latitude: 17.4448, // Fallback to static Hyderabad if dynamic fails
        longitude: 78.3498,
        address: 'Hyderabad, Telangana, India',
        name: 'Hyderabad',
      });
    }
  }, [currentLocation]);

  useEffect(() => {
    // Load saved locations from AsyncStorage every time screen is focused
    const loadSavedLocations = async () => {
      try {
        const data = await AsyncStorage.getItem('@saved_locations');
        if (data) {
          setSavedLocations(JSON.parse(data));
        } else {
          setSavedLocations({});
        }
      } catch (e) {
        setSavedLocations({});
      }
    };
    if (isFocused) {
      loadSavedLocations();
    }
  }, [isFocused]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle route params for auto-focusing fields
  useEffect(() => {
    logger.debug('🔍 DropLocationSelectorScreen - Route params:', route.params);
    logger.debug('🔍 DropLocationSelectorScreen - Type:', route.params?.type);
    
    if (route.params?.focusDestination) {
      // Set editing to 'drop' to trigger focus on destination field
      setEditing('drop');
      setDropLocationQuery(dropLocation?.address || dropLocation?.name || '');
      setSearchQuery(dropLocation?.address || dropLocation?.name || '');
      logger.debug('📍 Focused on destination field');
    } else if (route.params?.type === 'pickup') {
      // Set editing to 'current' to trigger focus on current location field
      setEditing('current');
      setCurrentLocationQuery(''); // Clear only the current location field
      setSearchQuery(''); // Clear search query for current location
      logger.debug('📍 Focused on current location field for pickup editing');
    } else if (route.params?.type === 'drop') {
      // Set editing to 'drop' to trigger focus on destination field
      setEditing('drop');
      setDropLocationQuery(''); // Clear the query to allow fresh input
      setSearchQuery(''); // Clear the search query too
      logger.debug('📍 Focused on destination field for drop editing');
    }
  }, [route.params?.focusDestination, route.params?.type, route.params?.drop, dropLocation, currentLocation]);

  // Focus the drop input when editing state changes to 'drop'
  useEffect(() => {
    logger.debug('🔍 Focus useEffect - editing state:', editing);
    if (editing === 'drop') {
      logger.debug('🎯 Attempting to focus drop input');
      // More aggressive focus attempts
      const focusAttempts = [50, 100, 200, 400, 600];
      focusAttempts.forEach((delay, index) => {
        setTimeout(() => {
          if (dropInputRef.current) {
            try {
              dropInputRef.current.focus();
              logger.debug(`✅ Drop input focused successfully (attempt ${index + 1})`);
            } catch (error) {
              logger.debug(`❌ Drop input focus error (attempt ${index + 1}):`, error);
            }
          } else {
            logger.debug(`❌ Drop input ref is null (attempt ${index + 1})`);
          }
        }, delay);
      });
    } else if (editing === 'current') {
      logger.debug('🎯 Attempting to focus current input');
      // More aggressive focus attempts
      const focusAttempts = [50, 100, 200, 400, 600];
      focusAttempts.forEach((delay, index) => {
        setTimeout(() => {
          if (currentInputRef.current) {
            try {
              currentInputRef.current.focus();
              logger.debug(`✅ Current input focused successfully (attempt ${index + 1})`);
            } catch (error) {
              logger.debug(`❌ Current input focus error (attempt ${index + 1}):`, error);
            }
          } else {
            logger.debug(`❌ Current input ref is null (attempt ${index + 1})`);
          }
        }, delay);
      });
    }
  }, [editing]);

  // Helper function to check if location is in Hyderabad area
  const isInHyderabadArea = (lat: number, lng: number) => {
    // Hyderabad approximate bounds: 17.2 to 17.6 latitude, 78.2 to 78.7 longitude
    return lat >= 17.2 && lat <= 17.6 && lng >= 78.2 && lng <= 78.7;
  };

  // Helper function to search saved locations
  const getSavedLocationMatches = (query: string) => {
    const lowercaseQuery = query.toLowerCase();
    const matches: any[] = [];
    
    // Search in home location
    if (savedLocations.home) {
      const home = savedLocations.home;
      if (
        home.name?.toLowerCase().includes(lowercaseQuery) ||
        home.address?.toLowerCase().includes(lowercaseQuery)
      ) {
        matches.push({
          place_id: 'saved_home',
          description: home.address,
          structured_formatting: {
            main_text: 'Home',
            secondary_text: home.address
          },
          latitude: home.latitude,
          longitude: home.longitude,
          address: home.address,
          name: 'Home',
          isSaved: true,
          savedType: 'home'
        });
      }
    }
    
    // Search in work location
    if (savedLocations.work) {
      const work = savedLocations.work;
      if (
        work.name?.toLowerCase().includes(lowercaseQuery) ||
        work.address?.toLowerCase().includes(lowercaseQuery)
      ) {
        matches.push({
          place_id: 'saved_work',
          description: work.address,
          structured_formatting: {
            main_text: 'Work',
            secondary_text: work.address
          },
          latitude: work.latitude,
          longitude: work.longitude,
          address: work.address,
          name: 'Work',
          isSaved: true,
          savedType: 'work'
        });
      }
    }
    
    // Search in custom locations
    if (savedLocations.custom && Array.isArray(savedLocations.custom)) {
      savedLocations.custom.forEach((loc, index) => {
        if (
          loc.name?.toLowerCase().includes(lowercaseQuery) ||
          loc.address?.toLowerCase().includes(lowercaseQuery)
        ) {
          matches.push({
            place_id: `saved_custom_${index}`,
            description: loc.address,
            structured_formatting: {
              main_text: loc.name || 'Custom Location',
              secondary_text: loc.address
            },
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address,
            name: loc.name || 'Custom Location',
            isSaved: true,
            savedType: 'custom'
          });
        }
      });
    }
    
    return matches;
  };

  const searchPlaces = async (query: string) => {
    if (query.length < 3) return;
    try {
      let location = '17.3850,78.4867'; // Hyderabad coordinates
      const radius = 30000; // 30km radius around Hyderabad
      
      logger.debug('🔍 Searching places for:', query);
      logger.debug('🔑 Using API key:', GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing');
      
      // First, search in saved locations
      const savedMatches = getSavedLocationMatches(query);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&location=${location}&radius=${radius}&components=country:in&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      logger.debug('📡 Places API response:', data.status, data.error_message || 'No error');
      
      if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
        logger.debug('✅ Found', data.predictions.length, 'places');
        // Fetch coordinates for each result and filter for Hyderabad area
        const resultsWithCoords = await Promise.all(
          data.predictions.slice(0, 10).map(async (prediction: any) => {
            try {
              const details = await getPlaceDetails(prediction.place_id);
              if (details && details.geometry) {
                const lat = details.geometry.location.lat;
                const lng = details.geometry.location.lng;
                
                // Only include results within Hyderabad area
                if (isInHyderabadArea(lat, lng)) {
                return {
                  ...prediction,
                    latitude: lat,
                    longitude: lng,
                  address: details.formatted_address
                };
              }
              }
              return null;
            } catch (error) {
              logger.debug('Failed to get details for:', prediction.place_id);
              return null;
            }
          })
        );
        
        // Filter out null results and combine with saved locations
        const validResults = resultsWithCoords.filter(result => result !== null);
        const combinedResults = [...savedMatches, ...validResults];
        setSearchResults(combinedResults);
      } else if (data.status === 'REQUEST_DENIED') {
        console.error('❌ Places API access denied:', data.error_message);
        // Fallback to basic search
        await searchPlacesFallback(query);
      } else if (data.status === 'ZERO_RESULTS') {
        logger.debug('📭 No results found');
        // Still show saved location matches if any
        setSearchResults(savedMatches);
      } else {
        console.error('❌ Places API error:', data.status, data.error_message);
        // Still show saved location matches if any
        setSearchResults(savedMatches);
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      // Still show saved location matches if any
      const savedMatches = getSavedLocationMatches(query);
      setSearchResults(savedMatches);
    }
  };

  // Fallback search using Geocoding API
  const searchPlacesFallback = async (query: string) => {
    try {
      logger.debug('🔄 Using fallback geocoding search');
      const savedMatches = getSavedLocationMatches(query);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:in|administrative_area:Telangana&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const fallbackResults = data.results
          .filter((result: any) => {
            const lat = result.geometry.location.lat;
            const lng = result.geometry.location.lng;
            return isInHyderabadArea(lat, lng);
          })
          .slice(0, 5)
          .map((result: any) => ({
          place_id: result.place_id,
          description: result.formatted_address,
          structured_formatting: {
            main_text: result.formatted_address.split(',')[0],
            secondary_text: result.formatted_address.split(',').slice(1).join(',').trim()
          },
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address
        }));
        // Combine saved locations with fallback results
        const combinedResults = [...savedMatches, ...fallbackResults];
        setSearchResults(combinedResults);
      } else {
        // Try offline fallback
        await searchPlacesOffline(query);
      }
    } catch (error) {
      console.error('❌ Fallback search failed:', error);
      // Try offline fallback
      await searchPlacesOffline(query);
    }
  };

  // Enhanced offline fallback with Hyderabad-specific locations
  const searchPlacesOffline = async (query: string) => {
    logger.debug('📱 Using enhanced offline fallback search');
    
    const lowercaseQuery = query.toLowerCase();
    const savedMatches = getSavedLocationMatches(query);
    
    // First, search in our popular places data
    const popularMatches = HYDERABAD_POPULAR_PLACES.filter(place =>
      place.name.toLowerCase().includes(lowercaseQuery) ||
      place.address.toLowerCase().includes(lowercaseQuery) ||
      place.subcategory?.toLowerCase().includes(lowercaseQuery) ||
      place.description?.toLowerCase().includes(lowercaseQuery)
    );
    
    // If we found matches in popular places, use those
    if (popularMatches.length > 0) {
      const offlineResults = popularMatches.slice(0, 8).map((place, index) => ({
        place_id: `offline_popular_${index}`,
        description: place.address,
        structured_formatting: {
          main_text: place.name,
          secondary_text: place.subcategory || place.address.split(',')[1]?.trim() || ''
        },
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
        category: place.category,
        subcategory: place.subcategory
      }));
      // Combine saved locations with popular places
      const combinedResults = [...savedMatches, ...offlineResults];
      setSearchResults(combinedResults);
      return;
    }
    
    // Only show saved location matches if no Hyderabad popular places found
    setSearchResults(savedMatches);
  };

  const getPlaceDetails = async (placeId: string) => {
    try {
      logger.debug('🔍 Getting place details for:', placeId);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      logger.debug('📡 Place details response:', data.status, data.error_message || 'No error');
      
      if (data.status === 'OK' && data.result) {
        logger.debug('✅ Place details retrieved successfully');
        return data.result;
      } else if (data.status === 'REQUEST_DENIED') {
        console.error('❌ Place details API access denied:', data.error_message);
        return null;
      } else {
        console.error('❌ Place details API error:', data.status, data.error_message);
        return null;
      }
    } catch (error) {
      console.error('❌ Place details network error:', error);
      return null;
    }
  };

  const handleLocationSelect = async (item: any, autoProceed: boolean = false) => {
    let location;
    
    // If user selects 'Current Location' as pickup
    if (editing === 'current' && (item.name === 'Current Location' || item.address === 'Current Location')) {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCurrentLocationQuery(item.address || item.name || 'Current Location'); // Ensure the text stays
      setSearchQuery(item.address || item.name || 'Current Location'); // Ensure the text stays
      // Instead of setting pickup immediately, navigate to DropPinLocationScreen for confirmation
      navigation.navigate('DropPinLocation', {
        mode: 'pickup',
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
      return;
    }
    // Handle saved locations and offline results (they already have coordinates)
    if (item.place_id && (item.place_id.startsWith('offline_') || item.place_id.startsWith('saved_'))) {
      location = {
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
        name: item.structured_formatting?.main_text || item.description,
      };
    } else if (item.place_id) {
      const placeDetails = await getPlaceDetails(item.place_id);
      if (!placeDetails) return;
      location = {
        latitude: placeDetails.geometry.location.lat,
        longitude: placeDetails.geometry.location.lng,
        address: placeDetails.formatted_address,
        name: item.structured_formatting?.main_text || item.description,
      };
    } else {
      location = item;
    }
    if (editing === 'drop' || autoProceed) {
      // For rebook scenarios or when editing drop, use the provided pickup location instead of current location
      const pickupLocation = (route.params?.isRebook || route.params?.type === 'drop') && route.params?.pickup 
        ? route.params.pickup 
        : (isValidLocation(currentLocation) ? currentLocation : {
            latitude: 17.4448, // Fallback to static Hyderabad if dynamic fails
            longitude: 78.3498,
            address: 'Hyderabad, Telangana, India',
            name: 'Hyderabad',
          });

      // Check if pickup and drop locations are the same
      if (pickupLocation && location) {
        const isSameLocation = (
          Math.abs(pickupLocation.latitude - location.latitude) < 0.0001 &&
          Math.abs(pickupLocation.longitude - location.longitude) < 0.0001
        ) || (
          pickupLocation.address && location.address &&
          pickupLocation.address.toLowerCase().trim() === location.address.toLowerCase().trim()
        );

        if (isSameLocation) {
          Alert.alert(
            'Same Location Selected',
            'Drop location and pickup location both are same. Please select a different destination.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setDropLocation(location);
      setEditing(null);
      setDropLocationQuery(location.address || location.name || '');
      setSearchQuery(location.address || location.name || '');
      setSearchResults([]);
      Keyboard.dismiss();
          
      // Enhanced validation
      const pickupValidation = validateLocationForRebook(pickupLocation, 'pickup');
      const dropoffValidation = validateLocationForRebook(location, 'dropoff');
      
      if (!pickupValidation.isValid) {
        Alert.alert(
          'Location Error', 
          pickupValidation.error || 'Pickup location is not available. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Retry', 
              onPress: async () => {
                const newLocation = await getCurrentLocationReliably();
                if (newLocation && validateLocationForRebook(newLocation, 'pickup').isValid) {
                  navigation.navigate('RideOptions', {
                    pickup: newLocation,
                    drop: location,
                    forWhom,
                    friendName,
                    friendPhone,
                  });
                } else {
                  Alert.alert('Error', 'Still unable to get your location. Please try again later.');
                }
              }
            }
          ]
        );
        return;
      }
      
      if (!dropoffValidation.isValid) {
        Alert.alert(
          'Location Error', 
          dropoffValidation.error || 'Dropoff location is not available. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
                  navigation.navigate('RideOptions', {
        pickup: pickupLocation,
        drop: location,
        forWhom,
        friendName,
        friendPhone,
      });
      return;
    } else if (editing === 'current') {
      setCurrentLocation(location);
      setCurrentLocationQuery(location.address || location.name || ''); // update input with selected value
      setSearchQuery(location.address || location.name || ''); // update search query
      // If we came here to edit only the pickup (from RideOptions), return with updated pickup only
      if (route.params?.type === 'pickup') {
        logger.debug('🔄 Navigating back to RideOptions with updated pickup:', location);
        logger.debug('📍 Original drop preserved:', route.params?.drop);
                  navigation.navigate('RideOptions', {
          pickup: location,
          drop: route.params?.drop, // Use original drop from route params, don't change it
          forWhom,
          friendName,
          friendPhone,
        });
        return;
      }
      // If editing both or just current location in normal flow, stay on screen
    }
    setEditing(null);
    setSearchResults([]);
    Keyboard.dismiss();
  };



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      {/* Loading overlay when getting location */}
      {isGettingLocation && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 24,
            alignItems: 'center',
          }}>
            <LoadingSpinner size="large" text="Getting your location..." />
          </View>
        </View>
      )}
      
      {/* Back button at the top left */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <Ionicons name="arrow-back" size={28} color={Colors.text} />
      </TouchableOpacity>
      
      
      {/* Minimalist Search Card */}
      <View style={{ marginHorizontal: 16, marginTop: 60, marginBottom: 12 }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.04)',
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'stretch',
            paddingVertical: 12,
            paddingHorizontal: 12,
          }}>
            <View style={{ alignItems: 'center', marginRight: 10, width: 16 }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#10b981',
                marginBottom: 3,
              }} />
              <View style={{ 
                width: 1.5, 
                flex: 1, 
                backgroundColor: '#E0E0E0', 
                marginVertical: 3,
              }} />
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#ef4444',
                marginTop: 3,
              }} />
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {/* Pickup Location */}
              <TouchableOpacity 
                onPress={() => { 
                  setEditing('current'); 
                  setCurrentLocationQuery(currentLocation?.address || currentLocation?.name || ''); 
                  setSearchQuery(currentLocation?.address || currentLocation?.name || ''); 
                }} 
                activeOpacity={0.7}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: editing === 'current' ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                  borderWidth: editing === 'current' ? 1 : 0,
                  borderColor: 'rgba(102, 126, 234, 0.2)',
                  marginBottom: 6,
                }}
              >
                {editing === 'current' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      ref={currentInputRef}
                      style={{ 
                        color: '#1a1a1a', 
                        fontWeight: '600', 
                        fontSize: 15, 
                        paddingVertical: 0, 
                        paddingHorizontal: 0,
                        flex: 1,
                      }}
                      value={currentLocationQuery}
                      onChangeText={(text) => {
                        setCurrentLocationQuery(text);
                        setSearchQuery(text);
                      }}
                      placeholder="Enter pickup location"
                      placeholderTextColor="#999"
                      onSubmitEditing={() => setEditing(null)}
                    />
                    {currentLocationQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentLocationQuery('');
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        style={{
                          marginLeft: 8,
                          padding: 4,
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ 
                      color: '#1a1a1a', 
                      fontWeight: '600', 
                      fontSize: 15,
                      marginBottom: 2,
                    }}>
                      {currentLocation?.address || currentLocation?.name || 'Current Location'}
                    </Text>
                    <Text style={{ 
                      color: '#10b981', 
                      fontSize: 11, 
                      fontWeight: '500',
                    }}>
                      Pickup point
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* Dropoff Location */}
              <TouchableOpacity 
                onPress={() => { 
                  setEditing('drop'); 
                  setDropLocationQuery(dropLocation?.address || dropLocation?.name || ''); 
                  setSearchQuery(dropLocation?.address || dropLocation?.name || '');
                  
                  setTimeout(() => {
                    if (dropInputRef.current) {
                      dropInputRef.current.focus();
                    }
                  }, 50);
                }} 
                activeOpacity={0.7}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: editing === 'drop' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                  borderWidth: editing === 'drop' ? 1 : 0,
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                }}
              >
                {editing === 'drop' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      ref={(ref) => {
                        dropInputRef.current = ref;
                      }}
                      style={{ 
                        color: '#1a1a1a', 
                        fontWeight: '600', 
                        fontSize: 15, 
                        paddingVertical: 0, 
                        paddingHorizontal: 0,
                        flex: 1,
                      }}
                      value={dropLocationQuery}
                      onChangeText={(text) => {
                        setDropLocationQuery(text);
                        setSearchQuery(text);
                      }}
                      placeholder="Where do you want to go?"
                      placeholderTextColor="#999"
                      returnKeyType="send"
                      autoFocus={true}
                      onSubmitEditing={() => {
                        if (dropLocation) {
                          navigation.navigate('RideOptions', {
                            pickup: currentLocation,
                            drop: dropLocation,
                            forWhom,
                            friendName,
                            friendPhone,
                          });
                        }
                      }}
                    />
                    {dropLocationQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setDropLocationQuery('');
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        style={{
                          marginLeft: 8,
                          padding: 4,
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ 
                      color: dropLocation ? '#1a1a1a' : '#999', 
                      fontWeight: '600', 
                      fontSize: 15,
                      marginBottom: 2,
                    }}>
                      {dropLocation ? (dropLocation.address || dropLocation.name) : 'Where do you want to go?'}
                    </Text>
                    <Text style={{ 
                      color: '#ef4444', 
                      fontSize: 11, 
                      fontWeight: '500',
                    }}>
                      Destination
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      
      {/* Conditional rendering based on search state */}
      {(editing === 'drop' || editing === 'current') && searchQuery.length > 2 ? (
        // Clean Search Results
        <View style={{ flex: 1, marginHorizontal: 16, paddingBottom: 100 }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
            marginBottom: 16,
          }}>
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0,0,0,0.05)',
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1a1a1a',
                textAlign: 'center',
              }}>
                Search Results ({searchResults.length})
              </Text>
            </View>
            
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => item.place_id ? item.place_id : `${item.address || ''}_${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={{ 
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: 'row', 
                    alignItems: 'center',
                    borderBottomWidth: index < searchResults.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(0,0,0,0.05)',
                    backgroundColor: '#fff',
                  }} 
                  onPress={() => handleLocationSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.place_id && item.place_id.startsWith('offline_popular_') ? (
                    <View style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 20, 
                      backgroundColor: getCategoryColor(item.category) + '15',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 18 }}>{getCategoryIcon(item.category)}</Text>
                    </View>
                  ) : item.isSaved ? (
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: item.savedType === 'home' ? 'rgba(76, 175, 80, 0.1)' : 
                                      item.savedType === 'work' ? 'rgba(255, 152, 0, 0.1)' : 
                                      'rgba(156, 39, 176, 0.1)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons 
                        name={item.savedType === 'home' ? 'home' : 
                              item.savedType === 'work' ? 'briefcase' : 'bookmark'} 
                        size={20} 
                        color={item.savedType === 'home' ? '#4CAF50' : 
                               item.savedType === 'work' ? '#FF9800' : '#9C27B0'} 
                      />
                    </View>
                  ) : (
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="location" size={20} color="#10b981" />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      fontWeight: '600', 
                      color: '#1a1a1a', 
                      fontSize: 16,
                      marginBottom: 4,
                    }}>
                      {item.structured_formatting?.main_text || item.name}
                    </Text>
                    <Text style={{ 
                      color: '#666', 
                      fontSize: 14,
                      marginBottom: 2,
                    }}>
                      {item.structured_formatting?.secondary_text || item.address}
                    </Text>
                    {item.subcategory && (
                      <View style={{
                        alignSelf: 'flex-start',
                        backgroundColor: getCategoryColor(item.category) + '10',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                        marginTop: 4,
                      }}>
                        <Text style={{ 
                          color: getCategoryColor(item.category), 
                          fontSize: 11, 
                          fontWeight: '600',
                        }}>
                          {item.subcategory}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      ) : (
        // Show categorized popular places and saved locations
        <View style={{ flex: 1, paddingBottom: 100 }}>
          <CategorizedLocationList
            onLocationSelect={(location) => handleLocationSelect(location)}
            showAllCategories={true}
            maxItemsPerCategory={4}
          />
        </View>
      )}
       {/* Clean Set location on map button */}
       <View style={{ 
         position: 'absolute', 
         left: 0, 
         right: 0, 
         bottom: 0, 
         backgroundColor: '#fff', 
         paddingBottom: 8, 
         paddingTop: 12, 
         alignItems: 'center', 
         borderTopWidth: 1, 
         borderTopColor: 'rgba(0,0,0,0.05)', 
         zIndex: 100,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: -4 },
         shadowOpacity: 0.1,
         shadowRadius: 8,
         elevation: 4,
       }}>
         <TouchableOpacity
           style={{ 
             flexDirection: 'row', 
             alignItems: 'center', 
             paddingHorizontal: 20, 
             paddingVertical: 16, 
             width: '90%', 
             borderRadius: 16, 
             justifyContent: 'center',
             backgroundColor: '#23235B',
             shadowColor: '#23235B',
             shadowOffset: { width: 0, height: 4 },
             shadowOpacity: 0.2,
             shadowRadius: 8,
             elevation: 4,
           }}
           onPress={() => {
             if (editing === 'current') {
               navigation.navigate('DropPinLocation', { mode: 'pickup' });
             } else if (editing === 'drop') {
               navigation.navigate('DropPinLocation', { mode: 'drop' });
             } else {
               navigation.navigate('DropPinLocation', { mode: 'drop' });
             }
           }}
           activeOpacity={0.8}
         >
           <Ionicons name="map" size={20} color="#fff" style={{ marginRight: 12 }} />
           <Text style={{ 
             color: '#fff', 
             fontSize: 16, 
             fontWeight: '600',
           }}>
             Set location on map
           </Text>
         </TouchableOpacity>
       </View>
      {/* For Whom Modal (unchanged) */}
      <RNModal
        visible={showForWhomModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForWhomModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Who is this ride for?</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
              onPress={() => { setForWhom('me'); setShowForWhomModal(false); }}
            >
              <Ionicons name="person" size={22} color={forWhom === 'me' ? '#23235B' : '#bbb'} style={{ marginRight: 10 }} />
              <Text style={{ fontWeight: '600', color: forWhom === 'me' ? '#23235B' : '#bbb' }}>For me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
