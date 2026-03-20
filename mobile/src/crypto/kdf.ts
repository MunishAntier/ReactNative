import argon2id from 'react-native-argon2';
import { Buffer } from 'buffer';

export const deriveKeyFromPin = async (
  pin: string,
  salt: Uint8Array,
  params: any
): Promise<Uint8Array> => {
  // react-native-argon2 expects salt as a string (hex recommended for binary data)
  const result = await argon2id(pin, Buffer.from(salt).toString('hex'), {
    memory: params.memory,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: params.key_length,
    saltEncoding: 'hex',
  });

  // rawHash is a hex string (usually)
  return new Uint8Array(Buffer.from(result.rawHash, 'hex'));
};
