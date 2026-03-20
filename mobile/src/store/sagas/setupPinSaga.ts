import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import {
    setupPinRequest,
    setupPinSuccess,
    setupPinFailure,
    SetupPinPayload,
} from '../slices/setupPinSlice';
import { API } from '../../hooks/api';
import Path from '../../constants/endpoint';

// ─── API Call ─────────────────────────────────────────────────────────────────

const apiSetupPin = async (payload: SetupPinPayload): Promise<any> => {
    console.log('[SetupPinSaga] API Payload:', payload);
    const response = await API.post()(Path.SETUP_PIN, payload);
    console.log('[SetupPinSaga] API Response:', response);
    return response;
};

// ─── Saga Handler ─────────────────────────────────────────────────────────────

function* handleSetupPin(action: PayloadAction<SetupPinPayload>): Generator<any, any, any> {
    try {
        const response = yield call(apiSetupPin, action.payload);
        yield put(setupPinSuccess(response));
    } catch (error: any) {
        console.error('[SetupPinSaga] error:', JSON.stringify(error));
        const message =
            error?.message ||
            error?.error ||
            (typeof error === 'string' ? error : 'PIN setup failed. Please try again.');
        yield put(setupPinFailure(message));
    }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function* watchSetupPinSaga() {
    yield takeLatest(setupPinRequest, handleSetupPin);
}
