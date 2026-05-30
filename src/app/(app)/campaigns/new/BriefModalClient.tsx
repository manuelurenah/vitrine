'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '@/components/ui';
import { BriefForm, type BriefPayload } from '@/components/campaigns';

export function BriefModalClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: BriefPayload) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/cook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      const id = body?.campaignId as string | undefined;
      if (!id) {
        setError('no campaign id returned');
        setSubmitting(false);
        return;
      }
      router.push(`/campaigns/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => router.push('/campaigns')}
      eyebrow="// step 1 · brief"
      title="cook the brief."
      maxWidth={860}
    >
      <BriefForm onSubmit={handleSubmit} submitting={submitting} error={error} />
    </Modal>
  );
}
