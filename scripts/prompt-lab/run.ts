import { isPresetId, type PresetId } from '../../src/lib/presets';

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
