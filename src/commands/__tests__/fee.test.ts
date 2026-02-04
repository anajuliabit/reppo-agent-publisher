import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/chain.js', () => ({
  getPublishingFee: vi.fn().mockResolvedValue(0n),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdFee } from '../fee.js';
import { getPublishingFee } from '../../lib/chain.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdFee', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('prints zero fee in human mode', async () => {
    vi.mocked(getPublishingFee).mockResolvedValue(0n);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdFee();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Publishing fee: 0');
    expect(output).toContain('No fee required!');
  });

  it('prints non-zero fee in human mode', async () => {
    vi.mocked(getPublishingFee).mockResolvedValue(1000000000000000000n); // 1 REPPO
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdFee();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Publishing fee: 1');
    expect(output).not.toContain('No fee required!');
  });

  it('outputs JSON with fee details', async () => {
    setJsonMode(true);
    vi.mocked(getPublishingFee).mockResolvedValue(1000000000000000000n);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdFee();
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.fee).toBe('1000000000000000000');
    expect(output.feeFormatted).toBe('1');
    expect(output.decimals).toBe(18);
    expect(output.symbol).toBe('REPPO');
  });

  it('outputs JSON with zero fee', async () => {
    setJsonMode(true);
    vi.mocked(getPublishingFee).mockResolvedValue(0n);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdFee();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.fee).toBe('0');
    expect(output.feeFormatted).toBe('0');
  });
});
