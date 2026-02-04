import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: () => '/fakehome',
}));

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { loadKey, saveKey, getRpcUrl, CONFIG_DIR } from '../config.js';

describe('CONFIG_DIR', () => {
  it('is based on homedir', () => {
    expect(CONFIG_DIR).toBe('/fakehome/.config/reppo');
  });
});

describe('loadKey', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(readFileSync).mockReset();
    delete process.env['REPPO_API_KEY'];
    delete process.env['REPPO_PRIVATE_KEY'];
    delete process.env['MOLTBOOK_API_KEY'];
  });

  it('loads from environment variable', () => {
    process.env['REPPO_API_KEY'] = ' my-api-key ';
    const result = loadKey('api_key');
    expect(result).toBe('my-api-key');
    expect(existsSync).not.toHaveBeenCalled();
  });

  it('loads from file when env var is not set', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(' file-key \n');
    const result = loadKey('private_key');
    expect(result).toBe('file-key');
    expect(readFileSync).toHaveBeenCalledWith('/fakehome/.config/reppo/private_key', 'utf-8');
  });

  it('returns null when both env and file are missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = loadKey('api_key');
    expect(result).toBeNull();
  });
});

describe('saveKey', () => {
  beforeEach(() => {
    vi.mocked(mkdirSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
  });

  it('writes file with 0600 permissions', () => {
    saveKey('api_key', ' my-key ');
    expect(mkdirSync).toHaveBeenCalledWith('/fakehome/.config/reppo', { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      '/fakehome/.config/reppo/api_key',
      'my-key\n',
      { mode: 0o600 },
    );
  });
});

describe('getRpcUrl', () => {
  beforeEach(() => {
    delete process.env['REPPO_RPC_URL'];
    delete process.env['REPPO_RPC_URL'];
    vi.mocked(existsSync).mockReset();
    vi.mocked(readFileSync).mockReset();
  });

  it('returns env var value when set', () => {
    process.env['REPPO_RPC_URL'] = 'https://my-rpc.example.com';
    expect(getRpcUrl()).toBe('https://my-rpc.example.com');
  });

  it('returns value from config file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('https://file-rpc.example.com\n');
    expect(getRpcUrl()).toBe('https://file-rpc.example.com');
  });

  it('returns empty string when nothing is configured', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(getRpcUrl()).toBe('');
  });
});
