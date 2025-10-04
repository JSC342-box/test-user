import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY_GREEN, TITLE_COLOR, SUBTITLE_COLOR } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { useAuth } from '@clerk/clerk-expo';
import { userApi, type RideHistory } from '../../services/userService';

// Small helpers for formatting
const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).replace(',', ' •');
  } catch {
    return '';
  }
};

const formatFare = (amount?: number, status?: string) => {
  if (amount == null) return '';
  const rupee = `₹${Math.round(amount)}`;
  const statusText = status === 'COMPLETED' ? 'Completed' : status === 'CANCELLED' ? 'Cancelled' : (status || '').toString();
  return `${rupee} • ${statusText}`;
};

const helpTopics = [
  { key: 'fare', label: 'Ride fare related Issues', screen: 'RideIssues' },
  { key: 'captain', label: 'Pilot and Vehicle related issues', screen: 'CaptainVehicleIssues' },
  { key: 'payment', label: 'Pass and Payment related Issues', screen: 'PaymentsIssues' },
  { key: 'parcel', label: 'Parcel Related Issues', screen: 'ParcelIssues' },
  { key: 'other', label: 'Other Topics', screen: 'OtherIssues' },
];

export default function HelpSupportScreen({ navigation }: any) {
  const { getToken } = useAuth();
  const [lastRide, setLastRide] = useState<RideHistory | null>(null);
  // Reserved for future loading states; currently not displayed
  const [loadingRide, setLoadingRide] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingRide(true);
        const rides = await userApi.getUserRideHistory(getToken, { limit: 1 });
        if (!mounted) return;
        const latest: RideHistory | null = rides && rides.length > 0 ? (rides[0] as RideHistory) : null;
        setLastRide(latest);
      } catch {
        if (mounted) setLastRide(null);
      } finally {
        if (mounted) setLoadingRide(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [getToken]);

  const lastRideTitle = useMemo(() => {
    if (!lastRide) return '';
    const address = lastRide.dropLocation?.address || lastRide.pickupLocation?.address || '';
    return address.split(',')[0] || address;
  }, [lastRide]);

  const lastRideDate = useMemo(() => {
    if (!lastRide) return '';
    const when = lastRide.completedAt || lastRide.updatedAt || lastRide.createdAt;
    return formatDateTime(when);
  }, [lastRide]);

  const lastRideFare = useMemo(() => {
    if (!lastRide) return '';
    return formatFare(lastRide.fare, (lastRide as any).status?.toUpperCase?.() || lastRide.status?.toUpperCase?.());
  }, [lastRide]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={TITLE_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help</Text>
        <TouchableOpacity style={styles.ticketsButton} onPress={() => navigation.navigate('OtherIssues')}>
          <Ionicons name="star-outline" size={16} color={Colors.text} />
          <Text style={styles.ticketsText}>Tickets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Last Ride */}
        <Text style={styles.sectionHeader}>Your last ride</Text>
        <View style={styles.lastRideCard}>
          <View style={styles.lastRideRow}>
            <View style={styles.iconBox}>
              <Ionicons name="bus-outline" size={20} color={Colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rideTitle}>{lastRideTitle || 'No recent ride'}</Text>
              {!!lastRide && <Text style={styles.rideMeta}>{lastRideDate}</Text>}
              {!!lastRide && <Text style={styles.rideStatus}>{lastRideFare}</Text>}
            </View>
          </View>
          <TouchableOpacity style={styles.rowLink} onPress={() => navigation.getParent()?.navigate('History')}>
            <View style={styles.rowLeft}>
              <Ionicons name="refresh-outline" size={18} color={Colors.text} />
              <Text style={styles.rowLinkText}>Full Ride history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Help topics */}
        <Text style={styles.sectionHeader}>Help topics</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.gray400} />
          <Text style={styles.searchPlaceholder}>Search Help Topics</Text>
        </View>

        <View style={styles.topicsCard}>
          {helpTopics.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.topicItem, idx < helpTopics.length - 1 && styles.topicDivider]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.topicLeft}>
                <View style={styles.topicIcon}>
                  <Ionicons name={
                    item.key === 'fare' ? 'bicycle' :
                    item.key === 'captain' ? 'construct-outline' :
                    item.key === 'payment' ? 'cash-outline' :
                    item.key === 'parcel' ? 'cube-outline' : 'settings-outline'
                  } size={20} color={Colors.primary} />
                </View>
                <Text style={styles.topicText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomButton}
          accessibilityLabel="Call Support"
          onPress={() => Linking.openURL('tel:+1234567890')}
        >
          <Ionicons name="call-outline" size={20} color={PRIMARY_GREEN} />
          <Text style={styles.bottomButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomButton}
          accessibilityLabel="Chat with Support"
          onPress={() => navigation.navigate('Chat', { driver: { name: 'Support' } })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={PRIMARY_GREEN} />
          <Text style={styles.bottomButtonText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: 'bold',
    color: TITLE_COLOR,
  },
  ticketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ticketsText: {
    marginLeft: 6,
    color: Colors.text,
    fontWeight: '600',
  },
  content: {
    padding: Layout.spacing.lg,
    paddingBottom: 120,
  },
  sectionHeader: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
  },
  lastRideCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lastRideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  rideTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  rideMeta: {
    fontSize: Layout.fontSize.sm,
    color: SUBTITLE_COLOR,
    marginTop: 2,
  },
  rideStatus: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text,
    marginTop: 2,
  },
  rowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 as unknown as number,
  },
  rowLinkText: {
    marginLeft: 8,
    fontWeight: '600',
    color: Colors.text,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    marginBottom: Layout.spacing.md,
  },
  searchPlaceholder: {
    marginLeft: 8,
    color: Colors.gray400,
  },
  topicsCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
  },
  topicDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  topicText: {
    fontSize: Layout.fontSize.md,
    color: TITLE_COLOR,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: Layout.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 32,
    height: Layout.buttonHeight,
  },
  bottomButtonText: {
    marginLeft: 8,
    fontSize: Layout.fontSize.md,
    color: PRIMARY_GREEN,
    fontWeight: '600',
  },
}); 