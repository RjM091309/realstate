import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  variant?: 'default' | 'glass';
  /** Tighter header/body padding and smaller title — for data-heavy modals. */
  compact?: boolean;
  /** Extra classes on the outer modal shell. */
  shellClassName?: string;
}

/** Merit micro-label: tiny uppercase tracking */
export const modalFieldLabelClass =
  'block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5';

/** Merit field value text */
export const modalFieldValueClass =
  'text-sm font-bold text-slate-800 uppercase truncate dark:text-slate-100';

/** Merit bordered value box (profile readouts) */
export const modalFieldBoxClass =
  'flex min-h-9 items-center rounded-lg border border-slate-100 bg-white px-3 text-sm font-bold uppercase text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100';

/** Merit form label */
export const modalFormLabelClass =
  'text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400';

/** Merit section title inside modals */
export const modalSectionTitleClass =
  'mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-blue';

type InfoAccent = 'blue' | 'green' | 'orange' | 'slate';

const INFO_ACCENT_BG: Record<InfoAccent, string> = {
  blue: 'bg-brand-blue',
  green: 'bg-brand-green',
  orange: 'bg-brand-orange',
  slate: 'bg-[#334155]',
};

/** Merit-style info card: colored icon square + uppercase label/value */
export function ModalInfoCard({
  icon: Icon,
  label,
  value,
  accent = 'blue',
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  accent?: InfoAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-md',
          INFO_ACCENT_BG[accent],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <label className={modalFieldLabelClass}>{label}</label>
        <span className={cn(modalFieldValueClass, 'block')}>{value}</span>
      </div>
    </div>
  );
}

/** Compact Merit detail field (label over value box) */
export function ModalDetailField({
  label,
  value,
  span = 1,
  className,
}: {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-1',
        span === 2 && 'sm:col-span-2',
        span === 3 && 'sm:col-span-3',
        className,
      )}
    >
      <p className={modalFieldLabelClass}>{label}</p>
      <div className={modalFieldBoxClass}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <span className="truncate">{value}</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
  variant = 'default',
  compact = false,
  shellClassName,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }[maxWidth];

  const isGlass = variant === 'glass';

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="app-modal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          {/* Backdrop behind the shell so inputs/buttons always receive clicks. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute inset-0 z-0',
              isGlass ? 'bg-slate-900/60 backdrop-blur-md' : 'bg-slate-900/60 backdrop-blur-md',
            )}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'app-modal-shell relative z-10 flex w-full flex-col overflow-hidden border border-slate-200 bg-white font-sans text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50',
              'pointer-events-auto rounded-2xl',
              shellClassName,
              compact ? 'max-h-[85vh]' : 'max-h-[92vh]',
              maxWidthClass,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — Merit border-b + uppercase title */}
            <div
              className={cn(
                'app-modal-header flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800',
                compact ? 'px-4 py-3' : 'px-5 py-4 sm:px-6 sm:py-5',
              )}
            >
              <div className="min-w-0">
                <h3
                  className={cn(
                    'font-black uppercase tracking-tight text-slate-800 dark:text-slate-50',
                    compact ? 'text-base' : 'text-xl sm:text-2xl',
                  )}
                >
                  {title}
                </h3>
                {subtitle ? (
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                title={t('common.close')}
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div
              className={cn(
                'custom-scrollbar light-scroll flex-1 overflow-y-auto',
                compact ? 'px-4 py-3' : 'px-5 py-5 sm:px-6 sm:py-6',
                'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-200',
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                className={cn(
                  'app-modal-footer shrink-0 border-t border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:py-5',
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
