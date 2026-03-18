/**
 * Centralized configuration for the mobile app.
 *
 * All backend URLs are defined here so they can be changed in one place
 * when deploying to staging/production.
 */

// Backend API base URL — change this when deploying to a real server
export const API_BASE_URL = 'http://127.0.0.1:8080/v1';

// WebSocket URL — change this when deploying to a real server
export const WS_URL = 'ws://127.0.0.1:8080/v1/ws';
