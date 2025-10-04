import { Linking, Platform, Alert } from 'react-native';
import { logger } from './logger';

/**
 * Opens the app store for rating the app
 * On Android: Opens Google Play Store
 * On iOS: Opens App Store
 */
export const openAppStoreForRating = async (): Promise<void> => {
  try {
    const packageName = 'com.roqet.roqetapp'; // From app.json
    let storeUrl: string;

    if (Platform.OS === 'android') {
      // Try to open the app directly in Play Store
      storeUrl = `market://details?id=${packageName}`;
      
      // Check if Play Store app is available
      const canOpen = await Linking.canOpenURL(storeUrl);
      
      if (canOpen) {
        await Linking.openURL(storeUrl);
        logger.debug('✅ Opened Play Store for rating');
      } else {
        // Fallback to web browser if Play Store app is not available
        const webUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
        await Linking.openURL(webUrl);
        logger.debug('✅ Opened Play Store in browser for rating');
      }
    } else if (Platform.OS === 'ios') {
      // For iOS, you would need the App Store ID
      // This is a placeholder - you'll need to replace with actual App Store ID
      const appStoreId = 'YOUR_APP_STORE_ID'; // Replace with actual App Store ID
      storeUrl = `itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`;
      
      const canOpen = await Linking.canOpenURL(storeUrl);
      
      if (canOpen) {
        await Linking.openURL(storeUrl);
        logger.debug('✅ Opened App Store for rating');
      } else {
        // Fallback to web browser
        const webUrl = `https://apps.apple.com/app/id${appStoreId}?action=write-review`;
        await Linking.openURL(webUrl);
        logger.debug('✅ Opened App Store in browser for rating');
      }
    } else {
      // Web or other platforms
      Alert.alert(
        'Rate App',
        'Thank you for wanting to rate our app! Please visit your app store to leave a review.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    logger.error('❌ Error opening app store for rating:', error);
    
    // Show fallback alert
    Alert.alert(
      'Rate App',
      'Unable to open the app store. Please search for "Roqet" in your app store to leave a review.',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Shows a rating prompt with options
 */
export const showRatingPrompt = (): void => {
  Alert.alert(
    'Rate Roqet',
    'Enjoying the app? We\'d love to hear your feedback!',
    [
      {
        text: 'Not Now',
        style: 'cancel',
      },
      {
        text: 'Rate App',
        onPress: openAppStoreForRating,
      },
    ],
    { cancelable: true }
  );
};
