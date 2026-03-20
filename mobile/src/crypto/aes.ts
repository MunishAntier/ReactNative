import 'react-native-get-random-values';
import AES from 'react-native-aes-gcm-crypto';
import { Buffer } from 'buffer';

export const encryptAESGCM = async (
  key: Uint8Array,
  plaintext: Uint8Array
) => {
  // Library generates IV internally
  const result = await AES.encrypt(
    Buffer.from(plaintext).toString('base64'),
    true, // inBinary = true
    Buffer.from(key).toString('base64')
  );

  return {
    iv: result.iv,
    ciphertext: result.content,
    authTag: result.tag,
  };
};
