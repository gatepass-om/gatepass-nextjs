import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'warning' | 'danger' | 'success';

export type StatItem = {
  label: string;
  value: number | string;
  tone?: StatTone;
  href?: string;
};

const dot: Record<StatTone, string> = {
  default: '',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
};

/**
 * One quiet line of figures in place of a row of counter cards. Items whose value is zero are left out,
 * so an empty page shows nothing rather than a row of zeros; an analytics page can pass `showZero`.
 */
export function StatStrip({ items, className, label, showZero = false }: { items: StatItem[]; className?: string; label?: string; showZero?: boolean }) {
  const shown = showZero ? items : items.filter((item) => item.value !== 0);
  if (shown.length === 0) return null;
  return (
    <ul aria-label={label} className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 text-sm', className)}>
      {shown.map((item) => {
        const tone = item.tone ?? 'default';
        const content = (
          <>
            {tone !== 'default' ? <span className={cn('status-dot', dot[tone])} aria-hidden="true" /> : null}
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
            <span className="text-muted-foreground">{item.label}</span>
          </>
        );
        return (
          <li key={item.label}>
            {item.href
              ? <Link href={item.href} className="inline-flex items-center gap-1.5 hover:underline">{content}</Link>
              : <span className="inline-flex items-center gap-1.5">{content}</span>}
          </li>
        );
      })}
    </ul>
  );
}
