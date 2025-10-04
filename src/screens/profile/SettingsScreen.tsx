import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { useUser } from '@clerk/clerk-expo';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/LanguageContext';
import NotificationPreferencesService, { NotificationPreferences } from '../../services/notificationPreferencesService';
import NotificationService from '../../services/notificationService';
import { showRatingPrompt } from '../../utils/appRating';

export default function SettingsScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushNotifications: true,
    locationServices: true,
    lastUpdated: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  const preferencesService = NotificationPreferencesService.getInstance();
  const notificationService = NotificationService.getInstance();

  // Load preferences on component mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const currentPreferences = await preferencesService.getPreferences();
      setPreferences(currentPreferences);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      const updatedPreferences = await preferencesService.updatePreference(key, value);
      setPreferences(updatedPreferences);

      // Handle notification service changes
      if (key === 'pushNotifications') {
        await notificationService.onNotificationPreferenceChanged(value);
        
        if (value) {
          Alert.alert(
            t('common.success', 'Success'),
            t('common.notificationsEnabled', 'Notifications have been enabled. You will now receive ride updates and important alerts.'),
            [{ text: t('common.ok', 'OK') }]
          );
        } else {
          Alert.alert(
            t('common.notificationsDisabled', 'Notifications Disabled'),
            t('common.notificationsDisabledMessage', 'You will no longer receive push notifications. You can re-enable them anytime in settings.'),
            [{ text: t('common.ok', 'OK') }]
          );
        }
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('common.errorUpdatingSettings', 'Failed to update settings. Please try again.'),
        [{ text: t('common.ok', 'OK') }]
      );
    }
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

  const getUserPhoto = () => {
    return user?.imageUrl || '';
  };

  const getCurrentLanguageName = () => {
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'es': 'Español',
      'fr': 'Français',
      'hi': 'हिंदी',
      'ar': 'العربية'
    };
    return languageMap[currentLanguage] || currentLanguage.toUpperCase();
  };

  const settingSections = [
    {
      title: t('profile.preferences', 'Preferences'),
      items: [
        {
          icon: 'language-outline',
          title: t('profile.language'),
          subtitle: `Current: ${getCurrentLanguageName()}`,
          action: () => navigation.navigate('LanguageSettings'),
        },
        {
          icon: 'notifications-outline',
          title: t('common.pushNotifications'),
          subtitle: t('common.receiveRideUpdates'),
          toggle: true,
          value: preferences.pushNotifications,
          onToggle: (value: boolean) => handlePreferenceChange('pushNotifications', value),
        },
      ],
    },
    {
      title: t('support.helpSupport', 'Support'),
      items: [
        {
          icon: 'star-outline',
          title: t('common.rateApp'),
          subtitle: t('common.shareYourFeedback'),
          action: () => showRatingPrompt(),
        },
      ],
    },
    {
      title: t('profile.legal', 'Legal'),
      items: [
        {
          icon: 'document-text-outline',
          title: t('common.termsOfService'),
          subtitle: t('common.readTermsAndConditions'),
          action: () => logger.debug('Terms'),
        },
        {
          icon: 'share-outline',
          title: t('common.dataSharing'),
          subtitle: t('common.controlDataSharing'),
          action: () => logger.debug('Data Sharing'),
        },
      ],
    },
  ];

  const renderSettingItem = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.settingItem}
      onPress={item.action}
      disabled={item.toggle}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={item.icon} size={20} color={Colors.gray600} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <View style={styles.settingRight}>
        {item.toggle ? (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: Colors.gray300, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('navigation.settings')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>{t('navigation.settings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, itemIndex) => renderSettingItem(item, itemIndex))}
            </View>
          </View>
        ))}


        {/* Bottom Margin */}
        <View style={styles.bottomMargin} />
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.spacing.sm,
    marginHorizontal: Layout.spacing.lg,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Layout.spacing.lg,
    borderRadius: Layout.borderRadius.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  settingSubtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: Layout.spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
  },
  appVersion: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
  },
  appBuild: {
    fontSize: Layout.fontSize.xs,
    color: Colors.textLight,
    marginTop: Layout.spacing.xs,
  },
  bottomMargin: {
    height: Layout.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
});
