import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface RequestOptions {
    url: string;
    method: string;
    body?: any;
}

export interface RequestConfig {
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    responseType?: string;
}

// React Native often uses process.env.EXPO_PUBLIC_ for public variables if using Expo 
// We'll default to an empty string to avoid crashes.
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export const messagesMap: Record<string, string> = {
    // Add mapping here as needed for your app
};

export const notifyError = (title: string, message: string) => {
    Alert.alert(title, message);
};

export const removeSession = async (theme: string | null) => {
    try {
        const keys = ["phiVisitedOnce", "maxUploadSize", "communityVisitedOnce"];
        await AsyncStorage.multiRemove(keys);
        if (theme) {
            await AsyncStorage.setItem("theme", theme);
        }
    } catch (e) {
        console.error("Failed to remove session keys", e);
    }
};

const makeRequest = async (
    options: RequestOptions,
    config: RequestConfig = {},
    baseUrl?: string,
) => {
    const isExternal = options.url.startsWith("http");
    const defaultConfig: RequestConfig = isExternal
        ? { headers: {}, credentials: config.credentials || "omit" }
        : {
            headers: {
                "Content-Type": "application/json",
            } as Record<string, string>,
            credentials: "include",
        };

    // FormData/Blob handling in React Native
    let isFormData = false;
    if (options.body && options.body.append) {
        // Poor man's check for FormData
        isFormData = true;
    } else if (options.body && options.body._data && options.body._data.blobId) {
        // Poor man's check for RN Blob
        isFormData = true;
    }

    if (isFormData && defaultConfig.headers) {
        // When using FormData, let the browser/fetch set the appropriate Content-Type with boundary
        delete defaultConfig.headers["Content-Type"];
    }

    const mergedConfig = {
        ...defaultConfig,
        ...config,
        headers: {
            ...defaultConfig.headers,
            ...config.headers,
        },
    };

    const apiBaseUrl = baseUrl || DEFAULT_API_URL;

    const fullUrl = options.url.startsWith("http")
        ? options.url
        : `${apiBaseUrl}${options.url}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
        method: options.method,
        headers: mergedConfig.headers,
        credentials: mergedConfig.credentials as RequestCredentials,
    };

    if (options.body) {
        fetchOptions.body = isFormData ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: `Request failed with status ${response.status}` };
        }

        if (errorData?.message === "authz.invalid_session") {
            notifyError("Error", "Session has expired.");
            await AsyncStorage.setItem("phiVisitedOnce", "false");
            await AsyncStorage.setItem("maxUploadSize", "false");
            await AsyncStorage.setItem("communityVisitedOnce", "false");
            const theme = await AsyncStorage.getItem("theme");
            await removeSession(theme);
        } else if (
            !Array.isArray(errorData?.message) &&
            errorData?.message?.startsWith("authz.restrict")
        ) {
            notifyError("Error", "Access denied.");
        } else if (errorData?.message === "authz.invalid_permission") {
            notifyError("Error", "Permission denied.");
        }
        throw errorData;
    }

    if (config.responseType === "blob") {
        return response;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        return { success: true, status: response.status };
    }

    // Handle JSON responses
    const data = await response.json();
    if (data.message && messagesMap[data.message]) {
        data.message = messagesMap[data.message];
    }
    return data;
};

// Exporting as API utility object matching the provided snippet
export const API = {
    get: (config?: RequestConfig, baseUrl?: string) => async (url: string) =>
        makeRequest(
            {
                method: "GET",
                url,
            },
            config,
            baseUrl,
        ),
    post:
        (config?: RequestConfig, baseUrl?: string) =>
            async (url: string, body: any) =>
                makeRequest(
                    {
                        method: "POST",
                        body,
                        url,
                    },
                    config,
                    baseUrl,
                ),
    put:
        (config?: RequestConfig, baseUrl?: string) =>
            async (url: string, body: any) =>
                makeRequest(
                    {
                        method: "PUT",
                        body,
                        url,
                    },
                    config,
                    baseUrl,
                ),
    delete:
        (config?: RequestConfig, baseUrl?: string) =>
            async (url: string, body: any) =>
                makeRequest(
                    {
                        method: "DELETE",
                        body,
                        url,
                    },
                    config,
                    baseUrl,
                ),
    patch:
        (config?: RequestConfig, baseUrl?: string) =>
            async (url: string, body: any) =>
                makeRequest(
                    {
                        method: "PATCH",
                        body,
                        url,
                    },
                    config,
                    baseUrl,
                ),
};

export default API;
