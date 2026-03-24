import { call, put, takeLatest } from 'redux-saga/effects';
import * as Contacts from 'expo-contacts';
import {
    syncContactsRequest,
    setDeviceContacts,
    syncContactsSuccess,
    syncContactsFailure,
} from '../slices/contactsSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';
import { getNormalizedNumbers, normalizePhoneNumber } from '../../utils/contactUtils';

// ─── API Call ─────────────────────────────────────────────────────────────────

const apiSyncContacts = async (numbers: string[]): Promise<string[]> => {
    console.log('[ContactsSaga] Syncing numbers:', numbers.length);
    const response = await API.post()(Path.CONTACTS_SYNC, {
        phone_numbers: numbers,
    });
    console.log('[ContactsSaga] API Response:', response);
    // Expecting response to be an array of matched phone numbers or an object containing it
    // Based on the prompt: "matchedNumbers = await syncContacts(numbers);"
    return response as string[];
};

// ─── Saga Handler ─────────────────────────────────────────────────────────────

function* handleSyncContacts(): Generator<any, any, any> {
    try {
        // 1. Request Permissions
        const { status } = yield call(Contacts.requestPermissionsAsync);
        if (status !== 'granted') {
            yield put(syncContactsFailure('Permission to access contacts was denied'));
            return;
        }

        // 2. Fetch Device Contacts
        const { data } = yield call(Contacts.getContactsAsync, {
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        });

        if (!data || data.length === 0) {
            console.log('[ContactsSaga] No contacts found on device');
            yield put(syncContactsSuccess({
                appUsers: [],
                inviteUsers: [],
            }));
            return;
        }

        // 3. Set Device Contacts immediately (before sync)
        const sortFn = (a: Contacts.Contact, b: Contacts.Contact) =>
            (a.name || '').localeCompare(b.name || '');

        yield put(setDeviceContacts({
            deviceContacts: data,
            inviteUsers: [...data].sort(sortFn),
        }));

        // 4. Normalize Numbers for API
        const normalizedNumbers = getNormalizedNumbers(data);

        // 5. Call API to get matched users
        const matchedNumbers: string[] = yield call(apiSyncContacts, normalizedNumbers);
        const matchedSet = new Set(matchedNumbers);

        // 6. Categorize Contacts
        const appUsers: Contacts.Contact[] = [];
        const inviteUsersRefined: Contacts.Contact[] = [];

        data.forEach((contact: Contacts.Contact) => {
            let matched = false;
            if (contact.phoneNumbers) {
                for (const p of contact.phoneNumbers) {
                    if (p.number) {
                        const normalized = normalizePhoneNumber(p.number);
                        if (normalized && matchedSet.has(normalized)) {
                            matched = true;
                            break;
                        }
                    }
                }
            }

            if (matched) {
                appUsers.push(contact);
            } else {
                inviteUsersRefined.push(contact);
            }
        });

        // 7. Update with Refined lists
        yield put(syncContactsSuccess({
            appUsers: appUsers.sort(sortFn),
            inviteUsers: inviteUsersRefined.sort(sortFn),
        }));

    } catch (error: any) {
        console.error('[ContactsSaga] error:', error);
        const message = error?.errors
            ? (Array.isArray(error.errors) ? error.errors.join(', ') : error.errors)
            : error?.message || 'Failed to sync contacts';
        yield put(syncContactsFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchContactsSaga() {
    yield takeLatest(syncContactsRequest.type, handleSyncContacts);
}
