import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import {
    verifyOtpRequest,
    verifyOtpSuccess,
    verifyOtpFailure,
    VerifyOtpPayload,
    VerifyOtpResponse,
} from '../slices/verifyOtpSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';

// ─── API Call ─────────────────────────────────────────────────────────────────

const apiVerifyOtp = async (payload: VerifyOtpPayload): Promise<VerifyOtpResponse> => {
    console.log('API VerifyOTP Payload:', payload);
    const response = await API.post()(Path.VERIFY_OTP, payload);
    console.log('API VerifyOTP Response:', response);
    return response as VerifyOtpResponse;
};

// ─── Saga Handler ─────────────────────────────────────────────────────────────

function* handleVerifyOtp(action: PayloadAction<VerifyOtpPayload>): Generator<any, any, any> {
    try {
        const response: VerifyOtpResponse = yield call(apiVerifyOtp, action.payload);
        yield put(verifyOtpSuccess(response));
    } catch (error: any) {
        console.error('[VerifyOtpSaga] error:', JSON.stringify(error));
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'Verification failed. Please try again.');
        yield put(verifyOtpFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchVerifyOtpSaga() {
    yield takeLatest(verifyOtpRequest, handleVerifyOtp);
}
