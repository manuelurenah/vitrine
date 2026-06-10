import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the SDK orchestrator module BEFORE importing the helpers under test.
// We capture all calls to the build/submit/estimate functions so we can assert
// on the exact body shapes that flow through.
const orchestratorMocks = vi.hoisted(() => {
  const buildImageGenBody = vi.fn((input: unknown, opts?: unknown) => ({
    __built: 'imageGen',
    input,
    opts,
  }));
  const buildWorkflowBody = vi.fn((step: unknown, opts?: unknown) => ({
    __built: 'workflow',
    step,
    opts,
  }));
  const estimateWorkflow = vi.fn(async (_client: unknown, body: unknown) => ({
    id: 'wf_estimate',
    status: 'succeeded',
    body,
  }));
  const submitWorkflow = vi.fn(async (_client: unknown, body: unknown) => ({
    id: 'wf_submit',
    status: 'pending',
    body,
  }));
  const getWorkflow = vi.fn();
  const createOrchestratorClient = vi.fn((opts: { accessToken: string; baseUrl?: string }) => ({
    accessToken: opts.accessToken,
    baseUrl: opts.baseUrl ?? 'https://orchestration.civitai.com',
  }));
  class OrchestratorError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return {
    buildImageGenBody,
    buildWorkflowBody,
    estimateWorkflow,
    submitWorkflow,
    getWorkflow,
    createOrchestratorClient,
    OrchestratorError,
    DEFAULT_MODEL_AIR: 'urn:air:test',
    extractImageUrls: vi.fn(() => []),
    isTerminal: vi.fn(() => false),
  };
});

vi.mock('@civitai/app-sdk/orchestrator', () => orchestratorMocks);

vi.mock('@civitai/app-sdk', () => ({
  fetchMe: vi.fn(),
  fetchBuzzAccount: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    ORCHESTRATOR_URL: 'https://orchestrator.test',
    CIVITAI_BASE_URL: 'https://civitai.test',
  },
}));

import {
  DEFAULT_IMAGE_ENGINE,
  DEFAULT_IMAGE_MODEL,
  estimateImageGen,
  estimateUpscale,
  estimateVideoAnimate,
  submitImageGen,
  submitUpscale,
  submitVideoAnimate,
} from './civitai';
import type { Session } from './session';

function makeSession(token = 'tok_abc'): Session {
  return {
    tokens: {
      access_token: token,
      refresh_token: 'r',
      expires_at: Date.now() + 60_000,
      token_type: 'Bearer',
      scope: 0,
    } as Session['tokens'],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('estimateImageGen / submitImageGen', () => {
  it('exports the expected default engine + model constants', () => {
    expect(DEFAULT_IMAGE_ENGINE).toBe('google');
    expect(DEFAULT_IMAGE_MODEL).toBe('nano-banana-2');
  });

  it('builds an imageGen body with engine google, model nano-banana-2 by default', async () => {
    const session = makeSession();
    await estimateImageGen(session, {
      prompt: 'a hero shot of the product',
      aspectRatio: '1:1',
      numImages: 2,
    });

    expect(orchestratorMocks.buildImageGenBody).toHaveBeenCalledTimes(1);
    const [input, opts] = orchestratorMocks.buildImageGenBody.mock.calls[0]!;
    expect(input).toMatchObject({
      engine: 'google',
      model: 'nano-banana-2',
      prompt: 'a hero shot of the product',
      aspectRatio: '1:1',
      numImages: 2,
      resolution: '1K',
    });
    expect((input as Record<string, unknown>).images).toBeUndefined();
    expect(opts).toEqual({ tags: ['civitai-app-starter', 'next-app'] });
  });

  it('passes images[] through when references are provided', async () => {
    await submitImageGen(makeSession(), {
      prompt: 'editorial shot',
      aspectRatio: '4:5',
      numImages: 1,
      images: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
      resolution: '2K',
    });

    const [input] = orchestratorMocks.buildImageGenBody.mock.calls[0]!;
    expect(input).toMatchObject({
      engine: 'google',
      model: 'nano-banana-2',
      prompt: 'editorial shot',
      aspectRatio: '4:5',
      numImages: 1,
      resolution: '2K',
      images: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
    });
  });

  it('omits images[] when input.images is empty', async () => {
    await submitImageGen(makeSession(), {
      prompt: 'test',
      aspectRatio: '16:9',
      numImages: 1,
      images: [],
    });
    const [input] = orchestratorMocks.buildImageGenBody.mock.calls[0]!;
    expect((input as Record<string, unknown>).images).toBeUndefined();
  });

  it('honors engine/model overrides', async () => {
    await estimateImageGen(makeSession(), {
      prompt: 'p',
      aspectRatio: '9:16',
      numImages: 1,
      engine: 'flux2',
      model: 'pro',
    });
    const [input] = orchestratorMocks.buildImageGenBody.mock.calls[0]!;
    expect(input).toMatchObject({ engine: 'flux2', model: 'pro' });
  });

  it('threads the session access token into createOrchestratorClient', async () => {
    await estimateImageGen(makeSession('tok_xyz'), {
      prompt: 'p',
      aspectRatio: '1:1',
      numImages: 1,
    });
    expect(orchestratorMocks.createOrchestratorClient).toHaveBeenCalledWith({
      accessToken: 'tok_xyz',
      baseUrl: 'https://orchestrator.test',
    });
  });

  it('estimate uses estimateWorkflow, submit uses submitWorkflow', async () => {
    await estimateImageGen(makeSession(), {
      prompt: 'p',
      aspectRatio: '1:1',
      numImages: 1,
    });
    expect(orchestratorMocks.estimateWorkflow).toHaveBeenCalledTimes(1);
    expect(orchestratorMocks.submitWorkflow).not.toHaveBeenCalled();

    await submitImageGen(makeSession(), {
      prompt: 'p',
      aspectRatio: '1:1',
      numImages: 1,
    });
    expect(orchestratorMocks.submitWorkflow).toHaveBeenCalledTimes(1);
  });

  it('surfaces orchestrator errors (e.g. 402 insufficient buzz) as typed errors', async () => {
    orchestratorMocks.submitWorkflow.mockRejectedValueOnce(
      new orchestratorMocks.OrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    await expect(
      submitImageGen(makeSession(), {
        prompt: 'p',
        aspectRatio: '1:1',
        numImages: 1,
      }),
    ).rejects.toMatchObject({
      name: 'Error',
      status: 402,
      body: { code: 'NO_BUZZ' },
    });
  });
});

describe('submitUpscale / estimateUpscale', () => {
  it('builds an imageUpscaler step with the source URL + scale 2', async () => {
    await submitUpscale(makeSession(), 'https://orch.test/img/1.png');
    expect(orchestratorMocks.buildWorkflowBody).toHaveBeenCalledTimes(1);
    const [step, opts] = orchestratorMocks.buildWorkflowBody.mock.calls[0]!;
    expect(step).toMatchObject({
      $type: 'imageUpscaler',
      input: { image: 'https://orch.test/img/1.png', scale: 2 },
    });
    expect(opts).toEqual({ tags: ['civitai-app-starter', 'next-app'] });
  });

  it('estimateUpscale calls estimateWorkflow (no submit)', async () => {
    await estimateUpscale(makeSession(), 'https://orch.test/img/1.png');
    expect(orchestratorMocks.estimateWorkflow).toHaveBeenCalledTimes(1);
    expect(orchestratorMocks.submitWorkflow).not.toHaveBeenCalled();
  });
});

describe('submitVideoAnimate / estimateVideoAnimate', () => {
  it('builds a videoGen step with engine wan, model image-to-video, sourceImage', async () => {
    await submitVideoAnimate(makeSession(), 'https://orch.test/img/1.png');
    const [step] = orchestratorMocks.buildWorkflowBody.mock.calls[0]!;
    expect(step).toMatchObject({
      $type: 'videoGen',
      input: {
        engine: 'wan',
        model: 'image-to-video',
        sourceImage: 'https://orch.test/img/1.png',
      },
    });
    expect((step as { input: Record<string, unknown> }).input.prompt).toBeUndefined();
  });

  it('passes optional prompt through when provided', async () => {
    await submitVideoAnimate(makeSession(), 'https://orch.test/img/1.png', 'slow zoom in');
    const [step] = orchestratorMocks.buildWorkflowBody.mock.calls[0]!;
    expect((step as { input: Record<string, unknown> }).input.prompt).toBe('slow zoom in');
  });

  it('estimateVideoAnimate calls estimateWorkflow', async () => {
    await estimateVideoAnimate(makeSession(), 'https://orch.test/img/1.png');
    expect(orchestratorMocks.estimateWorkflow).toHaveBeenCalledTimes(1);
  });
});
