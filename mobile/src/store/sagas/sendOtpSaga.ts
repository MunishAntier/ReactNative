import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import {
    sendOtpRequest,
    sendOtpSuccess,
    sendOtpFailure,
    SendOtpPayload,
    SendOtpResponse,
} from '../slices/sendOtpSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';

// ─── API Call ─────────────────────────────────────────────────────────────────

const apiSendOtp = async (payload: SendOtpPayload): Promise<SendOtpResponse> => {
    console.log('API SendOTP Payload:', payload);
    const response = await API.post()(Path.SEND_OTP, payload);
    console.log('API SendOTP Response:', response);
    return response as SendOtpResponse;
};

// ─── Saga Handler ─────────────────────────────────────────────────────────────

function* handleSendOtp(action: PayloadAction<SendOtpPayload>): Generator<any, any, any> {
    try {
        const response: SendOtpResponse = yield call(apiSendOtp, action.payload);
        yield put(sendOtpSuccess(response));
    } catch (error: any) {
        console.error('[SendOtpSaga] OTP error:', JSON.stringify(error));
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'Failed to send OTP. Please try again.');
        yield put(sendOtpFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchSendOtpSaga() {
    yield takeLatest(sendOtpRequest.type, handleSendOtp);
}
