import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import profileReducer from './slices/profileSlice';
import kycReducer from './slices/registerSlice';

const rootReducer = combineReducers({
    auth: authReducer,
    profile: profileReducer,
    kyc: kycReducer,
    // Add other 22 slice reducers here as they are created
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
