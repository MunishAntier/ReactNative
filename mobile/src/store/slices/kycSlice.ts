import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface KycState {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_SUBMITTED';
    loading: boolean;
    error: string | null;
}

const initialState: KycState = {
    status: 'NOT_SUBMITTED',
    loading: false,
    error: null,
};

const kycSlice = createSlice({
    name: 'kyc',
    initialState,
    reducers: {
        submitKycRequest: (state, action: PayloadAction<any>) => {
            state.loading = true;
            state.error = null;
        },
        submitKycSuccess: (state) => {
            state.loading = false;
            state.status = 'PENDING';
        },
        submitKycFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const { submitKycRequest, submitKycSuccess, submitKycFailure } = kycSlice.actions;
export default kycSlice.reducer;
