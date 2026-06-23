import { useState, useRef, useCallback } from 'react';

export function useImageUpload() {
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPendingImage({ data: base64, mimeType: file.type, preview: URL.createObjectURL(file) });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const clearImage = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  }, [pendingImage]);

  return { pendingImage, fileInputRef, handleImageSelect, clearImage };
}
