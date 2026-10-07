import { describe, expect, it } from 'vitest';
import { formulaProblem, messageProblem } from './formula-check';

describe('formulaProblem', () => {
  it('accepts a correct formula with or without =', () => {
    expect(formulaProblem('Effort > 0')).toBeUndefined();
    expect(formulaProblem('= Effort > 0')).toBeUndefined();
  });
  it('asks for a formula only when one is required', () => {
    expect(formulaProblem('  ')).toBeUndefined();
    expect(formulaProblem('', { required: true })).toBe('Write a formula.');
  });
  it('describes a syntax problem in plain English', () => {
    expect(formulaProblem('Effort >')).toMatch(/not written correctly/);
  });
});

describe('messageProblem', () => {
  it('only checks messages that are formulas', () => {
    expect(messageProblem('Effort must be above zero')).toBeUndefined();
    expect(messageProblem('= "Effort " +')).toMatch(/not written correctly/);
  });
});
