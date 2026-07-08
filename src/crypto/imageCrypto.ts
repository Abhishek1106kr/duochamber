import { arrayBufferToBase64 } from './encrypt.js';
import { base64ToArrayBuffer } from './decrypt.js';

/**
 * Encrypts a File client-side using the derived AES-GCM key
 */
export async function encryptFile(
  file: File,
  aesKey: CryptoKey
): Promise<{ encryptedBlob: Blob; nonce: string }> {
  // 1. Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // 2. Generate random 12-byte IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt file contents
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    fileBuffer
  );

  // 4. Wrap the encrypted ArrayBuffer inside a Blob
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
  const nonce = arrayBufferToBase64(iv.buffer);

  return {
    encryptedBlob,
    nonce,
  };
}

/**
 * Decrypts an encrypted file Blob client-side and returns a viewable URL
 */
export async function decryptFile(
  encryptedBlob: Blob,
  nonceBase64: string,
  aesKey: CryptoKey,
  targetMimeType: string = 'image/jpeg'
): Promise<string> {
  // 1. Read blob as ArrayBuffer
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  const iv = new Uint8Array(base64ToArrayBuffer(nonceBase64));

  // 2. Decrypt file contents
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encryptedBuffer
  );

  // 3. Create a secure local Object URL pointing to decrypted contents
  const decryptedBlob = new Blob([decryptedBuffer], { type: targetMimeType });
  return URL.createObjectURL(decryptedBlob);
}
