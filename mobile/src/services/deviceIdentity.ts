/**
 * Device Identity Service
 *
 * Fetches the hardware device ID (IDFV on iOS, Android ID on Android)
 * using react-native-device-info and persists it securely in the
 * OS Keychain (iOS) / Keystore (Android) via react-native-keychain.
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Keychain from 'react-native-keychain';

const DEVICE_IDENTITY_SERVICE = 'securemsg_device_identity';

export interface DeviceIdentity {
    hardwareDeviceId: string;
    platform: 'ios' | 'android';
}

/**
 * Initialise and persist device identity on app launch.
 *
 * 1. Checks the Keychain for an already-stored identity.
 * 2. If not found, fetches the hardware ID + platform and stores them.
 * 3. Returns the identity.
 */
export async function initDeviceIdentity(): Promise<DeviceIdentity> {
    try {
        // Try to load from Keychain first
        const existing = await getDeviceIdentity();
        if (existing) {
            console.log('[DeviceIdentity] Found cached device identity:', existing);
            return existing;
        }
    } catch {
        // No cached identity — fall through to create one
    }

    // Fetch the hardware device ID
    // getUniqueId() returns IDFV on iOS, Android ID on Android
    const hardwareDeviceId = await DeviceInfo.getUniqueId();
    const platform = Platform.OS as 'ios' | 'android';

    const identity: DeviceIdentity = { hardwareDeviceId, platform };

    // Store in Keychain / Keystore
    await Keychain.setGenericPassword(
        'device_identity',
        JSON.stringify(identity),
        {
            service: DEVICE_IDENTITY_SERVICE,
            accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        },
    );

    console.log('[DeviceIdentity] Stored device identity:', identity);
    return identity;
}

/**
 * Read-only accessor — retrieves the stored device identity from Keychain.
 * Returns null if nothing has been stored yet.
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity | null> {
    try {
        const creds = await Keychain.getGenericPassword({
            service: DEVICE_IDENTITY_SERVICE,
        });
        if (creds && typeof creds === 'object' && 'password' in creds && creds.password) {
            return JSON.parse(creds.password) as DeviceIdentity;
        }
    } catch {
        // Keychain access failed
    }
    return null;
}
