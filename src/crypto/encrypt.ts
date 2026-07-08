/**
 * Converts an ArrayBuffer to a Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Encrypts a plaintext string using an AES-GCM CryptoKey
 */
export async function encryptText(
  plaintext: string,
  aesKey: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  // 1. Generate a secure, random 12-byte IV (nonce) for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Encode string to byte array
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // 3. Encrypt via Web Crypto API
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    plaintextBytes
  );

  // 4. Return Base64 representations
  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    nonce: arrayBufferToBase64(iv.buffer),
  };
}
