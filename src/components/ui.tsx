import type { ReactNode } from 'react';
import clsx from 'clsx';

export const Card = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={clsx('rounded-3xl border border-orange-100 bg-white/95 shadow-[0_18px_45px_-28px_rgba(146,64,14,0.5)]', className)}>
    {children}
  </div>
);

export const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="font-serif text-2xl font-semibold text-stone-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
    </div>
    {action}
  </div>
);

export const Input = ({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) => (
  <label className="block text-sm font-medium text-stone-700">
    <span className="mb-2 block">{label}</span>
    <input
      {...props}
      className={clsx(
        'w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200',
        className,
      )}
    />
  </label>
);

export const Textarea = ({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; className?: string }) => (
  <label className="block text-sm font-medium text-stone-700">
    <span className="mb-2 block">{label}</span>
    <textarea
      {...props}
      className={clsx(
        'min-h-[110px] w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200',
        className,
      )}
    />
  </label>
);

export const Select = ({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; className?: string; children: ReactNode }) => (
  <label className="block text-sm font-medium text-stone-700">
    <span className="mb-2 block">{label}</span>
    <select
      {...props}
      className={clsx(
        'w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200',
        className,
      )}
    >
      {children}
    </select>
  </label>
);

export const Button = ({
  children,
  className,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  children: ReactNode;
}) => {
  const styles = {
    primary: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200 hover:brightness-105',
    secondary: 'bg-stone-900 text-white hover:bg-stone-800',
    ghost: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  };

  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[tone],
        className,
      )}
    >
      {children}
    </button>
  );
};

export const Badge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'vip';
}) => {
  const styles = {
    neutral: 'bg-stone-100 text-stone-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    vip: 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700',
  };

  return <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', styles[tone])}>{children}</span>;
};

export const MetricCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) => (
  <Card className="p-5">
    <p className="text-sm font-medium text-stone-500">{label}</p>
    <p className="mt-3 font-serif text-3xl font-semibold text-stone-900">{value}</p>
    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-orange-600">{hint}</p>
  </Card>
);

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <Card className="p-10 text-center">
    <h3 className="font-serif text-xl font-semibold text-stone-900">{title}</h3>
    <p className="mt-2 text-sm text-stone-500">{description}</p>
  </Card>
);

export const DataTable = ({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) => (
  <div className="overflow-hidden rounded-3xl border border-orange-100">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-orange-100">
        <thead className="bg-orange-50/80">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-orange-50 bg-white">{children}</tbody>
      </table>
    </div>
  </div>
);

export const Modal = ({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-stone-900">{title}</h3>
            {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
          </div>
          <Button type="button" tone="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
};
