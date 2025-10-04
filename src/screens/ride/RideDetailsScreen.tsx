import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { RideHistory } from '../../services/userService';

interface RideDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      ride: RideHistory;
    };
  };
}

export default function RideDetailsScreen({ navigation, route }: RideDetailsScreenProps) {
  const { ride } = route.params;

  // Format date and time
  const rideDate = new Date(ride.requestedAt || ride.createdAt);
  const dateText = rideDate.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  const timeText = rideDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return Colors.success;
    
      case 'CANCELLED': return Colors.error;
      case 'STARTED': return Colors.accent;
      case 'REQUESTED': return Colors.warning;
      default: return Colors.gray400;
    }
  };

  // Calculate fare breakdown
  const rideCharge = Math.round(ride.fare * 0.98); // 98% of total fare
  const bookingFees = Math.round(ride.fare * 0.02); // 2% of total fare
  const totalFare = ride.fare;

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
        <Text style={styles.headerTitle}>Details</Text>
        <TouchableOpacity 
          style={styles.ticketsButton}
          onPress={() => navigation.navigate('HelpSupport')}
        >
          <Ionicons name="ticket" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ride Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <View style={styles.bikeIcon}>
              <Ionicons name="bicycle" size={24} color={Colors.white} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.rideType}>Bike Ride</Text>
              <Text style={styles.rideDateTime}>{dateText} • {timeText}</Text>
              <View style={styles.rideStatus}>
                <Text style={styles.rideFare}>₹{Math.round(totalFare)}</Text>
                <Text style={styles.bullet}> • </Text>
                <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
                  {ride.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Ride Details Section */}
        <View style={styles.detailsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>RIDE DETAILS</Text>
          </View>
          
          {/* Pickup and Drop Locations */}
          <View style={styles.locationsContainer}>
            {/* Pickup */}
            <View style={styles.locationItem}>
              <View style={styles.pickupDot} />
              <Text style={styles.locationAddress} numberOfLines={3}>
                {ride.pickupLocation?.address || 'Pickup Location'}
              </Text>
            </View>
            
            {/* Route Line */}
            <View style={styles.routeLine} />
            
            {/* Drop */}
            <View style={styles.locationItem}>
              <View style={styles.dropDot} />
              <Text style={styles.locationAddress} numberOfLines={3}>
                {ride.dropLocation?.address || 'Destination'}
              </Text>
            </View>
          </View>
          
          {/* Ride Metrics */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Duration</Text>
              <Text style={styles.metricValue}>{ride.duration || '0'} mins</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{ride.distance ? ride.distance.toFixed(1) : '0.0'} kms</Text>
            </View>
                         <View style={styles.metricItem}>
               <Text style={styles.metricLabel}>Ride ID</Text>
               <Text style={styles.metricValue} numberOfLines={1} ellipsizeMode="tail">{ride.id}</Text>
             </View>
          </View>
        </View>

                 {/* Invoice Section - Only show for non-cancelled rides */}
         {ride.status !== 'CANCELLED' && (
           <View style={styles.invoiceCard}>
             <View style={styles.sectionHeader}>
               <Ionicons name="receipt" size={20} color={Colors.primary} />
               <Text style={styles.sectionTitle}>INVOICE</Text>
             </View>
             
             {/* Total Fare */}
             <View style={styles.totalFareContainer}>
               <Text style={styles.totalFareLabel}>Total fare</Text>
               <View style={styles.totalFareValue}>
                 <Text style={styles.totalFareText}>₹{totalFare.toFixed(1)}</Text>
                 <Ionicons name="chevron-up" size={16} color={Colors.textSecondary} />
               </View>
             </View>
             
             {/* Separator */}
             <View style={styles.separator} />
             
             {/* Fare Breakdown */}
             <View style={styles.fareBreakdown}>
               <View style={styles.fareItem}>
                 <Text style={styles.fareLabel}>Ride Charge</Text>
                 <Text style={styles.fareValue}>₹{rideCharge.toFixed(2)}</Text>
               </View>
                            <View style={styles.fareItem}>
               <Text style={styles.fareLabel} numberOfLines={2}>Booking Fees & Convenience Charges</Text>
               <Text style={styles.fareValue}>₹{bookingFees.toFixed(2)}</Text>
             </View>
             </View>
           </View>
         )}
      </ScrollView>
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
     ticketsButton: {
     padding: Layout.spacing.sm,
     borderRadius: Layout.borderRadius.sm,
     backgroundColor: Colors.gray50,
   },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
  },
  summaryCard: {
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
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bikeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  rideType: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.xs,
  },
  rideDateTime: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    marginBottom: Layout.spacing.xs,
  },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideFare: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  bullet: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  statusText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
  },
  detailsCard: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: Layout.spacing.sm,
  },
  locationsContainer: {
    marginBottom: Layout.spacing.lg,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Layout.spacing.md,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginRight: Layout.spacing.md,
    marginTop: 4,
  },
  dropDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.coral,
    marginRight: Layout.spacing.md,
    marginTop: 4,
  },
  locationAddress: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.gray300,
    marginLeft: 5,
    marginVertical: 4,
    borderStyle: 'dashed',
  },
  metricsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Layout.spacing.md,
  },
     metricItem: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingVertical: Layout.spacing.sm,
     marginBottom: Layout.spacing.xs,
   },
  metricLabel: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
  },
     metricValue: {
     fontSize: Layout.fontSize.sm,
     fontWeight: '600',
     color: Colors.text,
     flex: 1,
     textAlign: 'right',
     marginLeft: Layout.spacing.sm,
   },
  invoiceCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  totalFareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  totalFareLabel: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalFareValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalFareText: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: Layout.spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Layout.spacing.md,
    borderStyle: 'dashed',
  },
  fareBreakdown: {
    marginTop: Layout.spacing.md,
  },
     fareItem: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'flex-start',
     paddingVertical: Layout.spacing.sm,
   },
  fareLabel: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
     fareValue: {
     fontSize: Layout.fontSize.sm,
     fontWeight: '600',
     color: Colors.text,
     marginLeft: Layout.spacing.sm,
     textAlign: 'right',
     minWidth: 60,
   },
});
