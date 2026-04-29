import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  variant?: 'default' | 'glass';
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
}) => {
  const { t } = useTranslation();
  // Prevent body scroll when modal is open
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
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  const isGlass = variant === 'glass';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'fixed inset-0 z-50',
              isGlass ? 'bg-slate-950/35 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-[2px]',
            )}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'w-full flex flex-col max-h-[90vh] pointer-events-auto',
                isGlass
                  ? [
                      'rounded-3xl',
                      'bg-white/70 dark:bg-slate-950/55',
                      'backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl',
                      'border border-white/30 dark:border-white/10',
                      'shadow-[0_25px_60px_-20px_rgba(0,0,0,0.45)]',
                      'ring-1 ring-black/5 dark:ring-white/10',
                      'text-slate-900 dark:text-slate-50',
                    ].join(' ')
                  : [
                      'rounded-3xl shadow-2xl border',
                      'bg-white text-slate-900 border-gray-100',
                      'dark:bg-slate-900/95 dark:text-slate-50 dark:border-slate-700/70',
                    ].join(' '),
                maxWidthClass,
              )}
            >
              {/* Header */}
              <div
                className={cn(
                  'flex items-start justify-between px-6 py-5 shrink-0 gap-4',
                  isGlass
                    ? 'border-b border-white/20 dark:border-white/10'
                    : 'border-b border-gray-100 dark:border-slate-700/70',
                )}
              >
                <div className="min-w-0">
                  <h3
                    className={cn(
                      'text-xl font-bold',
                      isGlass ? 'text-slate-900 dark:text-slate-50' : 'text-brand-text',
                    )}
                  >
                    {title}
                  </h3>
                  {subtitle ? (
                    <p
                      className={cn(
                        'mt-1 text-sm',
                        isGlass ? 'text-slate-700/90 dark:text-slate-200/80' : 'text-brand-muted',
                      )}
                    >
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  title={t('common.close')}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-xl transition-colors',
                    isGlass
                      ? 'bg-white/35 text-brand-muted hover:bg-white/55 dark:bg-white/10 dark:hover:bg-white/20'
                      : 'bg-gray-50 text-brand-muted hover:bg-red-50 hover:text-red-500 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-200',
                  )}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div
                className={cn(
                  'px-6 py-6 overflow-y-auto custom-scrollbar flex-1',
                  isGlass ? 'text-slate-800 dark:text-slate-100' : undefined,
                )}
              >
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className={cn(
                    'px-6 py-5 rounded-b-3xl shrink-0',
                    isGlass
                      ? 'border-t border-white/20 dark:border-white/10 bg-white/25 dark:bg-white/5'
                      : 'border-t border-gray-100 bg-gray-50/50 dark:border-slate-700/70 dark:bg-slate-950/40',
                  )}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
