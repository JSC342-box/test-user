import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TITLE_COLOR } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { logger } from '../../utils/logger';

export default function AboutScreen({ navigation }: any) {
  const [tapCount, setTapCount] = useState(0);
  const [showDeveloperTools, setShowDeveloperTools] = useState(false);

  const handleAppNameTap = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);
    
    if (newTapCount >= 3) {
      setShowDeveloperTools(true);
      setTapCount(0);
      Alert.alert('Developer Mode', 'Developer tools unlocked!');
    }
  };

  const handleDeveloperToolPress = async (toolType: 'apk' | 'connection' | 'payment') => {
    if (toolType === 'apk') {
      try {
        logger.debug('🚀 Initializing APK connection...');
        const { testAPKInitialization } = require('../../utils/socketTest');
        
        // Show loading alert
        Alert.alert('APK Initialization', 'Initializing APK connection... Please wait.');
        
        const result = await testAPKInitialization();
        
        if (result.success) {
          const message = `APK initialization successful!\n\nDuration: ${result.duration}ms\nInitial State: ${result.initialStatus.connectionState}\nFinal State: ${result.finalStatus.connectionState}\nStability: ${result.stabilityStatus.connected ? 'Connected' : 'Disconnected'}`;
          Alert.alert('Success', message);
        } else {
          Alert.alert('Error', `Failed to initialize APK connection.\n\nError: ${result.error}\n\nCheck logs for details.`);
        }
      } catch (error: any) {
        console.error('❌ APK initialization failed:', error);
        Alert.alert('Error', `Failed to initialize APK connection.\n\nError: ${error.message}\n\nCheck logs for details.`);
      }
    } else if (toolType === 'connection') {
      const { getDetailedConnectionStatus, forceReconnect, debugSocketConnection } = require('../../utils/socket');
      const { quickTest, quickTestAPK } = require('../../utils/socketTest');
      
      // Show loading alert
      Alert.alert('Running Tests...', 'Please wait while we test the connection...');
      
      try {
        // Get current socket status
        const status = getDetailedConnectionStatus();
        logger.debug('🔍 Current Socket Status:', status);
        
        // Run connection tests
        logger.debug('🔧 Running connection tests...');
        const result = await quickTest();
        logger.debug('📊 Quick test result:', result);
        
        const apkResult = await quickTestAPK();
        logger.debug('📊 APK Quick test result:', apkResult);
        
        // Run APK-specific debug if in production
        let apkDebugResult = null;
        if (!__DEV__) {
          const { debugAPKConnection } = require('../../utils/socketTest');
          apkDebugResult = await debugAPKConnection();
          logger.debug('📊 APK Debug result:', apkDebugResult);
        }
        
        // Run detailed socket debug
        debugSocketConnection();
        
        // Show comprehensive results
        const apkDebugInfo = apkDebugResult ? `\n\n🔧 APK Debug:\n• Server: ${apkDebugResult.tests?.serverReachability?.success ? '✅ OK' : '❌ FAIL'}\n• Socket: ${apkDebugResult.tests?.socketConnection?.success ? '✅ OK' : '❌ FAIL'}\n• Events: ${apkDebugResult.tests?.eventCommunication?.success ? '✅ OK' : '❌ FAIL'}` : '';
        
        Alert.alert(
          'Connection Analysis',
          `📊 Current Status:\nSocket: ${status.socketExists ? 'Exists' : 'Null'}\nConnected: ${status.connected}\nState: ${status.connectionState}\nID: ${status.id}\nTransport: ${status.transport}\n\n🧪 Test Results:\nRegular Test:\n• Server: ${result.serverReachable ? '✅ OK' : '❌ FAIL'}\n• Socket: ${result.socketConnected ? '✅ OK' : '❌ FAIL'}\n\nAPK Test:\n• Server: ${apkResult.serverReachable ? '✅ OK' : '❌ FAIL'}\n• Socket: ${apkResult.socketConnected ? '✅ OK' : '❌ FAIL'}${apkDebugInfo}`,
          [
            {
              text: 'Force Reconnect',
              onPress: async () => {
                try {
                  logger.debug('🔄 Force reconnecting socket...');
                  const { initializeAPKConnection } = require('../../utils/socket');
                  await initializeAPKConnection();
                  Alert.alert('Success', 'Socket reconnected successfully!');
                } catch (error: any) {
                  console.error('❌ Force reconnect failed:', error);
                  Alert.alert('Error', 'Failed to reconnect socket. Check logs for details.');
                }
              }
            },
            {
              text: 'Detailed Test',
              onPress: () => navigation.navigate('ConnectionTest')
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } catch (error) {
        console.error('❌ Connection analysis failed:', error);
        Alert.alert('Error', 'Failed to analyze connection. Check logs for details.');
      }
    } else if (toolType === 'payment') {
      // Navigate to live payment test screen
      navigation.navigate('LivePaymentTest');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color={TITLE_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About RoQet</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleAppNameTap} activeOpacity={0.7}>
          <Text style={styles.appName}>Roqet</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Version 1.0.0</Text>
        <Text style={styles.description}>
          Roqet is your trusted partner for safe, reliable, and affordable transportation. Experience the future of ride-sharing with our innovative platform that connects you with professional pilots for seamless journeys across the city.
        </Text>
        
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Why Choose Roqet?</Text>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Safe & Reliable Transportation</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="time" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>24/7 Service Availability</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="card" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Transparent Pricing</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="star" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Professional Pilots</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Contact & Support</Text>
        <Text style={styles.info}>Email: support@roqet.com</Text>
        <Text style={styles.info}>Phone: +1 234 567 8900</Text>
        <Text style={styles.info}>Website: www.roqet.com</Text>
        
        <Text style={styles.sectionTitle}>Developed by</Text>
        <Text style={styles.info}>Md Samiuddin - Lead Developer</Text>
        <Text style={styles.info}>G.Sree Swetha - Frontend Developer</Text>
        <Text style={styles.info}>N.Sony - Frontend Developer</Text>
        <Text style={styles.info}>S.Pavani - Frontend Developer</Text>
        <Text style={styles.info}>J.Arun Kumar - Frontend Developer</Text>
        <Text style={styles.info}>D.Ugendear - Frontend Developer</Text>
        <Text style={styles.info}>T.Shankar Reddy - Backend Developer</Text>
        <Text style={styles.info}>V.Vineeth Kumar - Tester</Text>
        <Text style={styles.info}>K.Gowri Sahithi - Tester</Text>
        <Text style={styles.info}>V.Harika - Devops</Text>
        <Text style={styles.info}>M.Rathna Kumari - Devops</Text>

        {/* Hidden Developer Tools */}
        {showDeveloperTools && (
          <View style={styles.developerSection}>
            <Text style={styles.developerTitle}>🔧 Developer Tools</Text>
            <View style={styles.developerButtons}>
              {!__DEV__ && (
                <TouchableOpacity 
                  style={[styles.developerButton, { backgroundColor: Colors.warning }]} 
                  onPress={() => handleDeveloperToolPress('apk')}
                >
                  <Ionicons name="rocket" size={16} color={Colors.white} />
                  <Text style={styles.developerButtonText}>APK Init</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.developerButton} 
                onPress={() => handleDeveloperToolPress('connection')}
              >
                <Ionicons name="bug" size={16} color={Colors.white} />
                <Text style={styles.developerButtonText}>Test Connection</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.developerButton, { backgroundColor: Colors.coral }]} 
                onPress={() => handleDeveloperToolPress('payment')}
              >
                <Ionicons name="card" size={16} color={Colors.white} />
                <Text style={styles.developerButtonText}>Live Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  backButton: {
    padding: Layout.spacing.xs,
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
  appName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Layout.spacing.sm,
    textAlign: 'center',
  },
  version: {
    fontSize: Layout.fontSize.sm,
    color: Colors.gray500,
    marginBottom: Layout.spacing.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: Layout.fontSize.md,
    color: Colors.gray700,
    marginBottom: Layout.spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: TITLE_COLOR,
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
  },
  featureText: {
    fontSize: Layout.fontSize.md,
    color: Colors.gray700,
    marginLeft: Layout.spacing.sm,
  },
  info: {
    fontSize: Layout.fontSize.md,
    color: Colors.gray700,
    marginBottom: Layout.spacing.sm,
    textAlign: 'center',
  },
  developerSection: {
    marginTop: Layout.spacing.xl,
    paddingTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  developerTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Layout.spacing.md,
    textAlign: 'center',
  },
  developerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Layout.spacing.sm,
  },
  developerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.md,
    gap: Layout.spacing.xs,
  },
  developerButtonText: {
    color: Colors.white,
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
  },
}); 
