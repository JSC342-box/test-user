import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { useFocusEffect } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';

const profileOptions = [
  {
    id: '0',
    title: 'Personal Details',
    icon: 'person-circle-outline',
    screen: 'PersonalDetails',
  },
  {
    id: '1',
    title: 'Wallet & Payments',
    icon: 'wallet-outline',
    screen: 'Payment',
  },
  {
    id: '2',
    title: 'Privacy & Security',
    icon: 'shield-checkmark-outline',
    screen: 'PrivacySecurity',
  },
  {
    id: '3',
    title: 'Settings',
    icon: 'settings-outline',
    screen: 'Settings',
  },
  {
    id: '4',
    title: 'About',
    icon: 'information-circle-outline',
    screen: 'About',
  },
];

export default function ProfileScreen({ navigation, route }: any) {
  const { signOut } = useAuth();
  const { user } = useUser();
  
  const getUserPhoto = () => {
    return user?.imageUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
  };

  const [profilePhoto, setProfilePhoto] = useState(getUserPhoto());
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>(
    route.params?.initialTab === 'history' ? 'history' : 'methods'
  );

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.updatedPhoto) {
        setProfilePhoto(route.params.updatedPhoto);
      }
    }, [route])
  );

  const handleOptionPress = (screen: string) => {
    if (screen === 'PersonalDetails') {
      navigation.navigate('PersonalDetails', {
        name: getUserName(),
        email: getUserEmail(),
        phone: getUserPhone(),
        gender: '',
        emergencyName: '',
        emergencyPhone: '',
        photo: getUserPhoto(),
      });
    } else if (screen === 'EditProfile') {
      navigation.navigate('EditProfile');
    } else if (screen === 'History') {
      navigation.navigate('History');
    } else if (screen === 'Payment') {
      navigation.navigate('Payment');
    } else if (screen === 'Settings') {
      navigation.navigate('Settings');
    } else if (screen === 'About') {
      navigation.navigate('About');
    } else if (screen === 'PrivacySecurity') {
      navigation.navigate('PrivacySecurity');
    } else {
      console.log(`Navigate to ${screen}`);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user?.firstName) {
      return user.firstName;
    } else if (user?.fullName) {
      return user.fullName;
    }
    return 'User';
  };

  const getUserEmail = () => {
    return user?.primaryEmailAddress?.emailAddress || '';
  };

  const getUserPhone = () => {
    return user?.primaryPhoneNumber?.phoneNumber || '';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.profilePhotoWrapper}>
              <Image
                source={{ uri: profilePhoto }}
                style={styles.profilePhoto}
              />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{getUserName()}</Text>
              {getUserEmail() && (
                <Text style={styles.profileEmail}>{getUserEmail()}</Text>
              )}
              {getUserPhone() && (
                <Text style={styles.profilePhone}>{getUserPhone()}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile', {
              name: getUserName(),
              email: getUserEmail(),
              phone: getUserPhone(),
            })}>
              <Ionicons name="pencil" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('History')}>
              <Text style={styles.statValue}>47</Text>
              <Text style={styles.statLabel}>Total Rides</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4.8</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Payment', { initialTab: 'history' })}>
              <Text style={styles.statValue}>₹2,340</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGridRow}>
            <TouchableOpacity style={styles.actionButtonGrid} onPress={() => navigation.navigate('ScheduleRide')}>
              <View style={styles.actionIcon}>
                <Ionicons name="time" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.actionText}>{`Schedule\nRide`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonGrid} onPress={() => navigation.navigate('History')}>
              <View style={styles.actionIcon}>
                <Ionicons name="receipt" size={24} color={Colors.accent} />
              </View>
              <Text style={styles.actionText}>{`Ride\nHistory`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonGrid} onPress={() => navigation.getParent()?.navigate('Offers')}>
              <View style={styles.actionIcon}>
                <Ionicons name="gift" size={24} color={Colors.coral} />
              </View>
              <Text style={styles.actionText}>{`View\nOffers`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonGrid} onPress={() => navigation.navigate('HelpSupport')}>
              <View style={styles.actionIcon}>
                <Ionicons name="help-circle" size={24} color={Colors.info} />
              </View>
              <Text style={styles.actionText}>{`Get\nSupport`}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          {profileOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.menuItem}
              onPress={() => handleOptionPress(option.screen)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={Colors.gray600}
                />
                <Text style={styles.menuItemText}>{option.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  notificationButton: {
    padding: Layout.spacing.sm,
  },
  content: {
    flex: 1,
    paddingBottom: Layout.buttonHeight + Layout.spacing.xl + Layout.spacing.lg, // Increased padding for tab bar
  },
  profileCard: {
    backgroundColor: Colors.gray100, // light grey card
    margin: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  profilePhotoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.gray300, // slightly darker grey
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.xs,
  },
  profileEmail: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Layout.spacing.xs,
  },
  profilePhone: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Layout.spacing.lg,
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
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
  },
  quickActions: {
    backgroundColor: Colors.gray100, // match card
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
  sectionTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.md,
  },
  actionGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButtonGrid: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  actionText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  menuContainer: {
    backgroundColor: Colors.gray100, // match card
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    marginLeft: Layout.spacing.md,
    fontSize: Layout.fontSize.md,
    color: Colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.xl + Layout.spacing.xl, // Much more bottom margin for better spacing
    borderRadius: Layout.borderRadius.lg,
    paddingVertical: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutText: {
    marginLeft: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
});
