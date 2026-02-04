import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/swap.js', () => ({
  buyReppo: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdBuy } from '../buy.js';
import { buyReppo } from '../../lib/swap.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdBuy', () => {
  beforeEach(() => {
    setJsonMode(false);
    vi.mocked(buyReppo).mockResolvedValue(null);
  });

  it('throws on zero amount', async () => {
    await expect(cmdBuy({ amount: '0' })).rejects.toThrow('Amount must be greater than 0');
  });

  it('throws on negative amount', async () => {
    await expect(cmdBuy({ amount: '-5' })).rejects.toThrow('Amount must be greater than 0');
  });

  it('throws on invalid slippage', async () => {
    await expect(cmdBuy({ amount: '100', slippage: '150' })).rejects.toThrow(
      'Slippage must be a number between 0 and 100',
    );
  });

  it('throws on NaN slippage', async () => {
    await expect(cmdBuy({ amount: '100', slippage: 'abc' })).rejects.toThrow(
      'Slippage must be a number between 0 and 100',
    );
  });

  it('calls buyReppo with parsed amount and default slippage', async () => {
    await cmdBuy({ amount: '100', dryRun: true });
    expect(buyReppo).toHaveBeenCalledWith({
      amount: 100n * 10n ** 18n,
      slippage: 1,
      dryRun: true,
    });
  });

  it('calls buyReppo with custom slippage', async () => {
    await cmdBuy({ amount: '50', slippage: '0.5', dryRun: true });
    expect(buyReppo).toHaveBeenCalledWith({
      amount: 50n * 10n ** 18n,
      slippage: 0.5,
      dryRun: true,
    });
  });

  it('outputs JSON in dry-run mode when json mode is enabled', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdBuy({ amount: '100', dryRun: true });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.dryRun).toBe(true);
    expect(output.amountReppo).toBe('100');
    expect(output.slippage).toBe(1);
  });

  it('outputs human-readable result after successful swap', async () => {
    vi.mocked(buyReppo).mockResolvedValue({
      txHash: '0xabc123' as `0x${string}`,
      amountIn: 5050000n,
      amountOut: 100n * 10n ** 18n,
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdBuy({ amount: '100' });
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Swap complete!');
    expect(output).toContain('USDC spent');
    expect(output).toContain('REPPO received');
    expect(output).toContain('basescan.org');
  });

  it('outputs JSON result after successful swap', async () => {
    setJsonMode(true);
    vi.mocked(buyReppo).mockResolvedValue({
      txHash: '0xabc123' as `0x${string}`,
      amountIn: 5050000n,
      amountOut: 100n * 10n ** 18n,
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdBuy({ amount: '100' });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.txHash).toBe('0xabc123');
    expect(output.txUrl).toContain('basescan.org');
  });
});
