import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/validate.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/validate.js')>('../../lib/validate.js');
  return actual;
});

vi.mock('../../lib/moltbook.js', () => ({
  postToMoltbook: vi.fn().mockResolvedValue({ id: 'post-123', url: 'https://moltbook.com/post/post-123' }),
}));

vi.mock('../../lib/output.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/output.js')>('../../lib/output.js');
  return actual;
});

import { cmdPost } from '../post.js';
import { postToMoltbook } from '../../lib/moltbook.js';
import { setJsonMode } from '../../lib/output.js';

describe('cmdPost', () => {
  beforeEach(() => {
    setJsonMode(false);
    vi.mocked(postToMoltbook).mockResolvedValue({ id: 'post-123', url: 'https://moltbook.com/post/post-123' });
  });

  it('throws on short title', async () => {
    await expect(cmdPost({ title: 'ab', body: 'Some body text here' })).rejects.toThrow(
      'Title must be at least 3 characters',
    );
  });

  it('throws on empty body', async () => {
    await expect(cmdPost({ title: 'Valid Title', body: '' })).rejects.toThrow('Body cannot be empty');
  });

  it('prints dry-run message in human mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdPost({ title: 'Valid Title', body: 'Some body text', dryRun: true });
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[dry-run]');
    expect(output).toContain('Would post to Moltbook');
  });

  it('outputs JSON in dry-run mode when json mode is enabled', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdPost({ title: 'Valid Title', body: 'Some body text', dryRun: true });
    expect(spy).toHaveBeenCalled();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.dryRun).toBe(true);
    expect(output.submolt).toBe('datatrading');
  });

  it('uses custom submolt in dry-run JSON output', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdPost({ title: 'Valid Title', body: 'Some body text', submolt: 'agentmind', dryRun: true });
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.submolt).toBe('agentmind');
  });

  it('calls postToMoltbook with correct args', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdPost({ title: 'Test Post', body: 'Body text', submolt: 'agentmind' });
    expect(postToMoltbook).toHaveBeenCalledWith({
      title: 'Test Post',
      body: 'Body text',
      submolt: 'agentmind',
    });
  });

  it('outputs JSON result when json mode is enabled', async () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmdPost({ title: 'Test Post', body: 'Body text' });
    expect(spy).toHaveBeenCalled();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.id).toBe('post-123');
    expect(output.url).toContain('moltbook.com');
  });
});
