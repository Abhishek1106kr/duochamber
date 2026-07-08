import { useState, useEffect } from 'react';

interface EncryptedImageProps {
  src: string;
  nonce: string;
  aesKey: CryptoKey;
  mimeType: string;
}

export function EncryptedImage({ src, nonce, aesKey, mimeType }: EncryptedImageProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    
    async function loadAndDecrypt() {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('Failed to fetch encrypted image');
        const blob = await res.blob();
        
        const { decryptFile } = await import('../crypto/imageCrypto.js');
        const url = await decryptFile(blob, nonce, aesKey, mimeType);
        currentUrl = url;
        setDecryptedUrl(url);
      } catch (err) {
        console.error('Error loading/decrypting image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    
    loadAndDecrypt();
    
    // Cleanup Object URL on unmount to prevent browser memory leaks
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [src, nonce, aesKey, mimeType]);

  if (loading) {
    return (
      <div className="typing-dots" style={{ padding: '10px' }}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    );
  }
  
  if (error) {
    return <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Failed to decrypt image</div>;
  }
  
  return (
    <img 
      src={decryptedUrl!} 
      className="shared-image" 
      alt="Encrypted Shared Content" 
      onClick={() => window.open(decryptedUrl!)} 
    />
  );
}
