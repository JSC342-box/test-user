import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';

interface SupportResolutionScreenProps {
  navigation: any;
  route: {
    params: {
      ride?: any;
      issue?: 'charged_without_ride' | 'cancellation_fee' | 'charged_higher_than_estimated' | 'general_inquiry';
    };
  };
}

export default function SupportResolutionScreen({ navigation, route }: SupportResolutionScreenProps) {
  const { user } = useUser();
  const { ride, issue } = route.params || {};
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  const name = useMemo(() => (user?.firstName || user?.fullName || '').trim(), [user]);
  const pickupAddress = ride?.pickupLocation?.address || 'Pickup Location';
  const dropAddress = ride?.dropLocation?.address || 'Destination';
  const dateTimeText = useMemo(() => {
    try {
      if (!ride?.requestedAt && !ride?.createdAt) return '';
      const d = new Date(ride.requestedAt || ride.createdAt);
      const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return `${date} • ${time}`;
    } catch {
      return '';
    }
  }, [ride]);

  const message = useMemo(() => {
    const greeting = `Hi ${name || 'there'}, we’re sorry you had to face this.`;
    switch (issue) {
      case 'charged_without_ride':
        return (
          `${greeting} However, please ensure you haven’t shared your account login with anyone. ` +
          `If you still want us to resolve the issue, we’ll be happy to help.`
        );
      case 'cancellation_fee':
        return (
          `${greeting} Cancellation fees apply in certain scenarios. ` +
          `Please make sure the booking wasn’t made or cancelled by someone else using your account. ` +
          `If you still want us to review this, we’ll be happy to help.`
        );
      case 'charged_higher_than_estimated':
        return (
          `${greeting} Final fares can vary due to traffic, route, or time. ` +
          `If this still looks incorrect, we can take a closer look.`
        );
      case 'no_cashback':
        return (
          `${greeting} Sometimes cashback can take a little longer to reflect. ` +
          `Please ensure you met the offer conditions. If this still seems wrong, we can review it.`
        );
      default:
        return (
          `${greeting} Let us know how we can help, and we’ll guide you further.`
        );
    }
  }, [issue, name]);

  const handleHelpful = (wasHelpful: boolean) => {
    setFeedback(wasHelpful ? 'yes' : 'no');
    if (!wasHelpful) {
      // Redirect them to Help & Support for further assistance
      setTimeout(() => navigation.navigate('HelpSupport'), 300);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Apology and Guidance */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="alert-circle" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>We’re here to help</Text>
          </View>
          <Text style={styles.messageText}>{message}</Text>
        </View>

        {/* Helpful prompt (moved to middle) */}
        <View style={styles.card}>
          <Text style={styles.helpfulTitle}>Was this article helpful?</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.btnYes]} onPress={() => handleHelpful(true)}>
              <Ionicons name="thumbs-up" size={18} color={Colors.white} />
              <Text style={styles.actionTextYes}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.btnNo]} onPress={() => handleHelpful(false)}>
              <Ionicons name="thumbs-down" size={18} color={Colors.white} />
              <Text style={styles.actionTextNo}>No</Text>
            </TouchableOpacity>
          </View>
          {feedback === 'yes' && (
            <Text style={styles.thanksText}>Thanks for your feedback!</Text>
          )}
          {feedback === 'no' && (
            <Text style={styles.thanksText}>We’ll take you to Help & Support for further assistance…</Text>
          )}
        </View>

        {/* Ride Summary */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="bicycle" size={20} color={Colors.white} style={styles.rideIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rideTitle}>Bike Lite Ride</Text>
              {!!dateTimeText && <Text style={styles.rideDateTime}>{dateTimeText}</Text>}
            </View>
          </View>
          <View style={styles.locationRow}>
            <View style={styles.dotPickup} />
            <Text style={styles.locationText} numberOfLines={2}>{pickupAddress}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={styles.dotDrop} />
            <Text style={styles.locationText} numberOfLines={2}>{dropAddress}</Text>
          </View>
        </View>

        {/* Contact Support (separate card) */}
        <View style={styles.card}>
          <Text style={styles.helpfulTitle}>Need more help?</Text>
          <TouchableOpacity
            style={[styles.contactButton, styles.contactButtonFull]}
            onPress={() => {
              const normalizedRide = ride ? { ...ride, rideId: ride.rideId || ride.id } : undefined;
              navigation.navigate('Conversation', {
                ride: normalizedRide,
                issue: issue || 'general_inquiry',
              });
            }}
          >
            <Ionicons name="chatbubbles" size={18} color={Colors.white} />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: { padding: Layout.spacing.sm },
  headerTitle: { fontSize: Layout.fontSize.lg, fontWeight: '600', color: Colors.text },
  content: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Layout.spacing.sm, gap: 8 as unknown as number },
  cardTitle: { marginLeft: 8, fontSize: Layout.fontSize.md, fontWeight: '700', color: Colors.text },
  messageText: { color: Colors.text, lineHeight: 20 },
  rideIcon: { backgroundColor: Colors.primary, borderRadius: 16, padding: 6, marginRight: 8 },
  rideTitle: { fontSize: Layout.fontSize.md, fontWeight: '700', color: Colors.text },
  rideDateTime: { marginTop: 2, fontSize: Layout.fontSize.xs, color: Colors.textSecondary },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Layout.spacing.sm },
  dotPickup: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginRight: Layout.spacing.md, marginTop: 4 },
  dotDrop: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.coral, marginRight: Layout.spacing.md, marginTop: 4 },
  locationText: { flex: 1, color: Colors.text },
  routeLine: { height: 16, width: 2, backgroundColor: Colors.gray300, marginLeft: 4, marginTop: 2 },
  helpfulTitle: { fontSize: Layout.fontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Layout.spacing.sm },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: Layout.borderRadius.md, paddingVertical: 10, paddingHorizontal: 16 },
  btnYes: { backgroundColor: Colors.primary },
  btnNo: { backgroundColor: Colors.coral },
  actionTextYes: { color: Colors.white, fontWeight: '700', marginLeft: 8 },
  actionTextNo: { color: Colors.white, fontWeight: '700', marginLeft: 8 },
  thanksText: { marginTop: Layout.spacing.sm, color: Colors.textSecondary },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray800,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.borderRadius.md,
    marginTop: Layout.spacing.sm,
  },
  contactButtonFull: { width: '100%' },
  contactButtonText: {
    color: Colors.white,
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    marginLeft: Layout.spacing.xs,
  },
});


