/**
 * Converts a Base64 string to an ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decrypts a ciphertext Base64 string using an AES-GCM CryptoKey and nonce
 */
export async function decryptText(
  ciphertextBase64: string,
  nonceBase64: string,
  aesKey: CryptoKey
): Promise<string> {
  // 1. Convert Base64 formats back to ArrayBuffers
  const encryptedBuffer = base64ToArrayBuffer(ciphertextBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(nonceBase64));

  // 2. Decrypt via Web Crypto API
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encryptedBuffer
  );

  // 3. Decode byte array back to plaintext string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
