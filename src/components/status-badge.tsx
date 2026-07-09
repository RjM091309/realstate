import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusBadgeBase, statusBadgeVariants, type StatusBadgeVariant } from '@/lib/statusBadge';

type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, 'variant'> & {
  tone: StatusBadgeVariant;
};

/** Consistent status pill used in tables and detail views. */
export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return <Badge className={cn(statusBadgeBase, statusBadgeVariants[tone], className)} {...props} />;
}

export type { StatusBadgeVariant };
