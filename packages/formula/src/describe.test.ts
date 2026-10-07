import { describe, expect, it } from 'vitest';
import { describeFormulaProblem, run } from './index';

const scope = { get: () => undefined };

describe('describeFormulaProblem', () => {
  it('says nothing for a result without a problem', () => {
    expect(describeFormulaProblem(run('1 + 1', scope))).toBe(undefined);
  });
  it.each([
    ['1 +', 'not written correctly'],
    ['Nope + 1', 'name that does not exist'],
    ['1 / 0', 'divides by zero'],
    ["1 - 'a'", 'do not fit'],
  ])('describes %s', (source, part) => {
    expect(describeFormulaProblem(run(source, scope))).toContain(part);
  });
  it('points people who write "or" to || and OR()', () => {
    const said = describeFormulaProblem(run('1 or 2', scope));
    expect(said).toContain('Write || instead of "or"');
    expect(said).toContain('OR(...)');
  });
  it('passes through a message without a code', () => {
    expect(describeFormulaProblem({ error: 'Odd.' })).toBe('Odd.');
  });
});
