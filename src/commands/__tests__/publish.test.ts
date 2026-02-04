import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/validate.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/validate.js')>('../../lib/validate.js');
  return actual;
});

vi.mock('../../lib/moltbook.js', () => ({
  postToMoltbook: vi.fn().mockResolvedValue({ id: 'post-123', url: 'https://moltbook.com/post/post-123' }),
}));

vi.mock('../../lib/chain.js', () => ({
  mintPod: vi.fn().mockResolvedValue({
    txHash: '0xabc',
    receipt: {},
    podId: 1n,
  }),
  submitMetadata: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdPublish } from '../publish.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdPublish', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('throws on short title', async () => {
    await expect(
      cmdPublish({ title: 'ab', body: 'The fridge hums its one note, the faucet drips in 3/4 time.' }),
    ).rejects.toThrow('Title must be at least 3 characters');
  });

  it('throws on empty body', async () => {
    await expect(
      cmdPublish({ title: 'Kitchen at Midnight', body: '' }),
    ).rejects.toThrow('Body cannot be empty');
  });

  it('throws on whitespace-only body', async () => {
    await expect(
      cmdPublish({ title: 'Kitchen at Midnight', body: '   ' }),
    ).rejects.toThrow('Body cannot be empty');
  });

  describe('dry-run mode', () => {
    it('outputs human-readable steps when not in JSON mode', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await cmdPublish({
        title: 'Kitchen at Midnight',
        body: 'The fridge hums its one note, the faucet drips in 3/4 time.',
        dryRun: true,
      });
      const output = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[dry-run]');
      expect(output).toContain('Would post to Moltbook');
      expect(output).toContain('Would mint pod');
    });

    it('outputs JSON structure when in JSON mode', async () => {
      setJsonMode(true);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await cmdPublish({
        title: 'Kitchen at Midnight',
        body: 'The fridge hums its one note, the faucet drips in 3/4 time.',
        dryRun: true,
      });
      expect(spy).toHaveBeenCalledOnce();
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.dryRun).toBe(true);
      expect(output.steps).toHaveLength(4);
      expect(output.steps.map((s: { action: string }) => s.action)).toEqual([
        'post',
        'approve',
        'mint',
        'submitMetadata',
      ]);
    });

    it('includes submolt in dry-run JSON output', async () => {
      setJsonMode(true);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await cmdPublish({
        title: 'Kitchen at Midnight',
        body: 'The fridge hums its one note, the faucet drips in 3/4 time.',
        submolt: 'custom-submolt',
        dryRun: true,
      });
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.steps[0].submolt).toBe('custom-submolt');
    });
  });
});
