import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PRIMARY_GREEN, TITLE_COLOR } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';

const faqItems = [
  { key: 'high_charge', label: 'I have been charged higher than the estimated fare', screen: 'PaymentsIssues' },
  { key: 'cancel_fee', label: 'I have been charged a cancellation fee', screen: 'CancellationFee' },
  { key: 'charged_without_ride', label: "I didn't take the ride but I was charged for the same", screen: 'OtherIssues' },
  { key: 'no_cashback', label: "I didn't receive cashback in my wallet", screen: 'PaymentsIssues' },
  { key: 'billing', label: 'Billing Related Issues', screen: 'PaymentsIssues' },
];

export default function RideIssuesScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={TITLE_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQs</Text>
        <TouchableOpacity style={styles.ticketsButton} onPress={() => navigation.navigate('OtherIssues')}>
          <Ionicons name="star-outline" size={16} color={Colors.text} />
          <Text style={styles.ticketsText}>Tickets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Ride fare related Issues</Text>
        <View style={styles.card}>
          {faqItems.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.rowItem, idx < faqItems.length - 1 && styles.rowDivider]}
              onPress={() => navigation.navigate(item.screen)}
              accessibilityLabel={item.label}
            >
              <Text style={styles.rowText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowText: {
    fontSize: Layout.fontSize.md,
    color: TITLE_COLOR,
    fontWeight: '500',
    flex: 1,
    paddingRight: Layout.spacing.md,
  },
}); 