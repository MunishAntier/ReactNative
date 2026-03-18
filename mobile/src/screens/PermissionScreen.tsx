import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RESULTS } from 'react-native-permissions';
import { permissionManager } from '../services/PermissionManager';
import { MANDATORY_PERMISSIONS, PERMISSION_LABELS } from '../constants/PermissionConfig';

interface Props {
    onFinished: () => void;
}

const PermissionScreen: React.FC<Props> = ({ onFinished }) => {
    const [statuses, setStatuses] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        refreshStatuses();
    }, []);

    const refreshStatuses = async () => {
        const results: Record<string, any> = {};
        for (const p of MANDATORY_PERMISSIONS) {
            results[p] = await permissionManager.checkPermission(p);
        }

        const { status: notificationStatus } = await permissionManager.checkNotifications();
        results['notifications'] = notificationStatus;

        if (Platform.OS === 'ios' && !results['phone_calls']) {
            results['phone_calls'] = RESULTS.GRANTED;
        }

        setStatuses(results);
        setIsLoading(false);
    };

    const handleRequest = async (permission: any) => {
        if (Platform.OS === 'ios' && permission === 'phone_calls') return;

        const result = await permissionManager.requestPermission(permission);
        refreshStatuses();

        if (result === RESULTS.BLOCKED) {
            permissionManager.openSettings();
        }
    };

    const handleContinue = async () => {
        const isReady = await permissionManager.checkAllMandatory();
        if (isReady) {
            onFinished();
        }
    };

    const renderPermissionTile = (id: string, labelData?: any) => {
        const label = labelData || PERMISSION_LABELS[id];
        if (!label) return null;

        const isGranted = statuses[id] === RESULTS.GRANTED;

        return (
            <View key={id} style={styles.tileWrapper}>
                <TouchableOpacity
                    style={styles.tile}
                    onPress={() => !isGranted && handleRequest(id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.cutTopLeft} />
                    <View style={styles.cutTopLeftLine} />
                    <View style={styles.cutBottomRight} />
                    <View style={styles.cutBottomRightLine} />

                    <Text style={styles.tileTitle}>{label.title}</Text>

                    <View style={[styles.iconBox, isGranted && styles.iconBoxGranted]}>
                        <Ionicons
                            name={label.icon as any}
                            size={20}
                            color="#1a1a1a"
                        />
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    if (isLoading) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Allow Permission</Text>

                    <Text style={styles.subtitle}>
                        Please allow the required permissions to continue using the app smoothly and securely.
                        Your data remains private and protected at all times.
                    </Text>
                </View>

                <View style={styles.list}>
                    {renderPermissionTile('notifications')}

                    {MANDATORY_PERMISSIONS
                        .filter(p => String(p).includes('CONTACTS'))
                        .map(p => renderPermissionTile(p))}

                    {Platform.OS === 'android'
                        ? MANDATORY_PERMISSIONS
                            .filter(p => String(p).includes('CALL_PHONE'))
                            .map(p => renderPermissionTile(p))
                        : renderPermissionTile('phone_calls', {
                            title: 'Phone calls',
                            icon: 'call-outline',
                        })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.notNowBtn} disabled={true}>
                    <Text style={styles.notNowText}>Not Now</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueButtonText}>Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E9EDF0',
    },

    content: {
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 24,
    },

    header: {
        marginBottom: 40,
    },

    title: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 32,
        color: '#070707',
        marginBottom: 12,
        letterSpacing: -0.5,
    },

    subtitle: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 14,
        color: '#606060',
        lineHeight: 20,
    },

    list: {
        gap: 12,
    },

    tileWrapper: {
        position: 'relative',
    },

    tile: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        backgroundColor: '#E9EDF0',
        borderWidth: 1,
        borderColor: '#8BA0FC',
        height: 72,
        position: 'relative',
    },

    cutTopLeft: {
        position: 'absolute',
        width: 14,
        height: 14,
        backgroundColor: '#E9EDF0',
        left: -1,
        top: -1,
    },

    cutTopLeftLine: {
        position: 'absolute',
        width: 20,
        height: 1,
        backgroundColor: '#8BA0FC',
        left: -3,
        top: 6,
        transform: [{ rotate: '-45deg' }],
    },

    cutBottomRight: {
        position: 'absolute',
        width: 14,
        height: 14,
        backgroundColor: '#E9EDF0',
        right: -1,
        bottom: -1,
    },

    cutBottomRightLine: {
        position: 'absolute',
        width: 20,
        height: 1,
        backgroundColor: '#8BA0FC',
        right: -3,
        bottom: 6,
        transform: [{ rotate: '-45deg' }],
    },

    tileTitle: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 20,
        color: '#070707',
    },

    iconBox: {
        width: 54,
        height: 54,
        backgroundColor: '#FCFDFD',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    iconBoxGranted: {
        backgroundColor: '#E2E5E8',
    },

    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        paddingTop: 16,
        backgroundColor: 'transparent',
    },

    notNowBtn: {
        paddingVertical: 12,
    },

    notNowText: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 16,
        color: '#070707',
        textDecorationLine: 'underline',
    },

    continueButton: {
        backgroundColor: '#070707',
        width: 181,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 1,
    },

    continueButtonText: {
        fontFamily: 'ClashDisplay-Regular',
        color: '#FCFDFD',
        fontSize: 17,
        textAlign: 'center',
    },
});

export default PermissionScreen;