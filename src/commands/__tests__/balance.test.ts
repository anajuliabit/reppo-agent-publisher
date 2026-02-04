import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/chain.js', () => ({
  getClients: vi.fn(() => ({
    account: { address: '0x1234567890abcdef1234567890abcdef12345678' },
    publicClient: {
      readContract: vi.fn().mockResolvedValue(50000000n), // 50 USDC
    },
  })),
  getReppoBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 REPPO
  getEthBalance: vi.fn().mockResolvedValue(500000000000000000n), // 0.5 ETH
}));

vi.mock('../../lib/http.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdBalance } from '../balance.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdBalance', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('prints balances in human mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdBalance();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Wallet:');
    expect(output).toContain('ETH:');
    expect(output).toContain('REPPO:');
    expect(output).toContain('USDC:');
    expect(output).toContain('0.5');
  });

  it('outputs JSON with all balances', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdBalance();
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(output.eth.formatted).toBe('0.5');
    expect(output.reppo.formatted).toBe('1');
    expect(output.usdc.formatted).toBe('50');
  });
});
