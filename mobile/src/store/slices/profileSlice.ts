import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
    encrypted_name: string;
    encrypted_bio?: string;
    encrypted_avatar?: string;
}

export interface UpdateProfileResponse {
    [key: string]: any;
}

export interface UserInfoResponse {
    [key: string]: any;
}

interface ProfileState {
    loading: boolean;
    error: string | null;
    response: UpdateProfileResponse | null;
    // user info (GET on mount)
    userInfo: UserInfoResponse | null;
    userInfoLoading: boolean;
    userInfoError: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: ProfileState = {
    loading: false,
    error: null,
    response: null,
    userInfo: null,
    userInfoLoading: false,
    userInfoError: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const profileSlice = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        // ── Update Profile ────────────────────────────────────────────────
        updateProfileRequest: (state, _action: PayloadAction<UpdateProfilePayload>) => {
            state.loading = true;
            state.error = null;
            state.response = null;
        },
        updateProfileSuccess: (state, action: PayloadAction<UpdateProfileResponse>) => {
            state.loading = false;
            state.response = action.payload;
        },
        updateProfileFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
        updateProfileReset: (state) => {
            state.loading = false;
            state.error = null;
            state.response = null;
        },

        // ── Fetch User Info ───────────────────────────────────────────────
        fetchUserInfoRequest: (state) => {
            state.userInfoLoading = true;
            state.userInfoError = null;
        },
        fetchUserInfoSuccess: (state, action: PayloadAction<UserInfoResponse>) => {
            state.userInfoLoading = false;
            state.userInfo = action.payload;
        },
        fetchUserInfoFailure: (state, action: PayloadAction<string>) => {
            state.userInfoLoading = false;
            state.userInfoError = action.payload;
        },
        fetchUserInfoReset: (state) => {
            state.userInfo = null;
            state.userInfoLoading = false;
            state.userInfoError = null;
        },
    },
});

export const {
    updateProfileRequest, updateProfileSuccess, updateProfileFailure, updateProfileReset,
    fetchUserInfoRequest, fetchUserInfoSuccess, fetchUserInfoFailure, fetchUserInfoReset,
} = profileSlice.actions;
export default profileSlice.reducer;
