import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import {
    registerRequest,
    registerSuccess,
    registerFailure,
    RegisterPayload,
    RegisterResponse,
} from '../slices/registerSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';

// ─── API Call ─────────────────────────────────────────────────────────────────

const apiRegister = async (payload: RegisterPayload): Promise<RegisterResponse> => {
    console.log('API Register Payload:', payload);
    const response = await API.post()(Path.REGISTER, payload);
    console.log('API Register Response:', response);
    return response as RegisterResponse;
};

// ─── Saga Handler ─────────────────────────────────────────────────────────────

function* handleRegister(action: PayloadAction<RegisterPayload>): Generator<any, any, any> {
    try {
        const response: RegisterResponse = yield call(apiRegister, action.payload);
        yield put(registerSuccess(response));
    } catch (error: any) {
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'Registration failed. Please try again.');
        yield put(registerFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchRegisterSaga() {
    yield takeLatest(registerRequest.type, handleRegister);
}
