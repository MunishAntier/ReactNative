import { Buffer } from 'buffer';

export const toBase64 = (data: Uint8Array | string) => {
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf-8').toString('base64');
  }
  return Buffer.from(data).toString('base64');
};

export const fromBase64 = (b64: string): Uint8Array => {
  return new Uint8Array(Buffer.from(b64, 'base64'));
};

export const toUtf8Bytes = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};
