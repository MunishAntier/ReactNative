const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64(bytes);
}

export function base64ToUtf8(value: string): string {
  const bytes = base64ToBytes(value);
  return new TextDecoder().decode(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  let index = 0;

  while (index < bytes.length) {
    const a = bytes[index++] ?? 0;
    const b = bytes[index++] ?? 0;
    const c = bytes[index++] ?? 0;

    const first = a >> 2;
    const second = ((a & 3) << 4) | (b >> 4);
    const third = ((b & 15) << 2) | (c >> 6);
    const fourth = c & 63;

    output += alphabet[first];
    output += alphabet[second];
    output += index - 1 <= bytes.length ? alphabet[third] : '=';
    output += index <= bytes.length ? alphabet[fourth] : '=';
  }

  return output;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];

  for (let index = 0; index < clean.length; index += 4) {
    const encodedA = alphabet.indexOf(clean[index] || 'A');
    const encodedB = alphabet.indexOf(clean[index + 1] || 'A');
    const encodedC = alphabet.indexOf(clean[index + 2] || 'A');
    const encodedD = alphabet.indexOf(clean[index + 3] || 'A');

    const a = (encodedA << 2) | (encodedB >> 4);
    const b = ((encodedB & 15) << 4) | (encodedC >> 2);
    const c = ((encodedC & 3) << 6) | encodedD;

    bytes.push(a);
    if ((clean[index + 2] || '=') !== '=') {
      bytes.push(b);
    }
    if ((clean[index + 3] || '=') !== '=') {
      bytes.push(c);
    }
  }

  return new Uint8Array(bytes);
}
