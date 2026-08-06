import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MetricStatSubtextVariant = 'up' | 'down' | 'alert' | 'neutral';

export interface MetricStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  subtextVariant?: MetricStatSubtextVariant;
  icon: React.ReactNode;
  iconColor: string;
  onClick?: () => void;
  clickHint?: string;
  /** When false, footer text is plain label (no underline on hover). Default true for dashboard-style links. */
  subtextLink?: boolean;
  index?: number;
}

export function MetricStatCard({
  label,
  value,
  subtext,
  subtextVariant = 'neutral',
  icon,
  iconColor,
  onClick,
  clickHint,
  subtextLink = true,
  index = 0,
}: MetricStatCardProps) {
  const interactive = Boolean(onClick);
  const fromLeft = index % 2 === 0;

  const showSubtext = Boolean(subtext?.trim());

  const body = (
    <>
      <div className={cn('relative flex items-start justify-between', showSubtext ? 'mb-4' : '')}>
        <motion.div
          initial={{ scale: 0, rotate: -28 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 460,
            damping: 14,
            delay: 0.18 + index * 0.08,
          }}
          variants={{
            show: { scale: 1, y: 0 },
            hover: { scale: 1.12, y: -3, transition: { type: 'spring', stiffness: 400, damping: 16 } },
            tap: { scale: 0.96 },
          }}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
            'ring-1 ring-white/25',
            iconColor,
          )}
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.4 + index * 0.15, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            {icon}
          </motion.span>
        </motion.div>
        <div className="text-right">
          <motion.p
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.08, duration: 0.35 }}
            className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            {label}
          </motion.p>
          <div className="overflow-hidden">
            <motion.h3
              key={String(value)}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 18,
                delay: 0.22 + index * 0.08,
              }}
              className="text-3xl font-bold text-slate-800 dark:text-slate-100"
            >
              {value}
            </motion.h3>
          </div>
        </div>
      </div>
      {showSubtext ? (
      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.32 + index * 0.08, duration: 0.4 }}
        style={{ transformOrigin: 'left center' }}
        className={cn(
          'relative mt-auto flex items-center gap-1 border-t border-slate-50 pt-3 text-xs font-medium transition-colors dark:border-slate-800',
          subtextVariant === 'up' && 'text-brand-green',
          subtextVariant === 'down' && 'text-rose-500',
          subtextVariant === 'alert' && 'text-rose-500',
          subtextVariant === 'neutral' && 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500',
          interactive && subtextLink && 'underline-offset-2 group-hover:underline',
        )}
      >
        {subtextVariant === 'up' && (
          <motion.span
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <ArrowUpRight className="h-3 w-3" />
          </motion.span>
        )}
        {subtextVariant === 'down' && (
          <motion.span
            animate={{ y: [0, 2, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <ArrowDownRight className="h-3 w-3" />
          </motion.span>
        )}
        {subtextVariant === 'alert' && <AlertCircle className="h-3 w-3" />}
        {subtext}
      </motion.div>
      ) : null}
    </>
  );

  const cardClass = cn(
    'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100/90 bg-white/95 p-4 text-left',
    'shadow-[0_8px_24px_-14px_rgba(15,23,42,0.22)]',
    'dark:border-slate-800 dark:bg-slate-900/90',
    'dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]',
    interactive &&
      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
  );

  const variants = {
    hidden: {
      opacity: 0,
      x: fromLeft ? -36 : 36,
      y: 18,
      scale: 0.88,
    },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 260,
        damping: 16,
        mass: 0.9,
        delay: 0.06 + index * 0.09,
      },
    },
    hover: interactive
      ? {
          scale: 1.035,
          y: -4,
          borderColor: 'rgba(75,137,205,0.45)',
          boxShadow: '0 18px 36px -16px rgba(75,137,205,0.4), 0 8px 16px -10px rgba(15,23,42,0.2)',
          transition: { type: 'spring' as const, stiffness: 420, damping: 18 },
        }
      : {
          scale: 1.015,
          y: -2,
        },
    tap: {
      scale: 0.97,
      transition: { type: 'spring' as const, stiffness: 500, damping: 28 },
    },
  };

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        title={clickHint || subtext}
        className={cardClass}
        initial="hidden"
        animate="show"
        whileHover="hover"
        whileTap="tap"
        variants={variants}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <motion.div className={cardClass} initial="hidden" animate="show" whileHover="hover" variants={variants}>
      {body}
    </motion.div>
  );
}
