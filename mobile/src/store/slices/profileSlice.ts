import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProfileState {
    profileData: any | null;
    loading: boolean;
    error: string | null;
}

const initialState: ProfileState = {
    profileData: null,
    loading: false,
    error: null,
};

const profileSlice = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        fetchProfileRequest: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchProfileSuccess: (state, action: PayloadAction<any>) => {
            state.loading = false;
            state.profileData = action.payload;
        },
        fetchProfileFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const { fetchProfileRequest, fetchProfileSuccess, fetchProfileFailure } = profileSlice.actions;
export default profileSlice.reducer;
