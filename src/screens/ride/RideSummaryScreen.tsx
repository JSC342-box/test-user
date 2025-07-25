import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import Button from '../../components/common/Button';
import RateDriverScreen from '../ride/RateDriverScreen';

const feedbackTags = [
  'Great ride',
  'On time',
  'Safe driving',
  'Friendly',
  'Clean vehicle',
  'Good route',
];

export default function RideSummaryScreen({ navigation, route }: any) {
  const { destination, estimate, driver } = route.params;
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comments, setComments] = useState('');

  const driverInfo = driver || {
    name: 'Alex Robin',
    vehicleModel: 'Volkswagen',
    vehicleNumber: 'HG5045',
    photo: undefined,
  };

  const handleRating = (value: number) => {
    setRating(value);
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleContinue = () => {
    navigation.navigate('RateDriver', { driver });
  };

  const handleBookAnother = () => {
    navigation.navigate('TabNavigator', { screen: 'Home' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Ride Completed!</Text>
          <Text style={styles.successSubtitle}>
            Hope you had a great experience
          </Text>
        </View>

        {/* Ride Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>From</Text>
                <Text style={styles.routeAddress}>Your pickup location</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={styles.destinationDot} />
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>To</Text>
                <Text style={styles.routeAddress}>{destination?.name || 'Your destination'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{estimate?.distance || '--'}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{estimate?.duration || '--'}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{estimate?.fare ?? '--'}</Text>
              <Text style={styles.statLabel}>Fare</Text>
            </View>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.paymentItem}>
            <Text style={styles.paymentLabel}>Ride Fare</Text>
            <Text style={styles.paymentValue}>₹{estimate?.fare ?? '--'}</Text>
          </View>
          <View style={styles.paymentDivider} />
          <View style={styles.paymentTotal}>
            <Text style={styles.paymentTotalLabel}>Total Paid</Text>
            <Text style={styles.paymentTotalValue}>₹{estimate?.fare ?? '--'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        
        <Button
          title="Continue"
          onPress={handleContinue}
          style={styles.submitButton}
        />
        <TouchableOpacity style={styles.bookAnotherButton} onPress={handleBookAnother}>
          <Text style={styles.bookAnotherText}>Book Another Ride </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
    backgroundColor: Colors.white,
    marginBottom: Layout.spacing.md,
  },
  successIcon: {
    marginBottom: Layout.spacing.md,
  },
  successTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
  },
  successSubtitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.spacing.md,
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
    alignItems: 'center',
  },
  statValue: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Layout.spacing.xs,
  },
  ratingCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  driverPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: Layout.spacing.md,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  vehicleInfo: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  starButton: {
    marginHorizontal: Layout.spacing.xs,
  },
  feedbackTags: {
    marginTop: Layout.spacing.md,
  },
  tagsTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagButton: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.lg,
    marginRight: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text,
  },
  tagTextSelected: {
    color: Colors.white,
  },
  tipCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tipSubtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Layout.spacing.md,
  },
  tipOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tipButton: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
    alignItems: 'center',
  },
  tipButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  tipTextSelected: {
    color: Colors.white,
  },
  paymentCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
  },
  paymentLabel: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Layout.spacing.sm,
  },
  paymentTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Layout.spacing.sm,
  },
  paymentTotalLabel: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentTotalValue: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  bottomActions: {
    backgroundColor: Colors.white,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  submitButton: {
    marginBottom: Layout.spacing.sm,
  },
  bookAnotherButton: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
  },
  bookAnotherText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  promptText: {
    fontSize: Layout.fontSize.md,
    color: Colors.text,
    marginBottom: Layout.spacing.md,
  },
  commentsInput: {
    backgroundColor: Colors.gray50,
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Layout.spacing.md,
  },
  tipPrompt: {
    fontSize: Layout.fontSize.md,
    color: Colors.text,
    marginBottom: Layout.spacing.md,
  },
  customTipInput: {
    backgroundColor: Colors.gray50,
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginBottom: Layout.spacing.md,
  },
  submitButtonText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
});
