import { describe, expect, it } from 'vitest';
import { canLeaveInputStep, isBrandDnaSufficient } from './onboardingValidation';

describe('isBrandDnaSufficient', () => {
  it('false for empty brand', () => {
    expect(isBrandDnaSufficient({ name: '', description: '', palette: [] })).toBe(false);
  });
  it('false for fallback default name only', () => {
    expect(isBrandDnaSufficient({ name: 'my brand', description: '', palette: [] })).toBe(false);
  });
  it('true with real name + description', () => {
    expect(isBrandDnaSufficient({ name: 'Acme', description: 'we sell widgets', palette: [] })).toBe(
      true,
    );
  });
  it('true with real name + at least one color', () => {
    expect(isBrandDnaSufficient({ name: 'Acme', description: '', palette: ['#ff0000'] })).toBe(
      true,
    );
  });
});

describe('canLeaveInputStep', () => {
  it('false when brand name is empty', () => {
    expect(canLeaveInputStep({ brandName: '', description: 'hello', url: '' })).toBe(false);
  });
  it('false when brand name present but no description or url', () => {
    expect(canLeaveInputStep({ brandName: 'Acme', description: '', url: '' })).toBe(false);
  });
  it('true when brand name + description', () => {
    expect(canLeaveInputStep({ brandName: 'Acme', description: 'we sell things', url: '' })).toBe(
      true,
    );
  });
  it('true when brand name + url', () => {
    expect(canLeaveInputStep({ brandName: 'Acme', description: '', url: 'acme.co' })).toBe(true);
  });
});
