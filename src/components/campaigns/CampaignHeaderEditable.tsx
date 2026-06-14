'use client';

import { useRouter } from 'next/navigation';
import { InlineEditText } from '@/components/ui';

type Props = {
  campaignId: string;
  initialTitle: string;
  initialDescription: string;
};

/**
 * Client island for the campaign detail header: inline-editable title and
 * description. `CampaignDetail` stays a server component and renders this for
 * the two editable fields. After a successful PATCH we `router.refresh()` so the
 * server re-renders the breadcrumb + header from the persisted value.
 */
export function CampaignHeaderEditable({ campaignId, initialTitle, initialDescription }: Props) {
  const router = useRouter();

  async function patch(body: { title?: string; description?: string }) {
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`campaign patch failed: ${res.status}`);
    router.refresh();
  }

  return (
    <>
      <h1>
        <InlineEditText
          value={initialTitle}
          ariaLabel="edit campaign title"
          onSave={(title) => patch({ title })}
          className="t-h2 block w-full text-fg-0"
        />
      </h1>
      <div className="max-w-[680px]">
        <InlineEditText
          value={initialDescription}
          ariaLabel="edit campaign description"
          onSave={(description) => patch({ description })}
          multiline
          allowEmpty
          placeholder="Add a description"
          className="block w-full text-[14px] leading-[1.5] text-fg-2"
        />
      </div>
    </>
  );
}
