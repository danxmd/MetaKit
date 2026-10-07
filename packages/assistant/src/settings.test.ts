import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSISTANT_SETTINGS,
  createKeyStore,
  createSettingsStore,
  memoryKeyValue,
} from './settings';

const FAKE_KEY = 'sk-ant-fake-not-a-real-key-0001';

describe('assistant settings', () => {
  it('are off by default with the default model', async () => {
    const store = createSettingsStore(memoryKeyValue());
    expect(await store.load()).toEqual(DEFAULT_ASSISTANT_SETTINGS);
    expect(DEFAULT_ASSISTANT_SETTINGS).toEqual({
      enabled: false,
      providerId: 'claude',
      model: 'claude-sonnet-5-5',
    });
  });

  it('remember what was saved and ignore damaged values', async () => {
    const kv = memoryKeyValue();
    const store = createSettingsStore(kv);
    await store.save({ enabled: true, model: ' claude-test ' });
    expect(await store.load()).toMatchObject({
      enabled: true,
      model: 'claude-test',
    });
    await kv.set('assistantSettings', { enabled: 'yes', model: 3 });
    expect(await store.load()).toEqual(DEFAULT_ASSISTANT_SETTINGS);
  });
});

describe('key store', () => {
  it('has a key only while it is added', async () => {
    const keys = createKeyStore(memoryKeyValue());
    expect(await keys.has('claude')).toBe(false);
    expect(await keys.reveal('claude')).toBeNull();
    await keys.add('claude', `  ${FAKE_KEY}  `);
    expect(await keys.has('claude')).toBe(true);
    expect(await keys.reveal('claude')).toBe(FAKE_KEY);
    await keys.remove('claude');
    expect(await keys.has('claude')).toBe(false);
    expect(await keys.reveal('claude')).toBeNull();
  });

  it('keeps providers apart and refuses an empty key', async () => {
    const keys = createKeyStore(memoryKeyValue());
    await keys.add('claude', FAKE_KEY);
    expect(await keys.has('other')).toBe(false);
    await expect(keys.add('claude', '   ')).rejects.toThrow('Enter a key');
    expect(await keys.reveal('claude')).toBe(FAKE_KEY);
  });

  it('never writes the key next to the settings', async () => {
    const kv = memoryKeyValue();
    await createKeyStore(kv).add('claude', FAKE_KEY);
    const settings = createSettingsStore(kv);
    await settings.save({ enabled: true });
    expect(JSON.stringify(await kv.get('assistantSettings'))).not.toContain(
      FAKE_KEY,
    );
    await createKeyStore(kv).remove('claude');
    expect(kv.dump()).not.toContain(FAKE_KEY);
  });
});
