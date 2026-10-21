import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

const DEFAULT_AVATAR = '/default-avatar.svg';

export const Avatar: React.FC<AvatarProps> = ({ src, name = '', size = 40, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = src && failedSrc !== src ? src : DEFAULT_AVATAR;

  return (
    <img
      src={imageSrc}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src || DEFAULT_AVATAR)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
};