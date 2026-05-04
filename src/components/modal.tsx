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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
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
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
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
                      'bg-white dark:bg-slate-900',
                      'border border-slate-200/90 dark:border-slate-700/80',
                      'shadow-[0_25px_60px_-20px_rgba(15,23,42,0.18)]',
                      'ring-1 ring-black/[0.04] dark:ring-white/10',
                      'text-slate-900 dark:text-slate-50',
                    ].join(' ')
                  : [
                      'rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-2xl',
                      'dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-50',
                    ].join(' '),
                maxWidthClass,
              )}
            >
              {/* Header */}
              <div
                className={cn(
                  'flex items-start justify-between px-6 py-5 shrink-0 gap-4',
                  isGlass
                    ? 'border-b border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900'
                    : 'border-b border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900',
                )}
              >
                <div className="min-w-0">
                  <h3
                    className={cn(
                      'text-xl font-bold',
                      isGlass ? 'text-slate-900 dark:text-slate-50' : 'text-slate-900 dark:text-slate-50',
                    )}
                  >
                    {title}
                  </h3>
                  {subtitle ? (
                    <p
                      className={cn(
                        'mt-1 text-sm',
                        isGlass ? 'text-slate-700/90 dark:text-slate-200/80' : 'text-slate-500 dark:text-slate-400',
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
                      ? 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div
                className={cn(
                  'px-6 py-6 overflow-y-auto custom-scrollbar flex-1',
                  isGlass
                    ? 'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100'
                    : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-200',
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
                      ? 'border-t border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900'
                      : 'border-t border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900',
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
