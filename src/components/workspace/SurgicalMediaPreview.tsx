import React, { useEffect, useRef } from 'react';

interface SurgicalMediaProps {
  src: string;
  type: 'image' | 'video';
  className?: string;
}

export const SurgicalMediaPreview: React.FC<SurgicalMediaProps> = ({ src, type, className }) => {
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      // THE SURGICAL FLUSH: Prevent OOM on HP OMEN hardware
      if (src && src.startsWith('blob:')) {
        window.URL.revokeObjectURL(src);
      }
      if (mediaRef.current) {
        mediaRef.current.src = '';
        if (mediaRef.current instanceof HTMLVideoElement) {
          mediaRef.current.load();
        }
        mediaRef.current.remove();
      }
    };
  }, [src]);

  if (type === 'video') {
    return (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={src}
        className={className}
        autoPlay
        loop
        muted
        playsInline
      />
    );
  }

  return (
    <img
      ref={mediaRef as React.RefObject<HTMLImageElement>}
      src={src}
      className={className}
      alt="Surgical Preview"
    />
  );
};
