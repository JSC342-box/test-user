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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { logger } from '../../utils/logger';
import { useFocusEffect } from '@react-navigation/native';
import { userApi } from '../../services/userService';
import { useTranslation } from 'react-i18next';

const getProfileOptions = (t: any) => [
  {
    id: '0',
    title: t('common.personalInformation'),
    icon: 'person-circle-outline',
    screen: 'PersonalDetails',
  },
  {
    id: '1',
    title: t('common.privacySecurity'),
    icon: 'shield-checkmark-outline',
    screen: 'PrivacySecurity',
  },
  {
    id: '2',
    title: t('common.settings'),
    icon: 'settings-outline',
    screen: 'Settings',
  },
  {
    id: '3',
    title: t('common.about'),
    icon: 'information-circle-outline',
    screen: 'About',
  },
];

export default function ProfileScreen({ navigation }: any) {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const { t } = useTranslation();
  
  const getUserPhoto = () => {
    return user?.imageUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
  };

  const [profilePhoto] = useState(getUserPhoto());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Fetch user profile data when screen comes into focus
      const fetchUserProfile = async () => {
        // Prevent multiple simultaneous calls
        if (isLoadingProfile) {
          logger.debug('⏳ Profile loading already in progress, skipping...');
          return;
        }

        try {
          setIsLoadingProfile(true);
          logger.debug('🔄 Loading user profile for Profile tab...');
          
          const profile = await userApi.getCurrentUser(getToken);
          setUserProfile(profile);
          
          logger.debug('✅ User profile loaded for Profile tab:', profile);
        } catch (error) {
          console.error('❌ Error loading user profile for Profile tab:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      };

      fetchUserProfile();

    }, [])
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
    } else if (screen === 'Settings') {
      navigation.navigate('Settings');
    } else if (screen === 'About') {
      navigation.navigate('About');
    } else if (screen === 'PrivacySecurity') {
      navigation.navigate('PrivacySecurity');
    } else {
      logger.debug(`Navigate to ${screen}`);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to Logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error log out:', error);
            }
          },
        },
      ]
    );
  };

  const getUserName = () => {
    // Use backend data if available, fallback to Clerk user data
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`;
    } else if (userProfile?.firstName) {
      return userProfile.firstName;
    } else if (user?.firstName && user?.lastName) {
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
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileCard}>
          {/* Profile Header with Gradient Background */}
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.profileInfo}>
              <View style={styles.profilePhotoWrapper}>
                <Image
                  source={{ uri: profilePhoto }}
                  style={styles.profilePhoto}
                />
                <View style={styles.photoStatusIndicator} />
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{getUserName()}</Text>
                <View style={styles.verificationBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.verificationText}>Verified</Text>
                </View>
                {getUserEmail() && (
                  <View style={styles.contactInfo}>
                    <Ionicons name="mail-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.profileEmail}>{getUserEmail()}</Text>
                  </View>
                )}
                {getUserPhone() && (
                  <View style={styles.contactInfo}>
                    <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.profilePhone}>{getUserPhone()}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.rideHistoryBadge} onPress={() => navigation.navigate('History')}>
                  <Ionicons name="bicycle" size={16} color={Colors.white} />
                  <Text style={styles.rideHistoryText}>{userProfile?.totalRides || 0} Rides</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('ComingSoon')}>
              <LinearGradient
                colors={['#9ca3af', '#6b7280']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryActionGradient}
              >
                <View style={styles.primaryActionContent}>
                  <View style={styles.primaryActionIcon}>
                    <Ionicons name="time" size={24} color={Colors.white} />
                  </View>
                  <View style={styles.primaryActionText}>
                    <Text style={styles.primaryActionTitle}>{t('home.scheduleRide')}</Text>
                    <Text style={styles.primaryActionSubtitle}>Coming Soon</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.secondaryActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.getParent()?.navigate('Offers')}>
                <View style={styles.secondaryActionIcon}>
                  <Ionicons name="gift" size={20} color={Colors.coral} />
                </View>
                <Text style={styles.secondaryActionText}>{t('home.viewOffers')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('HelpSupport')}>
                <View style={styles.secondaryActionIcon}>
                  <Ionicons name="help-circle" size={20} color={Colors.info} />
                </View>
                <Text style={styles.secondaryActionText}>{t('support.getSupport')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          {getProfileOptions(t).map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.menuItem,
                index === getProfileOptions(t).length - 1 && styles.lastMenuItem
              ]}
              onPress={() => handleOptionPress(option.screen)}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuIconWrapper}>
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.menuItemText}>{option.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>



        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <View style={styles.logoutContent}>
            <View style={styles.logoutIconWrapper}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            </View>
            <Text style={styles.logoutText}>{t('auth.logout')}</Text>
          </View>
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
  content: {
    flex: 1,
    paddingBottom: Layout.buttonHeight + Layout.spacing.xl + Layout.spacing.lg, // Increased padding for tab bar
  },
  profileCard: {
    backgroundColor: Colors.white,
    margin: Layout.spacing.lg,
    borderRadius: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  profileHeader: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profilePhotoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  profilePhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  photoStatusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  profileDetails: {
    flex: 1,
    paddingTop: Layout.spacing.xs,
  },
  profileName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Layout.spacing.xs,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: Layout.spacing.sm,
  },
  verificationText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.xs,
  },
  profileEmail: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: Layout.spacing.xs,
  },
  profilePhone: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: Layout.spacing.xs,
  },
  rideHistoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: Layout.spacing.sm,
  },
  rideHistoryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: 6,
  },
  quickActions: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    borderRadius: 20,
    padding: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.lg,
  },
  actionsContainer: {
    gap: Layout.spacing.md,
  },
  primaryAction: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionGradient: {
    padding: Layout.spacing.lg,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  primaryActionText: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 2,
  },
  primaryActionSubtitle: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: Layout.spacing.md,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: 16,
    padding: Layout.spacing.md,
  },
  secondaryActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryActionText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  menuContainer: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    borderRadius: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  menuItemText: {
    fontSize: Layout.fontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.xl + Layout.spacing.xl,
    borderRadius: 20,
    paddingVertical: Layout.spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.error + '20',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  logoutText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
});
