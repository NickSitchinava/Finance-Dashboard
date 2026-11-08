import type { ReactNode, SVGProps } from 'react';

export const FINANCE_CATEGORY_ICONS = ['tag', 'briefcase', 'code', 'cart', 'cloud', 'megaphone', 'users', 'tool', 'star'] as const;

const paths: Record<string, ReactNode> = {
  tag: <><path d="M3 3h7l11 11-7 7L3 10V3Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
  code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/></>,
  cart: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l2.5 12h13l2-9H5"/></>,
  cloud: <path d="M7 18h11a4 4 0 0 0 .2-8 6.5 6.5 0 0 0-12.5 1.5A3.3 3.3 0 0 0 7 18Z"/>,
  megaphone: <><path d="M3 10v4a2 2 0 0 0 2 2h2l2 5h3l-2-5 10 4V4L7 8H5a2 2 0 0 0-2 2Z"/><path d="M20 9a3 3 0 0 1 0 6"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm13-15a3 3 0 0 1 0 6m5 9v-2a6 6 0 0 0-4-5.65"/></>,
  tool: <path d="M14 6.5a4.5 4.5 0 0 0-5.5 5.5L3 17.5 6.5 21l5.5-5.5A4.5 4.5 0 0 0 17.5 10L15 12.5l-3.5-3.5L14 6.5Z"/>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/>,
};

export function FinanceCategoryIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.tag}</svg>;
}
