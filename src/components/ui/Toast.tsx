'use client';

import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export type ToastVariant = 'default' | 'success' | 'error';

export type ToastAction = { label: string; onClick: () => void };

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  /**
   * ms before auto-dismiss; `0` keeps it until the user acts. Defaults to
   * 6000, or 8000 for `error` toasts (a little longer so the retry action is
   * reachable). All toasts are also dismissible via their close button.
   */
  duration?: number;
};

type ToastEntry = ToastOptions & { id: number };

type ToastContextValue = {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/**
 * App-wide toast host. Wraps the tree, exposes `useToast()`, and portals the
 * stack to `document.body` at the reserved `z-toast` layer. Dependency-free so
 * we don't pull a toast lib in just for this.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { variant: 'default', ...opts, id }]);
      const duration = opts.duration ?? (opts.variant === 'error' ? 8000 : 6000);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const variantStyle: Record<ToastVariant, { border: string; icon: ReactNode }> = {
  default: {
    border: 'border-line-strong',
    icon: <Info size={16} strokeWidth={1.75} className="text-fg-2" />,
  },
  success: {
    border: 'border-line-volt',
    icon: <CheckCircle2 size={16} strokeWidth={1.75} className="text-volt" />,
  },
  error: {
    border: 'border-danger',
    icon: <TriangleAlert size={16} strokeWidth={1.75} className="text-danger" />,
  },
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  // Portal target only exists on the client; gate on mount to stay SSR-safe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="region"
      aria-label="notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastEntry;
  onDismiss: (id: number) => void;
}) {
  // Enter transition: mount in the "out" state, flip after one frame.
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const style = variantStyle[toast.variant ?? 'default'];

  return (
    <div
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-[12px] border bg-bg-1 px-3.5 py-3 shadow-lg',
        'transition-[opacity,transform] duration-200 ease-out',
        style.border,
        enter ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <span className="mt-px shrink-0">{style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-fg-0">{toast.title}</span>
        {toast.description && (
          <span className="break-words text-[12px] leading-snug text-fg-2">
            {toast.description}
          </span>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 self-start rounded-[7px] border border-line-strong bg-bg-2 px-2.5 py-1 text-[12px] font-medium text-fg-0 transition-colors hover:bg-bg-3"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="dismiss"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 -mt-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-3 transition-colors hover:bg-bg-3 hover:text-fg-1"
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
