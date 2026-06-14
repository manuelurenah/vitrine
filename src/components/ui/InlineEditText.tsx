'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveCommit } from '@/lib/inlineEdit';
import { cn } from './cn';

type Props = {
  /** Current persisted value. */
  value: string;
  /** Persist a new value. May throw — the field reverts on failure. */
  onSave: (next: string) => Promise<void>;
  /** Accessible label for both the display button and the edit field. */
  ariaLabel: string;
  /** Render a `<textarea>` (commits on blur) instead of an `<input>` (commits on Enter). */
  multiline?: boolean;
  /** When false (default) an empty value reverts instead of saving. */
  allowEmpty?: boolean;
  /** Shown muted when the value is empty. */
  placeholder?: string;
  /** Typography classes applied to both the display text and the field. */
  className?: string;
};

const fieldChrome =
  'w-full bg-bg-2 border border-line rounded-[8px] px-2 py-1 -mx-2 -my-1 ' +
  'focus:outline-none focus:border-volt focus:ring-[3px] focus:ring-volt-soft ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export function InlineEditText({
  value,
  onSave,
  ariaLabel,
  multiline = false,
  allowEmpty = false,
  placeholder,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const committingRef = useRef(false);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Re-sync the draft when the upstream value changes (e.g. after router.refresh)
  // while we're not actively editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus + select on entering edit mode.
  useEffect(() => {
    if (editing && fieldRef.current) {
      fieldRef.current.focus();
      fieldRef.current.select();
    }
  }, [editing]);

  async function commit() {
    // Enter + blur can both fire for one commit; collapse them.
    if (committingRef.current) return;
    committingRef.current = true;

    const { commit: shouldCommit, value: next } = resolveCommit(draft, value, { allowEmpty });
    if (!shouldCommit) {
      setDraft(value);
      setEditing(false);
      committingRef.current = false;
      return;
    }

    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      console.error('inline edit save failed', err);
      setDraft(value); // revert on failure
    } finally {
      setSaving(false);
      committingRef.current = false;
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      void commit();
    }
  }

  if (editing) {
    const sharedProps = {
      ref: fieldRef,
      value: draft,
      disabled: saving,
      'aria-label': ariaLabel,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown,
      className: cn(fieldChrome, className),
    };
    return multiline ? (
      <textarea {...sharedProps} rows={3} />
    ) : (
      <input {...sharedProps} type="text" />
    );
  }

  const isEmpty = value.trim() === '';
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={cn(
        'cursor-text rounded-[8px] px-2 py-1 -mx-2 -my-1 text-left transition-colors duration-fast ease-out hover:bg-bg-2 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-volt-soft',
        className,
      )}
    >
      {isEmpty ? <span className="text-fg-3 italic">{placeholder ?? ''}</span> : value}
    </button>
  );
}
