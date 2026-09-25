'use client';

import { useEffect, useState } from 'react';
import { cn, initials, normalizeMediaUrl } from '@/shared/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-10 h-10 text-xs',
  xl: 'w-16 h-16 text-xl',
};

const RING_CLASSES: Record<Size, string> = {
  xs: 'ring-0',
  sm: 'ring-0',
  md: 'ring-0',
  lg: 'ring-2 ring-border',
  xl: 'ring-2 ring-border',
};

interface Props {
  /** Any object with avatar/full_name/email/first_name/last_name. */
  user?: {
    avatar?: string | null;
    full_name?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  size?: Size;
  className?: string;
  /** Show online status dot. */
  online?: boolean;
}

/**
 * Renders the user's avatar image if available.
 * Falls back to initials if the image is missing or fails to load.
 */
export function UserAvatar({
  user,
  size = 'md',
  className,
  online = false,
}: Props) {
  const [imgError, setImgError] = useState(false);

  // Reset error state when the user changes
  useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);

  const name =
    user?.full_name ||
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() ||
    user?.email ||
    '?';

  const fixedUrl = user?.avatar ? normalizeMediaUrl(user.avatar) : null;
  const showImage = !!fixedUrl && !imgError;

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center',
          SIZE_CLASSES[size],
          RING_CLASSES[size],
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fixedUrl!}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-bold text-primary">{initials(name)}</span>
        )}
      </div>

      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-emerald-500 border-2 border-card',
            size === 'xl' ? 'w-4 h-4' : size === 'xs' ? 'w-2 h-2' : 'w-3 h-3',
          )}
        />
      )}
    </div>
  );
}