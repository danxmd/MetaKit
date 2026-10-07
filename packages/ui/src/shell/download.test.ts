import { describe, expect, it } from 'vitest';
import { exportFileName } from './download';

describe('exportFileName', () => {
  it('adds the format as the extension', () => {
    expect(exportFileName('Order process', 'svg')).toBe('Order process.svg');
    expect(exportFileName('Order process', 'png')).toBe('Order process.png');
    expect(exportFileName('Order process', 'pdf')).toBe('Order process.pdf');
  });

  it('replaces characters that file systems refuse', () => {
    expect(exportFileName('A/B: "C" <D>?*|', 'png')).toBe('A B C D.png');
    expect(exportFileName('tab\there', 'svg')).toBe('tab here.svg');
  });

  it('keeps accented and non-Latin names', () => {
    expect(exportFileName('Bestellprozess für Käse', 'pdf')).toBe(
      'Bestellprozess für Käse.pdf',
    );
    expect(exportFileName('订单流程', 'svg')).toBe('订单流程.svg');
  });

  it('falls back to "model" for names with nothing usable', () => {
    expect(exportFileName('', 'svg')).toBe('model.svg');
    expect(exportFileName('  ...  ', 'png')).toBe('model.png');
    expect(exportFileName('///', 'pdf')).toBe('model.pdf');
  });

  it('drops leading and trailing dots and keeps names short', () => {
    expect(exportFileName('.hidden.', 'svg')).toBe('hidden.svg');
    expect(exportFileName('x'.repeat(300), 'svg')).toBe(
      `${'x'.repeat(100)}.svg`,
    );
  });
});
