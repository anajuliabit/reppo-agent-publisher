import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/validate.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/validate.js')>('../../lib/validate.js');
  return actual;
});

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

import { cmdMint } from '../mint.js';
import { mintPod, submitMetadata } from '../../lib/chain.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdMint', () => {
  beforeEach(() => {
    setJsonMode(false);
    vi.mocked(mintPod).mockResolvedValue({ txHash: '0xabc' as `0x${string}`, receipt: {} as never, podId: 1n });
    vi.mocked(submitMetadata).mockResolvedValue({ success: true });
  });

  it('throws on short title', async () => {
    await expect(cmdMint({ title: 'ab', url: 'https://moltbook.com/post/1' })).rejects.toThrow(
      'Title must be at least 3 characters',
    );
  });

  it('throws on invalid description', async () => {
    await expect(
      cmdMint({ title: 'Valid Title', url: 'https://moltbook.com/post/1', description: 'short' }),
    ).rejects.toThrow('Description must be at least 10 characters');
  });

  it('prints dry-run message in human mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdMint({ title: 'Valid Title', url: 'https://moltbook.com/post/1', dryRun: true });
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[dry-run]');
    expect(output).toContain('Would mint pod');
  });

  it('outputs JSON in dry-run mode', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdMint({ title: 'Valid Title', url: 'https://moltbook.com/post/1', dryRun: true });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.dryRun).toBe(true);
    expect(output.title).toBe('Valid Title');
    expect(output.url).toBe('https://moltbook.com/post/1');
  });

  it('calls mintPod and submitMetadata on real run', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdMint({ title: 'Test Pod', url: 'https://moltbook.com/post/1' });
    expect(mintPod).toHaveBeenCalledWith({ skipApprove: false });
    expect(submitMetadata).toHaveBeenCalledWith({
      txHash: '0xabc',
      title: 'Test Pod',
      description: undefined,
      url: 'https://moltbook.com/post/1',
      imageURL: undefined,
    });
  });

  it('outputs JSON result with txHash and podId', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdMint({ title: 'Test Pod', url: 'https://moltbook.com/post/1' });
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.txHash).toBe('0xabc');
    expect(output.podId).toBe('1');
    expect(output.txUrl).toContain('basescan.org');
  });

  it('outputs human-readable result', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdMint({ title: 'Test Pod', url: 'https://moltbook.com/post/1' });
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Pod published!');
    expect(output).toContain('basescan.org');
    expect(output).toContain('Pod ID: 1');
  });
});
