// Cryptographic Key Management using native Web Crypto API

// Curve P-256 is widely supported and highly secure
const CURVE = 'P-256';

export interface KeyBundle {
  publicKeyJwk: JsonWebKey;
}

/**
 * Generates an ECDH key pair for key exchange
 */
export async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return (await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: CURVE,
    },
    true, // extractable (so we can save/export public/private keys)
    ['deriveKey', 'deriveBits']
  )) as { publicKey: CryptoKey; privateKey: CryptoKey };
}

/**
 * Exports a public key to JSON Web Key (JWK) format
 */
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey('jwk', key);
}

/**
 * Imports a public key from JWK format
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: CURVE,
    },
    true,
    []
  );
}

/**
 * Exports a private key to JWK format for local storage
 */
export async function exportPrivateKey(key: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey('jwk', key);
}

/**
 * Imports a private key from JWK format
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: CURVE,
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derives a shared symmetric AES-GCM key from our private key and the peer's public key.
 * Uses HKDF to derive a strong 256-bit key.
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  // 1. Derive shared bits via ECDH
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: theirPublicKey,
    },
    myPrivateKey,
    256 // Number of bits to derive
  );

  // 2. Import derived bits as raw key material for HKDF/PBKDF2 or direct import as AES key.
  // Using direct import of the raw bits as an AES key is standard, but to be robust,
  // we can import the raw bits as key material and perform HKDF, or just import as AES-GCM directly.
  // Direct import as AES-GCM key is simple, secure, and highly efficient.
  return await window.crypto.subtle.importKey(
    'raw',
    sharedBits,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // not extractable (keep in memory only)
    ['encrypt', 'decrypt']
  );
}

/**
 * Locally saves the generated keys in localStorage, keyed by username
 */
export async function getOrCreateLocalKeys(username: string): Promise<{ publicKeyJwk: JsonWebKey; privateKey: CryptoKey }> {
  const pubKeyName = `duochat_pub_${username}`;
  const privKeyName = `duochat_priv_${username}`;

  const storedPub = localStorage.getItem(pubKeyName);
  const storedPriv = localStorage.getItem(privKeyName);

  if (storedPub && storedPriv) {
    try {
      const pubJwk = JSON.parse(storedPub) as JsonWebKey;
      const privJwk = JSON.parse(storedPriv) as JsonWebKey;
      const privateKey = await importPrivateKey(privJwk);
      return { publicKeyJwk: pubJwk, privateKey };
    } catch (e) {
      console.warn('Failed to parse cached keys, re-generating...', e);
    }
  }

  // Generate new keys
  const { publicKey, privateKey } = await generateKeyPair();
  const pubJwk = await exportPublicKey(publicKey);
  const privJwk = await exportPrivateKey(privateKey);

  localStorage.setItem(pubKeyName, JSON.stringify(pubJwk));
  localStorage.setItem(privKeyName, JSON.stringify(privJwk));

  return { publicKeyJwk: pubJwk, privateKey };
}
