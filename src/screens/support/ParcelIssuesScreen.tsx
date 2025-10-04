import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TITLE_COLOR } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';

const items = [
  { key: 'not_delivered', label: 'My order was not delivered', screen: 'OtherIssues' },
  { key: 'damaged', label: 'Items are damaged', screen: 'OtherIssues' },
  { key: 'missing', label: 'Few items are missing from my order', screen: 'OtherIssues' },
  { key: 'cant_contact', label: 'I am unable to contact the pilot', screen: 'OtherIssues' },
  { key: 'payment', label: 'I have an issue with the payment', screen: 'PaymentsIssues' },
  { key: 'not_listed', label: 'My issue is not mentioned above', screen: 'OtherIssues' },
];

export default function ParcelIssuesScreen({ navigation }: any) {
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
        <Text style={styles.sectionHeader}>Parcel Related Issues</Text>
        <View style={styles.card}>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.rowItem, idx < items.length - 1 && styles.rowDivider]}
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


