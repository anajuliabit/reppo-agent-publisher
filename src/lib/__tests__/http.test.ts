import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJSON, withRetry } from '../http.js';

// Stub the global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock constants to use short delays in tests
vi.mock('../../constants.js', () => ({
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 10,
}));

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, { status });
}

describe('fetchJSON', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ result: 'ok' }));
    const data = await fetchJSON<{ result: string }>('https://example.com/api');
    expect(data).toEqual({ result: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('throws on HTTP error with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404));
    await expect(fetchJSON('https://example.com/api')).rejects.toThrow('HTTP 404: {"error":"not found"}');
  });

  it('throws on HTTP error with text body', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('server error', 500));
    await expect(fetchJSON('https://example.com/api')).rejects.toThrow('HTTP 500: server error');
  });

  it('returns text when response is not valid JSON but status is ok', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('plain text', 200));
    const data = await fetchJSON('https://example.com/api');
    expect(data).toBe('plain text');
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValueOnce('ok');
    const result = await withRetry(fn, 'test');
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds after failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, 'test', 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries exhausted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 'test', 2)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff delays', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler, ms?: number) => {
      delays.push(ms ?? 0);
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof originalSetTimeout>;
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, 'test', 3);
    // RETRY_BASE_DELAY is 10, so delays should be 10*2^0=10, 10*2^1=20
    expect(delays).toEqual([10, 20]);
  });
});
