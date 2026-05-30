import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { onboardingState, type OnboardingState } from '@/lib/db/schema';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/components/onboarding/steps';

export type OnboardingPayload = {
  brandName?: string;
  websiteUrl?: string;
  description?: string;
  logoName?: string;
  colors?: string[];
};

export type OnboardingSnapshot = {
  currentStep: OnboardingStep;
  completedAt: number | null;
  payload: OnboardingPayload;
};

function toSnapshot(row: OnboardingState): OnboardingSnapshot {
  return {
    currentStep: row.currentStep,
    completedAt: row.completedAt?.getTime() ?? null,
    payload: (row.payload as OnboardingPayload) ?? {},
  };
}

async function ensureRow(userId: string): Promise<OnboardingState> {
  const [row] = await db
    .insert(onboardingState)
    .values({ userId })
    .onConflictDoNothing({ target: onboardingState.userId })
    .returning();
  if (row) return row;
  const [existing] = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.userId, userId))
    .limit(1);
  if (!existing) throw new Error('onboarding_state row missing after upsert');
  return existing;
}

export async function getOnboarding(userId: string): Promise<OnboardingSnapshot> {
  const row = await ensureRow(userId);
  return toSnapshot(row);
}

export async function recordOnboardingStep(
  userId: string,
  step: OnboardingStep,
): Promise<OnboardingSnapshot> {
  await ensureRow(userId);
  const isFinal = step === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
  const [row] = await db
    .update(onboardingState)
    .set({
      currentStep: step,
      updatedAt: new Date(),
      completedAt: isFinal ? new Date() : sql`${onboardingState.completedAt}`,
    })
    .where(eq(onboardingState.userId, userId))
    .returning();
  return toSnapshot(row!);
}

export async function patchOnboardingPayload(
  userId: string,
  patch: OnboardingPayload,
): Promise<OnboardingSnapshot> {
  await ensureRow(userId);
  const [row] = await db
    .update(onboardingState)
    .set({
      payload: sql`COALESCE(${onboardingState.payload}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(onboardingState.userId, userId))
    .returning();
  return toSnapshot(row!);
}

export async function markOnboardingComplete(userId: string): Promise<OnboardingSnapshot> {
  await ensureRow(userId);
  const [row] = await db
    .update(onboardingState)
    .set({
      currentStep: ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1] as OnboardingStep,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingState.userId, userId))
    .returning();
  return toSnapshot(row!);
}
