import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TITLE_COLOR } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { useAuth } from '@clerk/clerk-expo';
import { userApi, UserProfile } from '../../services/userService';

export default function PersonalDetailsScreen({ route, navigation }: any) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  // Load user profile on component mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  // Reload profile when returning from edit screen
  useEffect(() => {
    if (route.params?.updatedProfile) {
      setUserProfile(route.params.updatedProfile);
      console.log('✅ Personal Details: Profile updated from EditProfileScreen');
    }
  }, [route.params?.updatedProfile]);

  const loadUserProfile = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      console.log('🔄 Loading user profile for Personal Details...');
      
      const profile = await userApi.getCurrentUser(getToken);
      
      console.log('✅ User profile loaded:', profile);
      
      setUserProfile(profile);
      
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      setError('Failed to load profile data. Please try again.');
      
      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load profile data. Please check your internet connection and try again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadUserProfile(true);
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile', { userProfile });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '-';
    // Format Indian phone numbers
    if (phone.startsWith('+91')) {
      return phone.replace('+91', '+91 ');
    }
    return phone;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="person-circle" size={32} color={TITLE_COLOR} />
          <Text style={styles.headerTitle}>Personal Details</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading profile data...</Text>
        </View>
      </View>
    );
  }

  if (error && !userProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="person-circle" size={32} color={TITLE_COLOR} />
          <Text style={styles.headerTitle}>Personal Details</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadUserProfile()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="person-circle" size={32} color={TITLE_COLOR} />
        <Text style={styles.headerTitle}>Personal Details</Text>
        <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 40 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.photoContainer}>
          {userProfile?.profilePhoto ? (
            <Image source={{ uri: userProfile.profilePhoto }} style={styles.photo} />
          ) : (
            <Ionicons name="person" size={80} color={Colors.gray400} />
          )}
          <Text style={styles.userName}>
            {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Loading...'}
          </Text>
          <Text style={styles.userType}>
            {userProfile?.userType === 'customer' ? 'Customer' : 'User'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Full Name:</Text>
            <Text style={styles.value}>
              {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : '-'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{userProfile?.email || '-'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Phone Number:</Text>
            <Text style={styles.value}>{formatPhoneNumber(userProfile?.phoneNumber)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>{formatDate(userProfile?.dateOfBirth)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Gender:</Text>
            <Text style={styles.value}>{userProfile?.gender || '-'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Preferred Language:</Text>
            <Text style={styles.value}>{userProfile?.preferredLanguage || 'English'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Emergency Contact Name:</Text>
            <Text style={styles.value}>{userProfile?.emergencyContactName || '-'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Emergency Contact Phone:</Text>
            <Text style={styles.value}>{formatPhoneNumber(userProfile?.emergencyContactPhone)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>User ID:</Text>
            <Text style={styles.value}>{userProfile?.id || '-'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Registration Date:</Text>
            <Text style={styles.value}>{formatDate(userProfile?.registrationDate)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Account Status:</Text>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: userProfile?.isActive ? Colors.success : Colors.error }
              ]}>
                <Text style={styles.statusText}>
                  {userProfile?.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              {userProfile?.isVerified && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.info }]}>
                  <Text style={styles.statusText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Referral Code:</Text>
            <Text style={styles.value}>{userProfile?.referralCode || '-'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Statistics</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Total Rides:</Text>
            <Text style={styles.value}>{userProfile?.totalRides || 0}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Rating:</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={Colors.accent} />
              <Text style={styles.ratingText}>{userProfile?.rating || 0}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Wallet Balance:</Text>
            <Text style={styles.value}>₹{userProfile?.walletBalance || 0}</Text>
          </View>
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
  content: {
    flex: 1,
    padding: Layout.spacing.lg,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: Layout.spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontSize: Layout.fontSize.md,
    color: TITLE_COLOR,
    fontWeight: '600',
  },
  value: {
    fontSize: Layout.fontSize.md,
    color: Colors.gray700,
    marginLeft: 8,
    flex: 1,
    textAlign: 'right',
  },
  editButton: {
    padding: Layout.spacing.sm,
  },
  userName: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Layout.spacing.sm,
    textAlign: 'center',
  },
  userType: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Layout.spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.spacing.md,
    marginTop: Layout.spacing.lg,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 4,
    borderRadius: Layout.borderRadius.sm,
  },
  statusText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: Layout.spacing.xs,
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
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
}); 