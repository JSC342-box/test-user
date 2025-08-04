import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { useAuth } from '@clerk/clerk-expo';
import { userApi, RideHistory, RideHistoryFilters } from '../../services/userService';

export default function RideHistoryScreen({ navigation }: any) {
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [rideHistory, setRideHistory] = useState<RideHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  // Filter ride history based on selected filter
  const filteredHistory = React.useMemo(() => {
    if (filter === 'all') return rideHistory;
    return rideHistory.filter((item) => item.status === filter);
  }, [rideHistory, filter]);

  // Load ride history on component mount
  useEffect(() => {
    loadRideHistory();
  }, []);

  const loadRideHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Build filters based on current filter selection
      const filters: RideHistoryFilters = {
        limit: 50, // Load last 50 rides
      };

      // Add status filter if not 'all'
      if (filter !== 'all') {
        filters.status = filter;
      }

      console.log('🔄 Loading ride history with filters:', filters);
      
      const rides = await userApi.getUserRideHistory(getToken, filters);
      
      console.log('✅ Ride history loaded:', rides.length, 'rides');
      
      setRideHistory(rides);
      
    } catch (error) {
      console.error('❌ Error loading ride history:', error);
      setError('Failed to load ride history. Please try again.');
      
      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load ride history. Please check your internet connection and try again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadRideHistory(true);
  };

  const handleFilterChange = (newFilter: 'all' | 'completed' | 'cancelled') => {
    setFilter(newFilter);
    setFilterVisible(false);
    loadRideHistory(); // Reload with new filter
  };

  const renderRideItem = ({ item }: { item: RideHistory }) => {
    // Format date and time
    const rideDate = new Date(item.createdAt);
    const dateText = rideDate.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    const timeText = rideDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Get status color
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed': return Colors.success;
        case 'cancelled': return Colors.error;
        case 'in_progress': return Colors.accent;
        case 'pending': return Colors.warning;
        default: return Colors.gray400;
      }
    };

    return (
      <TouchableOpacity 
        style={styles.rideCard} 
        onPress={() => navigation.navigate('HistoryDetail', { ride: item })}
      >
        <View style={styles.rideHeader}>
          <View style={styles.rideDate}>
            <Text style={styles.dateText}>{dateText}</Text>
            <Text style={styles.timeText}>{timeText}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.fareContainer}>
            <Text style={styles.fareText}>₹{item.fare}</Text>
          </View>
        </View>

        <View style={styles.rideRoute}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <Text style={styles.routeText} numberOfLines={2}>{item.pickupLocation?.address || 'Pickup Location'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={styles.destinationDot} />
            <Text style={styles.routeText} numberOfLines={2}>{item.dropLocation?.address || 'Destination'}</Text>
          </View>
        </View>

        <View style={styles.rideFooter}>
          <View style={styles.rideStats}>
            <View style={styles.statItem}>
              <Ionicons name="location" size={14} color={Colors.gray400} />
              <Text style={styles.statText}>{item.distance ? item.distance.toFixed(1) : '0.0'} km</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time" size={14} color={Colors.gray400} />
              <Text style={styles.statText}>{item.duration || '0'} mins</Text>
            </View>
            {item.driverName && (
              <View style={styles.statItem}>
                <Ionicons name="person" size={14} color={Colors.gray400} />
                <Text style={styles.statText}>{item.driverName}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.rideActions}>
            {item.rating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={Colors.accent} />
                <Text style={styles.ratingText}>{item.rating}</Text>
              </View>
            )}
            {item.status === 'completed' && (
              <TouchableOpacity
                style={styles.rebookButton}
                onPress={() => handleRebook(item)}
              >
                <Text style={styles.rebookText}>Rebook</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRebook = (item: RideHistory) => {
    navigation.navigate('DropLocationSelector', {
      destination: {
        address: item.dropLocation?.address || 'Destination',
        name: item.dropLocation?.address || 'Destination',
        latitude: item.dropLocation?.latitude || 0,
        longitude: item.dropLocation?.longitude || 0,
      },
      pickup: {
        address: item.pickupLocation?.address || 'Pickup Location',
        name: item.pickupLocation?.address || 'Pickup Location',
        latitude: item.pickupLocation?.latitude || 0,
        longitude: item.pickupLocation?.longitude || 0,
      },
      autoProceed: true
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)}>
          <Ionicons name="filter" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setFilterVisible(false)} activeOpacity={1}>
          <View style={{ position: 'absolute', top: 70, right: 20, backgroundColor: '#fff', borderRadius: 8, padding: 16, elevation: 8 }}>
            <TouchableOpacity onPress={() => handleFilterChange('all')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: filter === 'all' ? Colors.primary : Colors.text }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleFilterChange('completed')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: filter === 'completed' ? Colors.primary : Colors.text }}>Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleFilterChange('cancelled')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: filter === 'cancelled' ? Colors.primary : Colors.text }}>Cancelled</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading ride history...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadRideHistory()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredHistory.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={48} color={Colors.gray400} />
          <Text style={styles.emptyText}>No rides found</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'all' 
              ? 'Your ride history will appear here' 
              : `No ${filter} rides found`
            }
          </Text>
        </View>
      )}

      {/* Ride List */}
      {!isLoading && !error && filteredHistory.length > 0 && (
        <FlatList
          data={filteredHistory}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: Layout.spacing.sm,
  },
  headerTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  filterButton: {
    padding: Layout.spacing.sm,
  },
  listContent: {
    padding: Layout.spacing.lg,
  },
  rideCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  rideDate: {
    flex: 1,
  },
  dateText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  timeText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fareContainer: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.sm,
  },
  fareText: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  rideRoute: {
    marginBottom: Layout.spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.xs,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Layout.spacing.md,
  },
  destinationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.coral,
    marginRight: Layout.spacing.md,
  },
  routeText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: Colors.gray300,
    marginLeft: 3,
    marginVertical: 2,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rideStats: {
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Layout.spacing.md,
  },
  statText: {
    marginLeft: Layout.spacing.xs,
    fontSize: Layout.fontSize.xs,
    color: Colors.textSecondary,
  },
  rideActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Layout.spacing.md,
  },
  ratingText: {
    marginLeft: Layout.spacing.xs,
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  rebookButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.sm,
  },
  rebookText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  statusBadge: {
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 2,
    borderRadius: Layout.borderRadius.sm,
    marginTop: Layout.spacing.xs,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.spacing.xl,
  },
  loadingText: {
    marginTop: Layout.spacing.md,
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.spacing.xl,
  },
  errorText: {
    marginTop: Layout.spacing.md,
    fontSize: Layout.fontSize.md,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Layout.spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.spacing.xl,
  },
  emptyText: {
    marginTop: Layout.spacing.md,
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtext: {
    marginTop: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
