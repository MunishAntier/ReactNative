import { all, fork } from 'redux-saga/effects';
import { watchAuthSaga } from './authSaga';
import { watchProfileSaga } from './profileSaga';
import { watchRegisterSaga } from './registerSaga';
import { watchSendOtpSaga } from './sendOtpSaga';
import { watchVerifyOtpSaga } from './verifyOtpSaga';

export default function* rootSaga() {
    yield all([
        fork(watchAuthSaga),
        fork(watchProfileSaga),
        fork(watchRegisterSaga),
        fork(watchSendOtpSaga),
        fork(watchVerifyOtpSaga),
        // fork(otherSaga1),
        // fork(otherSaga2),
        // ... total 25 sagas
    ]);
}
