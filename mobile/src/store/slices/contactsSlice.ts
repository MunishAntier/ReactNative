import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as Contacts from 'expo-contacts';

export interface ContactsState {
    deviceContacts: Contacts.Contact[];
    appUsers: Contacts.Contact[];
    inviteUsers: Contacts.Contact[];
    loading: boolean;
    error: string | null;
}

const initialState: ContactsState = {
    deviceContacts: [],
    appUsers: [],
    inviteUsers: [],
    loading: false,
    error: null,
};

const contactsSlice = createSlice({
    name: 'contacts',
    initialState,
    reducers: {
        syncContactsRequest: (state) => {
            state.loading = true;
            state.error = null;
        },
        setDeviceContacts: (
            state,
            action: PayloadAction<{
                deviceContacts: Contacts.Contact[];
                inviteUsers: Contacts.Contact[];
            }>
        ) => {
            state.deviceContacts = action.payload.deviceContacts;
            state.inviteUsers = action.payload.inviteUsers;
            state.error = null;
        },
        syncContactsSuccess: (
            state,
            action: PayloadAction<{
                appUsers: Contacts.Contact[];
                inviteUsers: Contacts.Contact[];
            }>
        ) => {
            state.loading = false;
            state.appUsers = action.payload.appUsers;
            state.inviteUsers = action.payload.inviteUsers;
            state.error = null;
        },
        syncContactsFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const {
    syncContactsRequest,
    setDeviceContacts,
    syncContactsSuccess,
    syncContactsFailure,
} = contactsSlice.actions;

export default contactsSlice.reducer;
