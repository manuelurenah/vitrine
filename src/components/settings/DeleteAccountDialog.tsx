'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, FieldLabel, Input, Modal } from '@/components/ui';

export function DeleteAccountDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = username.trim();
  const matches = expected.length > 0 && confirmText.trim() === expected;

  function reset() {
    setConfirmText('');
    setError(null);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function confirmDelete() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed');
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
        className="text-danger hover:text-danger"
        data-testid="delete-account-open"
      >
        delete account
      </Button>

      <Modal
        open={open}
        onClose={close}
        eyebrow="// danger"
        title="delete vitrine account"
        maxWidth={460}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmDelete}
              disabled={!matches || busy}
              className="bg-danger text-white hover:bg-danger hover:brightness-110 disabled:bg-bg-3 disabled:text-fg-3"
              data-testid="delete-account-confirm"
            >
              {busy ? 'deleting…' : 'delete account'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-[1.5] text-fg-1">
            This permanently erases your vitrine brand, products, assets, campaigns,
            photoshoots, generation history, and buzz history, and revokes vitrine&apos;s
            access at Civitai. Your Civitai account is not affected. This cannot be undone.
          </p>
          <div>
            <FieldLabel htmlFor="confirm-username">
              type{' '}
              <span className="text-fg-0" data-testid="delete-account-username">
                {username}
              </span>{' '}
              to confirm
            </FieldLabel>
            <Input
              id="confirm-username"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-testid="delete-account-input"
            />
          </div>
          {error && (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
