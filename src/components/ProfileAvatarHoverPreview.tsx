import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * When true, the large preview is portaled to `document.body` with fixed positioning
   * so it is not clipped by overflow scroll areas (e.g. data tables).
   */
  detachPreview?: boolean;
};

/**
 * Hover the avatar to see a larger preview (image or initials).
 * Default: preview is positioned below the avatar (CSS group hover).
 * With `detachPreview`: preview is fixed to the viewport via a portal (for dense layouts).
 */
export function ProfileAvatarHoverPreview({
  avatarUrl,
  initials,
  className,
  avatarClassName,
  previewClassName = 'h-44 w-44 min-h-44 min-w-44 sm:h-48 sm:w-48 sm:min-h-48 sm:min-w-48',
  fallbackClassName,
  detachPreview = false,
}: ProfileAvatarHoverPreviewProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalPos, setPortalPos] = useState({ top: 0, left: 0 });

  const compactAvatar = Boolean(
    avatarClassName?.includes('h-8') ||
      avatarClassName?.includes('size-8') ||
      avatarClassName?.includes('h-9') ||
      avatarClassName?.includes('w-9') ||
      avatarClassName?.includes('size-9'),
  );

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setPortalOpen(false);
      hideTimerRef.current = null;
    }, 140);
  }, [cancelHide]);

  const updatePortalPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPortalPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, []);

  const onWrapEnter = useCallback(() => {
    if (!detachPreview) return;
    cancelHide();
    updatePortalPosition();
    setPortalOpen(true);
  }, [detachPreview, cancelHide, updatePortalPosition]);

  useEffect(() => {
    if (!detachPreview || !portalOpen) return;
    const onMove = () => updatePortalPosition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [detachPreview, portalOpen, updatePortalPosition]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  const previewFrameClass = cn(
    'block overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2',
    'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06]',
    'dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10 dark:shadow-black/50',
  );

  const previewInner = (
    <span className={previewFrameClass}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className={cn('rounded-xl object-cover', previewClassName)}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700',
            'dark:bg-slate-800 dark:text-slate-200',
            previewClassName,
            compactAvatar ? 'text-3xl sm:text-4xl' : 'text-5xl',
          )}
        >
          {initials}
        </div>
      )}
    </span>
  );

  if (detachPreview) {
    return (
      <>
        <span
          ref={wrapRef}
          className={cn('relative inline-flex shrink-0 cursor-pointer', className)}
          onMouseEnter={onWrapEnter}
          onMouseLeave={scheduleHide}
        >
          <Avatar className={avatarClassName}>
            <AvatarImage src={avatarUrl ?? undefined} className="object-cover" />
            <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
          </Avatar>
        </span>
        {portalOpen && typeof document !== 'undefined'
          ? createPortal(
              <div
                role="presentation"
                className="pointer-events-auto"
                style={{
                  position: 'fixed',
                  top: portalPos.top,
                  left: portalPos.left,
                  transform: 'translateX(-50%)',
                  zIndex: 10000,
                }}
                onMouseEnter={cancelHide}
                onMouseLeave={scheduleHide}
              >
                {previewInner}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <span className={cn('group/avatarPreview relative inline-flex shrink-0 cursor-pointer', className)}>
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
        {previewInner}
      </span>
    </span>
  );
}
