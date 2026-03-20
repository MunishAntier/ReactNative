const Path: Record<string, string> = {
    REGISTER: '/identity/users',
    SEND_OTP: '/identity/sessions',
    VERIFY_OTP: '/identity/sessions/verify',
    SETUP_PIN: '/account/pin/setup',
}

export default Path;