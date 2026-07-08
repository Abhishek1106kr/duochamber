import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';

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
        let blob: Blob;
        
        // If it looks like a relative/absolute HTTP path, fetch normally.
        // Otherwise, download from Supabase Storage 'uploads' bucket.
        if (src.startsWith('/') || src.startsWith('http')) {
          const res = await fetch(src);
          if (!res.ok) throw new Error('Failed to fetch encrypted image');
          blob = await res.blob();
        } else {
          const { data, error: storageErr } = await supabase.storage
            .from('uploads')
            .download(src);
          if (storageErr || !data) throw new Error(storageErr?.message || 'Storage download error');
          blob = data;
        }
        
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
