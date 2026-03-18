import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Simplified interfaces based on current project needs
export interface RequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
}

export type RequestCredentials = 'omit' | 'same-origin' | 'include';

export interface RequestConfig {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  responseType?: 'json' | 'blob';
}

const BASE_URL = process.env.BASE_API_URL

const notifyError = (title: string, message: string) => {
  Alert.alert(title, message);
};

const removeSession = async () => {
  await Promise.all([
    AsyncStorage.removeItem('access_token'),
    AsyncStorage.removeItem('refresh_token'),
    AsyncStorage.removeItem('user'),
  ]);
  // Handle logout navigation or state change here if needed
};

const messagesMap: Record<string, string> = {
  // Add mapping as needed
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

  if (
    options.body instanceof FormData ||
    options.body instanceof Blob ||
    options.body instanceof File
  ) {
    if (defaultConfig.headers) {
      delete defaultConfig.headers["Content-Type"];
    }
  }

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    headers: {
      ...defaultConfig.headers,
      ...config.headers,
    },
  };

  // Use the provided baseUrl or fall back to DEFAULT_API_URL
  const apiBaseUrl = baseUrl || BASE_URL;

  const fullUrl = options.url.startsWith("http")
    ? options.url
    : `${apiBaseUrl}${options.url}`;

  const response = await fetch(fullUrl, {
    method: options.method,
    headers: mergedConfig.headers,
    credentials: mergedConfig.credentials,
    body:
      options.body instanceof FormData || options.body instanceof Blob
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: `Request failed with status ${response.status}` };
    }

    if (errorData?.message === "authz.invalid_session") {
      notifyError("Error", "Session has expired.");
      await removeSession();
    } else if (
      !Array.isArray(errorData?.message) &&
      errorData?.message?.startsWith("authz.restrict")
    ) {
      notifyError("Error", "Access denied.");
    } else if (errorData?.message === "authz.invalid_permission") {
      notifyError("Error", "Permission denied");
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
  data.message = messagesMap[data.message] || data.message;
  return data;
};

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