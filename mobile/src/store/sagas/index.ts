import { all, fork } from 'redux-saga/effects';
import { watchAuthSaga } from './authSaga';
import { watchProfileSaga } from './profileSaga';
import { watchKycSaga } from './kycSaga';

export default function* rootSaga() {
    yield all([
        fork(watchAuthSaga),
        fork(watchProfileSaga),
        fork(watchKycSaga),
        // fork(otherSaga1),
        // fork(otherSaga2),
        // ... total 25 sagas
    ]);
}
