'use client';

import { LogOut, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';

export function SessionActions() {
  const [busy, setBusy] = useState<'none' | 'logout' | 'revoke'>('none');

  async function call(path: '/api/auth/logout' | '/api/auth/revoke', label: 'logout' | 'revoke') {
    if (label === 'revoke' && !window.confirm('revoke vitrine\'s access at Civitai? you can re-grant by logging in again.')) {
      return;
    }
    setBusy(label);
    try {
      await fetch(path, { method: 'POST' });
      window.location.href = '/';
    } finally {
      setBusy('none');
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        onClick={() => call('/api/auth/logout', 'logout')}
        disabled={busy !== 'none'}
        leadingIcon={<LogOut size={14} strokeWidth={1.75} />}
      >
        {busy === 'logout' ? 'signing out…' : 'sign out'}
      </Button>
      <Button
        variant="ghost"
        onClick={() => call('/api/auth/revoke', 'revoke')}
        disabled={busy !== 'none'}
        leadingIcon={<ShieldOff size={14} strokeWidth={1.75} />}
        className="text-danger hover:text-danger"
      >
        {busy === 'revoke' ? 'revoking…' : 'revoke access'}
      </Button>
    </div>
  );
}
