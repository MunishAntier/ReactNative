import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import profileReducer from './slices/profileSlice';
import registerReducer from './slices/registerSlice';
import sendOtpReducer from './slices/sendOtpSlice';
import verifyOtpReducer from './slices/verifyOtpSlice';
import setupPinReducer from './slices/setupPinSlice';
import contactsReducer from './slices/contactsSlice';

const rootReducer = combineReducers({
    auth: authReducer,
    profile: profileReducer,
    register: registerReducer,
    sendOtp: sendOtpReducer,
    verifyOtp: verifyOtpReducer,
    setupPin: setupPinReducer,
    contacts: contactsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
