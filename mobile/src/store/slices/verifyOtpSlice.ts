import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifyOtpPayload {
    phone_number: string;
    verification_code: string;
    device_id: string;
    device_type: string;
    device_token: string;
    registration_id: string;
}

export interface VerifyOtpResponse {
    access_token?: string;
    refresh_token?: string;
    [key: string]: any;
}

interface VerifyOtpState {
    loading: boolean;
    error: string | null;
    response: VerifyOtpResponse | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: VerifyOtpState = {
    loading: false,
    error: null,
    response: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const verifyOtpSlice = createSlice({
    name: 'verifyOtp',
    initialState,
    reducers: {
        verifyOtpRequest: (state, _action: PayloadAction<VerifyOtpPayload>) => {
            state.loading = true;
            state.error = null;
            state.response = null;
        },
        verifyOtpSuccess: (state, action: PayloadAction<VerifyOtpResponse>) => {
            state.loading = false;
            state.response = action.payload;
        },
        verifyOtpFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
        verifyOtpReset: () => initialState,
    },
});

export const { verifyOtpRequest, verifyOtpSuccess, verifyOtpFailure, verifyOtpReset } =
    verifyOtpSlice.actions;
export default verifyOtpSlice.reducer;
