import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type ProfileAvatarHoverPreviewProps = {
  /** Public path e.g. `/uploads/avatars/…` */
  avatarUrl?: string | null;
  initials: string;
  className?: string;
  /** Classes for the small Avatar root (e.g. `h-8 w-8` or `h-20 w-20`) */
  avatarClassName?: string;
  /** Enlarged preview size */
  previewClassName?: string;
  /** Optional classes for the small avatar initials fallback */
  fallbackClassName?: string;
};

/**
 * Hover the avatar to see a larger preview (image or initials). Preview is shown below the avatar
 * so it is not clipped by the app’s overflow-hidden layout.
 */
export function ProfileAvatarHoverPreview({
  avatarUrl,
  initials,
  className,
  avatarClassName,
  previewClassName = 'h-44 w-44 min-h-44 min-w-44 sm:h-48 sm:w-48 sm:min-h-48 sm:min-w-48',
  fallbackClassName,
}: ProfileAvatarHoverPreviewProps) {
  const compactAvatar = Boolean(avatarClassName?.includes('h-8') || avatarClassName?.includes('size-8'));

  return (
    <span className={cn('group/avatarPreview relative inline-flex shrink-0', className)}>
      <Avatar className={avatarClassName}>
        <AvatarImage src={avatarUrl ?? undefined} className="object-cover" />
        <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'pointer-events-none absolute left-1/2 top-full z-[200] w-max -translate-x-1/2 -translate-y-1.5',
          'scale-95 opacity-0 transition-all duration-150 ease-out',
          'group-hover/avatarPreview:pointer-events-auto group-hover/avatarPreview:scale-100 group-hover/avatarPreview:opacity-100',
        )}
        role="presentation"
      >
        <span
          className={cn(
            'block overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1.5',
            'shadow-2xl ring-1 ring-black/5',
            'dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10',
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className={cn('rounded-lg object-cover', previewClassName)}
              draggable={false}
            />
          ) : (
            <div
              className={cn(
                'flex items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700',
                'dark:bg-slate-800 dark:text-slate-200',
                previewClassName,
                compactAvatar ? 'text-3xl' : 'text-5xl',
              )}
            >
              {initials}
            </div>
          )}
        </span>
      </span>
    </span>
  );
}
