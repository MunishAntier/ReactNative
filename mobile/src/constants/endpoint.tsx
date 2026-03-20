const Path: Record<string, any> = {
    REGISTER: '/identity/users',
    SEND_OTP: '/identity/sessions',
    VERIFY_OTP: '/identity/sessions/verify',
    SETUP_PIN: '/account/pin/setup',
    REFRESH_TOKEN: '/identity/sessions/refresh',
    UPDATE_PROFILE: '/account/profile',
    USER_INFO: '/account/users/me',
}

export default Path;