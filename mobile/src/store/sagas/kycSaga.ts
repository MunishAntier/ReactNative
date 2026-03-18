import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import { submitKycRequest, submitKycSuccess, submitKycFailure } from '../slices/registerSlice';

// Mock API Call
const apiSubmitKyc = (data: any) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ status: 'success' }), 1000);
    });
};

function* handleSubmitKyc(action: PayloadAction<any>): Generator<any, any, any> {
    try {
        yield call(apiSubmitKyc, action.payload);
        yield put(submitKycSuccess());
    } catch (error: any) {
        yield put(submitKycFailure(error.message));
    }
}

export function* watchKycSaga() {
    yield takeLatest(submitKycRequest.type, handleSubmitKyc);
}
