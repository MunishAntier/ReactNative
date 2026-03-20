import 'react-native-get-random-values';

export const generateDEK = (): Uint8Array => {
  return global.crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
};
