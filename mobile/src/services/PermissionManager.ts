import { 
    check, 
    request, 
    RESULTS, 
    PermissionStatus, 
    checkNotifications, 
    requestNotifications,
    openSettings
} from 'react-native-permissions';
import { MANDATORY_PERMISSIONS } from '../constants/PermissionConfig';

class PermissionManager {
    /**
     * Checks if all mandatory hardware permissions and notifications are granted.
     */
    async checkAllMandatory(): Promise<boolean> {
        // 1. Check Standard Permissions
        for (const permission of MANDATORY_PERMISSIONS) {
            const status = await check(permission);
            if (status !== RESULTS.GRANTED) {
                return false;
            }
        }

        // 2. Check Notifications
        const { status: notificationStatus } = await checkNotifications();
        if (notificationStatus !== RESULTS.GRANTED) {
            return false;
        }

        return true;
    }

    /**
     * Request a specific permission
     */
    async requestPermission(permission: any): Promise<PermissionStatus> {
        if (permission === 'notifications') {
            const { status } = await requestNotifications(['alert', 'sound', 'badge']);
            return status;
        }
        return await request(permission);
    }

    /**
     * Check notification status only
     */
    async checkNotifications() {
        return await checkNotifications();
    }

    /**
     * Check a single generic permission
     */
    async checkPermission(permission: any): Promise<PermissionStatus> {
        if (permission === 'notifications') {
            const { status } = await checkNotifications();
            return status;
        }
        return await check(permission);
    }

    /**
     * Open App Settings
     */
    async openSettings() {
        await openSettings();
    }
}

export const permissionManager = new PermissionManager();