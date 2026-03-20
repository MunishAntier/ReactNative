import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SetupPinPayload {
    kdf_salt: string;
    kdf_params: {
        iterations: number;
        memory: number;
        parallelism: number;
        key_length: number;
    };
    pin_verifier: string;
    wrapped_dek_by_pin: string;
    registration_lock_enabled: boolean;
    vault_version: number;
    recovery_items: Array<{
        item_type: string;
        encrypted_blob: string;
    }>;
}

interface SetupPinState {
    loading: boolean;
    error: string | null;
    success: boolean;
}

const initialState: SetupPinState = {
    loading: false,
    error: null,
    success: false,
};

const setupPinSlice = createSlice({
    name: 'setupPin',
    initialState,
    reducers: {
        setupPinRequest: (state, _action: PayloadAction<SetupPinPayload>) => {
            state.loading = true;
            state.error = null;
            state.success = false;
        },
        setupPinSuccess: (state) => {
            state.loading = false;
            state.success = true;
        },
        setupPinFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
        resetSetupPinState: (state) => {
            state.loading = false;
            state.error = null;
            state.success = false;
        },
    },
});

export const {
    setupPinRequest,
    setupPinSuccess,
    setupPinFailure,
    resetSetupPinState,
} = setupPinSlice.actions;

export default setupPinSlice.reducer;
