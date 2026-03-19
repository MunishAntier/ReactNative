import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendOtpPayload {
    phone_number: string;
    device_id: string;
    device_type: string;
}

export interface SendOtpResponse {
    [key: string]: any;
}

interface SendOtpState {
    loading: boolean;
    error: string | null;
    response: SendOtpResponse | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: SendOtpState = {
    loading: false,
    error: null,
    response: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const sendOtpSlice = createSlice({
    name: 'sendOtp',
    initialState,
    reducers: {
        sendOtpRequest: (state, _action: PayloadAction<SendOtpPayload>) => {
            state.loading = true;
            state.error = null;
            state.response = null;
        },
        sendOtpSuccess: (state, action: PayloadAction<SendOtpResponse>) => {
            state.loading = false;
            state.response = action.payload;
        },
        sendOtpFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
        sendOtpReset: () => initialState,
    },
});

export const { sendOtpRequest, sendOtpSuccess, sendOtpFailure, sendOtpReset } =
    sendOtpSlice.actions;
export default sendOtpSlice.reducer;
