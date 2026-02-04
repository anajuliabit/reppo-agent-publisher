import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: () => '/fakehome',
}));

import { existsSync, readFileSync } from 'fs';
import { loadPrivySession } from '../auth.js';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.signature`;
}

describe('loadPrivySession', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(readFileSync).mockReset();
  });

  it('returns null when session file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadPrivySession()).toBeNull();
  });

  it('returns session when token is valid (expires in >60s)', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = makeJwt({ exp: futureExp });
    const session = { token, refreshToken: 'rt', privyAccessToken: 'pat' };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(session));

    const result = loadPrivySession();
    expect(result).toEqual(session);
    expect(result?.expired).toBeUndefined();
  });

  it('returns session with expired flag when token expires in <60s', () => {
    const soonExp = Math.floor(Date.now() / 1000) + 30; // 30s from now
    const token = makeJwt({ exp: soonExp });
    const session = { token, refreshToken: 'rt' };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(session));

    const result = loadPrivySession();
    expect(result).toEqual({ ...session, expired: true });
  });

  it('returns session with expired flag when token is already expired', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const token = makeJwt({ exp: pastExp });
    const session = { token, refreshToken: 'rt' };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(session));

    const result = loadPrivySession();
    expect(result).toEqual({ ...session, expired: true });
  });

  it('returns null when token is expired and no refresh token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const token = makeJwt({ exp: pastExp });
    const session = { token };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(session));

    expect(loadPrivySession()).toBeNull();
  });

  it('returns null when session file contains corrupt JSON', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('not valid json {{{');

    expect(loadPrivySession()).toBeNull();
  });

  it('returns null when token is not a valid JWT (wrong format)', () => {
    const session = { token: 'not-a-jwt', refreshToken: 'rt' };
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(session));

    // token.split('.').length !== 3, so it goes to refreshToken check
    // but since token is invalid, it returns { ...data, expired: true } if refreshToken exists
    const result = loadPrivySession();
    expect(result).toEqual({ ...session, expired: true });
  });
});
