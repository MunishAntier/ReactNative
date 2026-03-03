import AsyncStorage from '@react-native-async-storage/async-storage';

import type {AuthTokens} from '../types';

const storageKey = 'securemsg.auth.tokens';

export class TokenVault {
  async save(tokens: AuthTokens): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(tokens));
  }

  async load(): Promise<AuthTokens | null> {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(storageKey);
  }
}
