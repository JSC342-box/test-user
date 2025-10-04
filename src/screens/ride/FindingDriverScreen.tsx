import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  BackHandler,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { 
  getSocket, 
  onRideAccepted, 
  onRideStatus, 
  clearCallbacks,
  isConnected,
  onDriverOffline,
  onRideTimeout
} from '../../utils/socket';
import ConnectionStatus from '../../components/common/ConnectionStatus';
import { useAuth } from '@clerk/clerk-expo';
import { rideService } from '../../services/rideService';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../store/NotificationContext';
import BackendNotificationService from '../../services/backendNotificationService';
import { logger } from '../../utils/logger';

const { width } = Dimensions.get('window');

function TimelineLoader({ searchTime }: { searchTime: number }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Define breakpoints (in seconds)
  const breakpoints = [
    { time: 0, label: 'Searching...' },
    { time: 30, label: 'Finding pilots' },
    { time: 60, label: 'Almost there' },
    { time: 90, label: 'Finalizing' }
  ];
  
  // Calculate current progress (0-1)
  const maxTime = 90; // 90 seconds max
  const progress = Math.min(searchTime / maxTime, 1);
  
  // Update animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  // Calculate which segments are completed and current
  const getSegmentStatus = (index: number) => {
    const segmentProgress = (index + 1) / breakpoints.length;
    if (progress >= segmentProgress) return 'completed';
    if (progress >= segmentProgress - 0.25) return 'current';
    return 'pending';
  };
  
  logger.debug('TimelineLoader rendering with searchTime:', searchTime, 'progress:', progress);
  
  return (
    <View style={styles.timelineContainer}>
      <Text style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, color: '#666' }}>
        Progress: {Math.round(progress * 100)}% ({searchTime}s)
      </Text>
      <View style={styles.segmentedProgressContainer}>
        {breakpoints.map((_, index) => {
          const status = getSegmentStatus(index);
          const segmentProgress = Math.min(Math.max((progress - (index / breakpoints.length)) * breakpoints.length, 0), 1);
          
          return (
            <View key={index} style={styles.segmentContainer}>
              <View style={styles.segmentBackground}>
                <Animated.View 
                  style={[
                    styles.segmentFill,
                    {
                      width: status === 'completed' ? '100%' : 
                             status === 'current' ? `${segmentProgress * 100}%` : '0%',
                    }
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CancelRideModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const anim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();

  const cancelReasons = [
    t('ride.cancelReasons.foundAnotherRide'),
    t('ride.cancelReasons.changedMind'),
    t('ride.cancelReasons.emergency'),
    t('ride.cancelReasons.wrongLocation'),
    t('ride.cancelReasons.priceTooHigh'),
    t('ride.cancelReasons.waitingTooLong'),
    t('ride.cancelReasons.other')
  ];

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason);
      setSelectedReason('');
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)'] }),
      justifyContent: 'center',
      alignItems: 'center',
      opacity: anim,
      zIndex: 10000,
    }}>
      <Animated.View style={{
        width: width - 40,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 16, textAlign: 'center' }}>
          {t('ride.cancelRideTitle')}
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' }}>
          {t('ride.cancelRideMessage')}
        </Text>
        
        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {cancelReasons.map((reason, index) => (
            <TouchableOpacity
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: selectedReason === reason ? '#e3f2fd' : '#f8f9fa',
                marginBottom: 8,
                borderWidth: 2,
                borderColor: selectedReason === reason ? '#1877f2' : 'transparent',
              }}
              onPress={() => setSelectedReason(reason)}
              activeOpacity={0.7}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: selectedReason === reason ? '#1877f2' : '#ccc',
                backgroundColor: selectedReason === reason ? '#1877f2' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                {selectedReason === reason && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={{
                fontSize: 15,
                color: selectedReason === reason ? '#1877f2' : '#333',
                fontWeight: selectedReason === reason ? '600' : '400',
                flex: 1,
              }}>
                {reason}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#f8f9fa',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#e0e0e0',
            }}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#666', fontWeight: '600', fontSize: 16 }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: selectedReason ? '#ff4444' : '#ccc',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
            onPress={handleConfirm}
            disabled={!selectedReason}
            activeOpacity={selectedReason ? 0.7 : 1}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function FindingDriverScreen({ navigation, route }: any) {
  const { destination, estimate, paymentMethod, rideId, pickup } = route.params;
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { getStoredToken } = useNotifications();
  const [searchText, setSearchText] = useState(t('ride.findingDriver'));
  const [isDriverFound, setIsDriverFound] = useState(false);
  
  // Transform driver name to replace "Driver" with "Pilot" if it contains "Driver"
  const transformDriverName = (name: string) => {
    if (name && name.includes('Driver')) {
      return name.replace(/Driver/g, 'Pilot');
    }
    return name;
  };
  const [socketConnected, setSocketConnected] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Prevent going back during search - always show cancel confirmation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Always prevent back navigation and show cancel confirmation
      Alert.alert(
        t('ride.cancelRideTitle'),
        t('ride.cancelRideMessage'),
        [
          { text: t('common.continue'), style: 'cancel' },
          { 
            text: t('ride.cancelRide'), 
            style: 'destructive',
            onPress: () => {
              // Emit cancel ride event to server
              const socket = getSocket();
              if (socket && rideId) {
                logger.debug('🚫 User cancelled ride search, emitting cancel_ride');
                socket.emit('cancel_ride', { rideId });
              }
              navigation.navigate('TabNavigator', { screen: 'Home' });
            }
          }
        ]
      );
      return true; // Always prevent default back behavior
    });

    return () => backHandler.remove();
  }, [rideId, navigation, t]);

  useEffect(() => {
    logger.debug('🔍 FindingDriverScreen mounted with params:', {
      destination: destination?.name,
      rideId,
      pickup: pickup?.address
    });

    // Start search timer
    const startTime = Date.now();
    searchTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSearchTime(elapsed);
      
      // Update search text based on time
      if (elapsed < 30) {
        setSearchText(t('ride.findingDriver'));
      } else if (elapsed < 60) {
        setSearchText(t('ride.findingDriver'));
      } else {
        setSearchText(t('ride.findingDriver'));
      }
    }, 1000);

    // Check socket connection status
    const checkConnection = () => {
      const connected = isConnected();
      setSocketConnected(connected);
      logger.debug('🔍 Socket connection status:', connected);
      
      if (getSocket()) {
        logger.debug('🔍 Socket ID:', getSocket()?.id);
        logger.debug('🔍 Socket connected state:', getSocket()?.connected);
      }
      
      if (!connected) {
        logger.debug('⚠️ Socket not connected, attempting to reconnect...');
        Alert.alert(
          t('common.error'),
          t('errors.networkError'),
          [
            { text: t('common.ok'), onPress: () => navigation.navigate('TabNavigator', { screen: 'Home' }) }
          ]
        );
      }
    };

    checkConnection();

    // Set up socket event listeners
    const setupSocketListeners = () => {
      logger.debug('🔧 Setting up socket listeners for FindingDriverScreen');
      
      // Listen for ride acceptance
      onRideAccepted(async (data) => {
        logger.debug('✅ Driver accepted ride (callback):', data);
        logger.debug('🔍 Current isDriverFound state (callback):', isDriverFound);
        logger.debug('🔍 Current hasNavigated state (callback):', hasNavigated);
        
        // Prevent multiple navigations
        if (isDriverFound || hasNavigated) {
          logger.debug('🚫 Driver already found or navigation already triggered, ignoring duplicate event');
          return;
        }
        
        // Validate that this is the correct ride
        if (data.rideId && rideId && data.rideId !== rideId) {
          logger.debug('🚫 Ride ID mismatch, ignoring event for different ride');
          return;
        }
        
        logger.debug('✅ Processing ride acceptance for correct ride');
        setIsDriverFound(true);
        setSearchText('Driver found! Confirming ride...');
        
        logger.debug('🚗 Navigating to LiveTracking from callback with driver data:', {
          id: data.driverId,
          name: data.driverName,
          phone: data.driverPhone,
          eta: data.estimatedArrival,
        });
        
        setHasNavigated(true);
        
        // Stop the search timer
        if (searchTimer.current) {
          clearInterval(searchTimer.current);
          searchTimer.current = null;
        }
        
                  // Send ride accepted notification
        try {
          const tokenData = await getStoredToken();
          if (tokenData?.token) {
            const backendService = BackendNotificationService.getInstance();
            await backendService.sendRideAcceptedNotification(tokenData.token, {
              rideId: data.rideId || rideId,
              driverId: data.driverId,
              driverName: data.driverName,
              eta: data.estimatedArrival
            });
            logger.debug('✅ Ride accepted notification sent');
          }
        } catch (error) {
          console.error('❌ Error sending ride accepted notification:', error);
        }

        // Navigate immediately without alert
          navigation.replace('LiveTracking', {
            destination,
            estimate,
            paymentMethod,
            driver: {
              id: data.driverId,
              name: transformDriverName(data.driverName),
              phone: data.driverPhone,
              eta: data.estimatedArrival,
            },
            rideId: data.rideId,
            origin: pickup,
          });
      });

      // Listen for ride status updates
      onRideStatus((data) => {
        logger.debug('🔄 Ride status update:', data);
        if (data.status === 'cancelled') {
          Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
          navigation.navigate('TabNavigator', { screen: 'Home' });
        }
      });

      // Listen for ride timeout
      onRideTimeout((data) => {
        logger.debug('⏰ Ride request timed out:', data);
        Alert.alert(
                    'No Pilots Found',
          data.message || 'No pilots were found. Please try again.',
          [
            { text: 'Try Again', onPress: () => navigation.navigate('TabNavigator', { screen: 'Home' }) }
          ]
        );
      });

      // Listen for driver offline
      onDriverOffline((data) => {
        logger.debug('🔴 Driver went offline:', data);
        Alert.alert(
          'Pilot Unavailable',
          'The assigned pilot is no longer available. We\'ll find you another pilot.',
          [
            { text: 'OK' }
          ]
        );
      });

      // Additional listener for ride_accepted event (backup)
      const socket = getSocket();
      if (socket) {
        logger.debug('🔧 Setting up direct socket listeners');
        
        // Test socket connection by emitting a test event
        logger.debug('🧪 Testing socket connection...');
        socket.emit('test_event', { message: 'FindingDriverScreen test' });

        // Add a simple test listener to see if any events are received
        socket.on('connect', () => {
          logger.debug('🎯 Socket connected in FindingDriverScreen!');
        });

        socket.on('disconnect', () => {
          logger.debug('🎯 Socket disconnected in FindingDriverScreen!');
        });

        // Add direct ride_accepted listener for debugging
        socket.on('ride_accepted', (data) => {
          logger.debug('🎯 Direct ride_accepted event received in FindingDriverScreen:', data);
          logger.debug('🔍 Current isDriverFound state (direct):', isDriverFound);
          logger.debug('🔍 Current hasNavigated state (direct):', hasNavigated);
          
          // Prevent multiple navigations
          if (isDriverFound || hasNavigated) {
            logger.debug('🚫 Driver already found or navigation already triggered, ignoring duplicate event');
            return;
          }
          
          // Validate that this is the correct ride
          if (data.rideId && rideId && data.rideId !== rideId) {
            logger.debug('🚫 Ride ID mismatch, ignoring event for different ride');
            return;
          }
          
          logger.debug('✅ Processing ride acceptance for correct ride (direct)');
          setIsDriverFound(true);
          setSearchText('Pilot found! Confirming ride...');
          
          logger.debug('🚗 Navigating to LiveTracking from direct event with driver data:', {
            id: data.driverId,
            name: data.driverName,
            phone: data.driverPhone,
            eta: data.estimatedArrival,
          });
          
          setHasNavigated(true);
          
          // Stop the search timer
          if (searchTimer.current) {
            clearInterval(searchTimer.current);
            searchTimer.current = null;
          }
          
          // Navigate immediately without alert
          navigation.replace('LiveTracking', {
            destination,
            estimate,
            paymentMethod,
            driver: {
              id: data.driverId,
              name: transformDriverName(data.driverName),
              phone: data.driverPhone,
              eta: data.estimatedArrival,
            },
            rideId: data.rideId,
            origin: pickup,
          });
        });

        // Add direct ride_cancelled listener for driver cancellations
        socket.on('ride_cancelled', (data) => {
          logger.debug('❌ Direct ride_cancelled event received in FindingDriverScreen:', data);
          logger.debug('🔍 Checking if rideId matches:', data.rideId, '===', rideId);
          
          // Validate that this is the correct ride
          if (data.rideId && rideId && data.rideId !== rideId) {
            logger.debug('🚫 Ride ID mismatch, ignoring cancellation for different ride');
            return;
          }
          
          logger.debug('✅ Processing ride cancellation for correct ride');
          
          // Stop the search timer
          if (searchTimer.current) {
            clearInterval(searchTimer.current);
            searchTimer.current = null;
          }
          
          // Show cancellation alert and navigate to home
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
        });
      }
    };

    setupSocketListeners();

    return () => {
      logger.debug('🧹 Cleaning up FindingDriverScreen');
      clearCallbacks();
      if (searchTimer.current) {
        clearInterval(searchTimer.current);
      }
      
      // Remove any direct socket listeners
      const socket = getSocket();
      if (socket) {
        socket.off('ride_accepted');
        socket.off('ride_cancelled');
        socket.off('ride_response');
        socket.off('connect');
        socket.off('disconnect');
      }
    };
  }, [navigation, destination, estimate, paymentMethod, rideId, pickup]); // Remove isDriverFound and hasNavigated from dependencies

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    try {
      logger.debug('🚫 User cancelled ride with reason:', reason);
      
      // Call the cancel ride API endpoint
      if (rideId && getToken) {
        logger.debug('📡 Calling cancel ride API for ride ID:', rideId);
        const token = await getToken();
        if (!token) {
          throw new Error('Authentication token not available');
        }
        const result = await rideService.cancelRide(rideId, () => Promise.resolve(token));
        logger.debug('✅ Cancel ride API response:', result);
        
        // Emit socket event to notify server about cancellation (preserve socket events)
        const socket = getSocket();
        if (socket) {
          logger.debug('🔌 Emitting cancel_ride socket event');
          socket.emit('cancel_ride', { rideId, reason });
        }
        
        // Close modal first
        setShowCancelModal(false);
        
        // Navigate immediately without alert
        logger.debug('🚀 Navigating to home screen immediately after successful cancellation');
        navigation.replace('TabNavigator', { screen: 'Home' });
        
      } else {
        throw new Error('Missing rideId or authentication token');
      }
    } catch (error) {
      console.error('❌ Error cancelling ride:', error);
      
      // Show error message but still try to emit socket event
      const socket = getSocket();
      if (socket && rideId) {
        logger.debug('🔌 Emitting cancel_ride socket event as fallback');
        socket.emit('cancel_ride', { rideId, reason });
      }
      
      // Close modal first
      setShowCancelModal(false);
      
      // Navigate immediately even on error
      logger.debug('🚀 Navigating to home screen after error');
      navigation.replace('TabNavigator', { screen: 'Home' });
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <ConnectionStatus />
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Connection Status */}
        {!socketConnected && (
          <View style={styles.connectionWarning}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <Text style={styles.connectionText}>Connecting to server...</Text>
          </View>
        )}

        {/* Map Container */}
        <View style={styles.mapContainer}>
          <LottieView
            source={require('../../../assets/lottie/map search.json')}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
        </View>

        {/* Search Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{searchText}</Text>
          <Text style={styles.statusSubtext}>
            {isDriverFound ? 'Preparing your ride...' : 'This usually takes 1-2 minutes'}
          </Text>

          {!isDriverFound && (
            <View style={styles.searchInfo}>
              <TimelineLoader searchTime={searchTime} />
            </View>
          )}
        </View>

        {/* Trip Details */}
        <View style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripTitle}>Trip Details</Text>
            <View style={styles.fareContainer}>
              <Text style={styles.fareText}>₹{estimate.fare}</Text>
            </View>
          </View>

          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeAddress}>
                  {pickup?.address || 'Current Location'}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={styles.destinationDot} />
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>Destination</Text>
                <Text style={styles.routeAddress}>
                  {destination?.name || 'Destination'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={handleCancel}
          disabled={isDriverFound}
        >
          <Ionicons name="close-circle" size={20} color={Colors.coral} />
          <Text style={styles.cancelButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      </ScrollView>
        
      {/* Cancel Ride Modal */}
      <CancelRideModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Layout.spacing.xl,
  },
  connectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    marginHorizontal: Layout.spacing.lg,
    marginTop: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.sm,
  },
  connectionText: {
    marginLeft: Layout.spacing.xs,
    fontSize: Layout.fontSize.sm,
    color: Colors.warning,
    fontWeight: '500',
  },
  mapContainer: {
    height: 250,

    margin: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
  statusContainer: {
    alignItems: 'center',
  },
  searchIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  statusText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
  },
  statusSubtext: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Layout.spacing.lg,
  },
  tripCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  tripTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  fareContainer: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.sm,
  },
  fareText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  routeInfo: {
    marginBottom: Layout.spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginRight: Layout.spacing.md,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.coral,
    marginRight: Layout.spacing.md,
  },
  routeDetails: {
    flex: 1,
    paddingVertical: Layout.spacing.sm,
  },
  routeLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  routeAddress: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.gray300,
    marginLeft: 5,
    marginVertical: 4,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: Layout.spacing.xs,
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  bottomAction: {
    backgroundColor: Colors.white,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: Layout.borderRadius.md,
    paddingVertical: Layout.spacing.md,
    marginHorizontal: Layout.spacing.lg,
    marginTop: Layout.spacing.lg,
  },
  cancelButtonText: {
    marginLeft: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  searchInfo: {
    alignItems: 'center',
    marginTop: Layout.spacing.lg,
  },
  searchTimeText: {
    marginTop: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  timelineContainer: {
    marginTop: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.lg,
    backgroundColor: '#F8F9FA',
    paddingVertical: 20,
    borderRadius: 12,
    marginHorizontal: '5%',
    width: '100%',
    alignSelf: 'center',
  },
  segmentedProgressContainer: {
    flexDirection: 'row',
    height: 20,
    justifyContent: 'space-between',
    padding: 2,
  },
  segmentContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  segmentBackground: {
    height: '100%',
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    backgroundColor: '#1877F2',
    borderRadius: 8,
  },
});
