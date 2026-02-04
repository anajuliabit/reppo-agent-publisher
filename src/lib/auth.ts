import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { PRIVY_API, PRIVY_APP_ID } from '../constants.js';
import { CONFIG_DIR, loadKey, writeSecureFile } from './config.js';
import type { PrivySession, SiweInitResponse, SiweAuthResponse, SessionRefreshResponse } from '../types.js';

const PRIVY_SESSION_FILE = join(CONFIG_DIR, 'privy_session.json');

function privyHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'privy-app-id': PRIVY_APP_ID,
    'privy-client': 'react-auth:3.13.1',
    ...extraHeaders,
  };
}

function buildSiweMessage({ address, nonce, chainId = 1 }: { address: string; nonce: string; chainId?: number }): string {
  const domain = 'reppo.ai';
  const uri = 'https://reppo.ai';
  const issuedAt = new Date().toISOString();
  const version = '1';

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    `By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.`,
    '',
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

export function loadPrivySession(): PrivySession | null {
  if (!existsSync(PRIVY_SESSION_FILE)) return null;
  try {
    const data: PrivySession = JSON.parse(readFileSync(PRIVY_SESSION_FILE, 'utf-8'));
    if (data.token && data.token.split('.').length === 3) {
      const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString()) as { exp?: number };
      // Token is valid if it won't expire within the next 60 seconds
      if (payload.exp && payload.exp * 1000 > Date.now() + 60000) {
        return data;
      }
    }
    if (data.refreshToken) return { ...data, expired: true };
    return null;
  } catch {
    return null;
  }
}

function savePrivySession(session: PrivySession): void {
  writeSecureFile(PRIVY_SESSION_FILE, JSON.stringify(session, null, 2));
}

async function refreshSession(session: PrivySession): Promise<PrivySession | null> {
  console.log('Refreshing Privy session...');
  try {
    const res = await fetch(`${PRIVY_API}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        ...privyHeaders(),
        authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SessionRefreshResponse;
    const newSession: PrivySession = {
      token: data.token || session.token,
      privyAccessToken: data.privy_access_token || session.privyAccessToken,
      refreshToken: data.refresh_token || session.refreshToken,
    };
    savePrivySession(newSession);
    console.log('Session refreshed');
    return newSession;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Refresh failed: ${msg}`);
    return null;
  }
}

export async function privyLogin(): Promise<PrivySession> {
  const pk = loadKey('private_key');
  if (!pk) throw new Error('Private key not found. Set REPPO_PRIVATE_KEY or create ~/.config/reppo/private_key');
  const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);

  let session = loadPrivySession();
  if (session && !session.expired) {
    return session;
  }
  if (session?.expired && session.refreshToken) {
    const refreshed = await refreshSession(session);
    if (refreshed) return refreshed;
  }

  console.log(`Logging into Reppo via Privy (wallet: ${account.address})...`);

  // Step 1: Get SIWE nonce
  const initRes = await fetch(`${PRIVY_API}/api/v1/siwe/init`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({ address: account.address }),
  });
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`SIWE init failed (${initRes.status}): ${err}`);
  }
  const { nonce } = (await initRes.json()) as SiweInitResponse;

  // Step 2: Build and sign SIWE message
  const message = buildSiweMessage({ address: account.address, nonce, chainId: 1 });
  const signature = await account.signMessage({ message });

  // Step 3: Authenticate
  const authRes = await fetch(`${PRIVY_API}/api/v1/siwe/authenticate`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      message,
      signature,
      chainId: 'eip155:1',
      walletClientType: 'unknown',
      connectorType: 'injected',
      mode: 'login-or-sign-up',
    }),
  });
  if (!authRes.ok) {
    const err = await authRes.text();
    throw new Error(`SIWE authenticate failed (${authRes.status}): ${err}`);
  }
  const authData = (await authRes.json()) as SiweAuthResponse;

  session = {
    token: authData.token,
    privyAccessToken: authData.privy_access_token,
    refreshToken: authData.refresh_token,
    userId: authData.user?.id,
  };
  savePrivySession(session);
  console.log(`Logged in as ${authData.user?.id || 'unknown'}`);
  return session;
}

export async function getPrivyAuthHeaders(): Promise<Record<string, string>> {
  const session = await privyLogin();
  return {
    Authorization: `Bearer ${session.token}`,
  };
}
