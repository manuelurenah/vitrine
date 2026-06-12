import { mkdir, writeFile } from 'node:fs/promises';
import {
  createOrchestratorClient,
  estimateWorkflow,
  extractImageUrls,
  getWorkflow,
  isTerminal,
  submitWorkflow,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
import {
  buildVitrineImageGenBody,
  type VitrineImageGenInput,
} from '../../src/lib/imageGenBody';
import { isPresetId, PRESETS, type PresetId } from '../../src/lib/presets';
import { buildCampaignPrompt } from '../../src/lib/promptBuilder';
import { resolveAccessToken } from './auth';
import { BRIEFS } from './fixtures';

export type RunOptions = {
  brief: string;
  presets: PresetId[];
  num: number;
  matrix: boolean;
  refs: string[];
  promptOverride?: string;
  negativeOverride?: string;
};

function takeValue(argv: string[], i: number, flag: string): string {
  const v = argv[i + 1];
  if (v === undefined) throw new Error(`${flag} requires a value`);
  return v;
}

function toPresets(csv: string): PresetId[] {
  const ids = csv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    if (!isPresetId(id)) throw new Error(`unknown preset id: ${id}`);
  }
  return ids as PresetId[];
}

export function parseArgs(argv: string[]): RunOptions {
  const o: RunOptions = {
    brief: 'skincare',
    presets: ['ig-feed'],
    num: 1,
    matrix: false,
    refs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--brief': o.brief = takeValue(argv, i++, a); break;
      case '--preset': o.presets = toPresets(takeValue(argv, i++, a)); break;
      case '--num': o.num = Number.parseInt(takeValue(argv, i++, a), 10); break;
      case '--matrix': o.matrix = true; break;
      case '--refs':
        o.refs = takeValue(argv, i++, a).split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--prompt-override': o.promptOverride = takeValue(argv, i++, a); break;
      case '--negative-override': o.negativeOverride = takeValue(argv, i++, a); break;
      default:
        throw new Error(`unknown flag: ${a}`);
    }
  }
  return o;
}

// ---------------------------------------------------------------------------
// Real submit / poll / download flow
// ---------------------------------------------------------------------------

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'https://orchestration.civitai.com';
const POLL_INTERVAL_MS = 3000;
// Cold-start GPU workflows on a busy cluster can take a few minutes; keep this
// generous so a slow render isn't mistaken for an empty/failed result.
const POLL_TIMEOUT_MS = 300_000;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function runStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function pollUntilTerminal(
  client: ReturnType<typeof createOrchestratorClient>,
  id: string,
): Promise<WorkflowSnapshot> {
  const start = Date.now();
  let snap = await getWorkflow(client, id);
  while (!isTerminal(snap)) {
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      console.warn(`[poll] ${id} timed out after ${POLL_TIMEOUT_MS}ms; returning last snapshot`);
      return snap;
    }
    await sleep(POLL_INTERVAL_MS);
    snap = await getWorkflow(client, id);
  }
  return snap;
}

async function downloadImage(url: string, destNoExt: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const ext = EXT_BY_MIME[res.headers.get('content-type') ?? ''] ?? 'png';
  const dest = `${destNoExt}.${ext}`;
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

type GenResult = {
  preset: PresetId;
  finalPrompt: string;
  negativePrompt: string;
  aspectRatio: string;
  cost: number;
  workflowId: string;
  imageUrls: string[];
  files: string[];
  status: string;
};

async function runOne(
  client: ReturnType<typeof createOrchestratorClient>,
  briefKey: string,
  preset: PresetId,
  opts: RunOptions,
  outDir: string,
): Promise<GenResult> {
  const fixture = BRIEFS[briefKey];
  if (!fixture) {
    throw new Error(`unknown brief: ${briefKey} (have: ${Object.keys(BRIEFS).join(', ')})`);
  }
  const refs = opts.refs.length ? opts.refs : (fixture.refs ?? []);

  const enhanced = buildCampaignPrompt({
    brief: fixture.brief,
    brand: fixture.brand,
    preset: PRESETS[preset],
    referenceCount: refs.length,
    adCopy: fixture.adCopy,
  });
  const finalPrompt = opts.promptOverride ?? enhanced.finalPrompt;
  const negativePrompt = opts.negativeOverride ?? enhanced.negativePrompt;

  const input: VitrineImageGenInput = {
    prompt: finalPrompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: opts.num,
    ...(negativePrompt ? { negativePrompt } : {}),
    ...(refs.length ? { images: refs } : {}),
  };
  const body = buildVitrineImageGenBody(input);

  const estimate = await estimateWorkflow(client, body);
  const cost = estimate.cost?.total ?? 0;
  console.log(`[${briefKey}/${preset}] estimate: ${cost} buzz`);

  const submitted = await submitWorkflow(client, body);
  console.log(`[${briefKey}/${preset}] submitted ${submitted.id} — polling…`);
  const snap = await pollUntilTerminal(client, submitted.id);
  const status = String(snap.status ?? 'unknown');
  const imageUrls = extractImageUrls(snap);

  const dir = `${outDir}/${briefKey}-${preset}`;
  await mkdir(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]!;
    if (!/^https?:\/\//.test(url)) {
      console.warn(`[${briefKey}/${preset}] skipping non-http image url: ${url.slice(0, 48)}…`);
      continue;
    }
    files.push(await downloadImage(url, `${dir}/${String(i + 1).padStart(2, '0')}`));
  }
  if (files.length === 0) {
    console.warn(
      `[${briefKey}/${preset}] no images saved (status=${status}, urls=${imageUrls.length}) — ` +
        'workflow likely failed or timed out; inspect meta.json',
    );
  }

  const result: GenResult = {
    preset,
    finalPrompt,
    negativePrompt,
    aspectRatio: enhanced.aspectRatio,
    cost,
    workflowId: submitted.id,
    imageUrls,
    files,
    status,
  };
  await writeFile(`${dir}/meta.json`, JSON.stringify({ brief: briefKey, ...result }, null, 2));
  console.log(`[${briefKey}/${preset}] ${status} — ${files.length} image(s) → ${dir}`);
  return result;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const accessToken = await resolveAccessToken();
  const client = createOrchestratorClient({ accessToken, baseUrl: ORCHESTRATOR_URL });

  const briefKeys = opts.matrix ? Object.keys(BRIEFS) : [opts.brief];
  const outDir = `scripts/prompt-lab/runs/${runStamp()}`;
  await mkdir(outDir, { recursive: true });

  for (const briefKey of briefKeys) {
    for (const preset of opts.presets) {
      try {
        await runOne(client, briefKey, preset, opts, outDir);
      } catch (err) {
        console.error(`[${briefKey}/${preset}] FAILED:`, err instanceof Error ? err.message : err);
      }
    }
  }
  console.log(`\nDone. Results in ${outDir}`);
}

// Run only when invoked directly (not when imported by the test).
if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
