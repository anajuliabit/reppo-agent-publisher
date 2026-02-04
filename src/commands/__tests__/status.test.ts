import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/config.js', () => ({
  loadKey: vi.fn(),
  CONFIG_DIR: '/home/test/.config/reppo',
}));

vi.mock('../../lib/auth.js', () => ({
  loadPrivySession: vi.fn(),
}));

vi.mock('../../lib/chain.js', () => ({
  getReppoBalance: vi.fn().mockResolvedValue(5000000000000000000n),
  getEthBalance: vi.fn().mockResolvedValue(100000000000000000n),
  getPublishingFee: vi.fn().mockResolvedValue(0n),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
  })),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdStatus } from '../status.js';
import { loadKey } from '../../lib/config.js';
import { loadPrivySession } from '../../lib/auth.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdStatus', () => {
  beforeEach(() => {
    setJsonMode(false);
    vi.mocked(loadKey).mockReturnValue(null);
    vi.mocked(loadPrivySession).mockReturnValue(null);
  });

  it('shows missing keys in human mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Private key:');
    expect(output).toContain('missing');
    expect(output).toContain('Moltbook API key:');
  });

  it('shows configured keys when present', async () => {
    vi.mocked(loadKey).mockImplementation((name) => {
      if (name === 'private_key') return '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      if (name === 'moltbook_key') return 'moltbook_sk_test';
      return null;
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('configured');
    expect(output).toContain('Wallet:');
    expect(output).toContain('ETH balance');
    expect(output).toContain('REPPO balance');
  });

  it('shows active privy session', async () => {
    vi.mocked(loadPrivySession).mockReturnValue({ token: 'test', expired: false, userId: 'user-1' });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('active');
    expect(output).toContain('user-1');
  });

  it('shows expired privy session', async () => {
    vi.mocked(loadPrivySession).mockReturnValue({ token: 'test', expired: true });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('expired');
  });

  it('outputs JSON with wallet data when key is configured', async () => {
    setJsonMode(true);
    vi.mocked(loadKey).mockImplementation((name) => {
      if (name === 'private_key') return '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      return null;
    });
    vi.mocked(loadPrivySession).mockReturnValue(null);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.auth.privateKey).toBe(true);
    expect(output.wallet.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(output.wallet.canPublish).toBe(true);
    expect(output.config.chainId).toBe(8453);
  });

  it('outputs JSON without wallet when key is missing', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdStatus();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.auth.privateKey).toBe(false);
    expect(output.wallet).toBeUndefined();
  });
});
