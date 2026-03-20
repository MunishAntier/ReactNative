import { call, put, takeLatest } from 'redux-saga/effects';
import { fetchProfileRequest, fetchProfileSuccess, fetchProfileFailure } from '../slices/profileSlice';

// Mock API Call
const apiFetchProfile = () => {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ username: 'user123', email: 'user@example.com' }), 1000);
    });
};

function* handleFetchProfile(): Generator<any, any, any> {
    try {
        const response = yield call(apiFetchProfile);
        yield put(fetchProfileSuccess(response));
    } catch (error: any) {
        yield put(fetchProfileFailure(error.message));
    }
}

export function* watchProfileSaga() {
    yield takeLatest(fetchProfileRequest, handleFetchProfile);
}
