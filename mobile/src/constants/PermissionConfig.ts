import { Platform } from 'react-native';
import { PERMISSIONS, Permission } from 'react-native-permissions';

/**
 * List of permissions that are absolutely required for the app to function.
 * Note: NOTIFICATIONS are handled separately in iOS due to library design.
 */
export const MANDATORY_PERMISSIONS: Permission[] = Platform.select({
    ios: [
        // PERMISSIONS.IOS.CAMERA,
        PERMISSIONS.IOS.CONTACTS,
        // PERMISSIONS.IOS.NOTIFICATIONS does not exist in v5.
        // It's handled via checkNotifications / requestNotifications
    ],
    android: [
        // PERMISSIONS.ANDROID.CAMERA,
        PERMISSIONS.ANDROID.READ_CONTACTS,
        PERMISSIONS.ANDROID.CALL_PHONE,
    ],
}) || [];

export const PERMISSION_LABELS: Record<string, { title: string; description: string; icon: string }> = {
    [PERMISSIONS.IOS.CAMERA]: {
        title: 'Camera Access',
        description: 'Needed to take photos for your profile and messages.',
        icon: 'camera-outline',
    },
    [PERMISSIONS.ANDROID.CAMERA]: {
        title: 'Camera Access',
        description: 'Needed to take photos for your profile and messages.',
        icon: 'camera-outline',
    },
    [PERMISSIONS.IOS.CONTACTS]: {
        title: 'Contacts',
        description: 'Sync your contacts to find friends.',
        icon: 'person-outline',
    },
    [PERMISSIONS.ANDROID.READ_CONTACTS]: {
        title: 'Contacts',
        description: 'Sync your contacts to find friends.',
        icon: 'person-outline',
    },
    [PERMISSIONS.ANDROID.CALL_PHONE]: {
        title: 'Phone calls',
        description: 'Enable making calls directly from the app.',
        icon: 'call-outline',
    },
    'notifications': {
        title: 'Notifications',
        description: 'Stay updated with new messages and alerts.',
        icon: 'notifications-outline',
    },
};