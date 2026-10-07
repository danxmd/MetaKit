import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_TYPES, validateAttribute } from '@metakit-app/core';
import {
  blankAttribute,
  labelIn,
  optionsToText,
  textToOptions,
  uniqueKey,
  withLabel,
} from './attributes';

describe('blank attributes', () => {
  it.each(ATTRIBUTE_TYPES)('a new %s attribute is valid', (type) => {
    expect(validateAttribute(blankAttribute(type, 'Thing'), ['en'])).toEqual(
      [],
    );
  });
});

describe('keys and labels', () => {
  it('makes keys that nothing else uses', () => {
    expect(uniqueKey('Name', ['Other'])).toBe('Name');
    expect(uniqueKey('Name', ['Name'])).toBe('Name2');
    expect(uniqueKey('Name', ['Name', 'Name2'])).toBe('Name3');
    expect(uniqueKey('my attr!', [])).toBe('myattr');
    expect(uniqueKey('9 lives', [])).toBe('_9lives');
    expect(uniqueKey('', [])).toBe('Item');
  });

  it('reads and sets labels per language', () => {
    expect(labelIn({ de: 'Aufgabe' }, 'en', 'Task')).toBe('Aufgabe');
    expect(labelIn(undefined, 'en', 'Task')).toBe('Task');
    expect(withLabel({ en: 'A' }, 'de', 'B')).toEqual({ en: 'A', de: 'B' });
    expect(withLabel({ en: 'A', de: 'B' }, 'de', ' ')).toEqual({ en: 'A' });
  });
});

describe('options as text', () => {
  it('round-trips values and labels, dropping blanks and duplicates', () => {
    const text = 'Low\nMedium | Mittel\n\nHigh\nLow';
    const options = textToOptions(text, 'de');
    expect(options).toEqual([
      'Low',
      { value: 'Medium', labels: { de: 'Mittel' } },
      'High',
    ]);
    expect(optionsToText(options, 'de')).toBe('Low\nMedium | Mittel\nHigh');
  });

  it('keeps labels in other languages when the text for one language is edited', () => {
    const previous = [{ value: 'A', labels: { en: 'Alpha', de: 'Alfa' } }];
    expect(textToOptions('A | Alpha2', 'en', previous)).toEqual([
      { value: 'A', labels: { en: 'Alpha2', de: 'Alfa' } },
    ]);
    expect(textToOptions('A', 'en', previous)).toEqual([
      { value: 'A', labels: { de: 'Alfa' } },
    ]);
  });
});
