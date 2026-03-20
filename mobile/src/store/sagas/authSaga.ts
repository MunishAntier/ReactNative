import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import { loginRequest, loginSuccess, loginFailure } from '../slices/authSlice';

// Mock API Call
const apiLogin = (data: { identifier: string }) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ id: 1, name: 'User' }), 1000);
    });
};

function* handleLogin(action: PayloadAction<{ identifier: string }>): Generator<any, any, any> {
    try {
        const response = yield call(apiLogin, action.payload);
        yield put(loginSuccess(response));
    } catch (error: any) {
        yield put(loginFailure(error.message));
    }
}

export function* watchAuthSaga() {
    yield takeLatest(loginRequest, handleLogin);
}
