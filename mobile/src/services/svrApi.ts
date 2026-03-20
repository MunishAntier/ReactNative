import axios from 'axios';

// Based on the project's API base URL found in other modules
const API_BASE_URL = 'https://api-chat.devnet.invest.net/api/v1/signal';

export const sendSvrPayload = async (payload: any) => {
  return axios.post(`${API_BASE_URL}/account/pin/setup`, payload);
};
