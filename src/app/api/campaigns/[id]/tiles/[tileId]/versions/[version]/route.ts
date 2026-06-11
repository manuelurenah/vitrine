import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { deleteTileVersion, restoreTileVersion } from '@/lib/tileVersions';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string; version: string }>;

function parseVersion(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== raw) return null;
  return n;
}

export async function POST(_req: Request, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId, version } = await ctx.params;

  const versionNum = parseVersion(version);
  if (versionNum === null) {
    return NextResponse.json({ error: 'invalid_version' }, { status: 400 });
  }

  const entry = await restoreTileVersion(userKey, id, tileId, versionNum);
  if (!entry) return NextResponse.json({ error: 'version_not_found' }, { status: 404 });

  return NextResponse.json({ version: entry });
}

export async function DELETE(_req: Request, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId, version } = await ctx.params;

  const versionNum = parseVersion(version);
  if (versionNum === null) {
    return NextResponse.json({ error: 'invalid_version' }, { status: 400 });
  }

  const result = await deleteTileVersion(userKey, id, tileId, versionNum);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true, version: result.version });
}
