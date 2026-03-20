import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import {
    updateProfileRequest,
    updateProfileSuccess,
    updateProfileFailure,
    UpdateProfilePayload,
    UpdateProfileResponse,
    fetchUserInfoRequest,
    fetchUserInfoSuccess,
    fetchUserInfoFailure,
    UserInfoResponse,
} from '../slices/profileSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';

// ─── Update Profile API Call (POST) ───────────────────────────────────────────

const apiUpdateProfile = async (payload: UpdateProfilePayload): Promise<UpdateProfileResponse> => {
    console.log('API UpdateProfile Payload:', payload);
    const response = await API.post()(Path.UPDATE_PROFILE, payload);
    console.log('API UpdateProfile Response:', response);
    return response as UpdateProfileResponse;
};

function* handleUpdateProfile(action: PayloadAction<UpdateProfilePayload>): Generator<any, any, any> {
    try {
        const response: UpdateProfileResponse = yield call(apiUpdateProfile, action.payload);
        yield put(updateProfileSuccess(response));
    } catch (error: any) {
        console.error('[ProfileSaga] updateProfile error:', JSON.stringify(error));
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'Profile update failed. Please try again.');
        yield put(updateProfileFailure(message));
    }
}

// ─── Fetch User Info API Call (GET) ───────────────────────────────────────────

const apiFetchUserInfo = async (): Promise<UserInfoResponse> => {
    console.log('API FetchUserInfo: GET', Path.USER_INFO);
    const response = await API.get()(Path.USER_INFO);
    console.log('API FetchUserInfo Response:', response);
    return response as UserInfoResponse;
};

function* handleFetchUserInfo(): Generator<any, any, any> {
    try {
        const response: UserInfoResponse = yield call(apiFetchUserInfo);
        yield put(fetchUserInfoSuccess(response));
    } catch (error: any) {
        console.error('[ProfileSaga] fetchUserInfo error:', JSON.stringify(error));
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'Failed to fetch user info.');
        yield put(fetchUserInfoFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchProfileSaga() {
    yield takeLatest(updateProfileRequest, handleUpdateProfile);
    yield takeLatest(fetchUserInfoRequest, handleFetchUserInfo);
}
