#!/usr/bin/env npx tsx

/**
 * Reppo AgentMind Publisher
 *
 * Commands:
 *   post      - Post content to Moltbook
 *   mint      - Mint a pod on-chain (Base) and submit metadata to Reppo
 *   auto      - Post to Moltbook + mint pod + submit metadata in one step
 *   fee       - Check current publishing fee
 *   status    - Check auth and config
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  type TransactionReceipt,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

// --- Types ---

interface ParsedArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}

interface PrivySession {
  token: string;
  privyAccessToken?: string;
  refreshToken?: string;
  userId?: string;
  expired?: boolean;
}

interface SiweInitResponse {
  nonce: string;
}

interface SiweAuthResponse {
  token: string;
  privy_access_token?: string;
  refresh_token?: string;
  user?: { id: string };
}

interface SessionRefreshResponse {
  token?: string;
  privy_access_token?: string;
  refresh_token?: string;
}

interface MoltbookPostResponse {
  id: string;
  url?: string;
}

interface MoltbookResult {
  id: string;
  url: string;
}

interface MintResult {
  txHash: Hash;
  receipt: TransactionReceipt;
}

interface SubmitMetadataParams {
  txHash: Hash;
  title: string;
  description?: string;
  url: string;
  imageURL?: string;
}

interface Clients {
  account: PrivateKeyAccount;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

type KeyName = 'api_key' | 'moltbook_key' | 'private_key';

// --- Constants ---

const CONFIG_DIR = join(homedir(), '.config', 'reppo');
const REPPO_API = 'https://reppo.ai/api/v1' as const;
const PRIVY_API = 'https://auth.privy.io' as const;
const PRIVY_APP_ID = 'cm6oljano016v9x3xsd1xw36p' as const;
const MOLTBOOK_API = 'https://moltbook.com/api' as const;
const DEFAULT_SUBMOLT = 'datatrading' as const;

const POD_CONTRACT: Address = '0xcfF0511089D0Fbe92E1788E4aFFF3E7930b3D47c';
const REPPO_TOKEN: Address = '0xFf8104251E7761163faC3211eF5583FB3F8583d6';
const CHAIN_ID = 8453 as const; // Base
const EMISSION_SHARE = 50 as const; // hardcoded in UI

const POD_ABI = parseAbi([
  'function mintPod(address to, uint8 emissionSharePercent) returns (uint256 podId)',
  'function publishingFee() view returns (uint256)',
  'function burnPod(uint256 podId)',
]);

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

// --- Helpers ---

const ENV_MAP: Record<KeyName, string> = {
  api_key: 'REPPO_API_KEY',
  moltbook_key: 'MOLTBOOK_API_KEY',
  private_key: 'REPPO_PRIVATE_KEY',
};

function loadKey(name: KeyName): string | null {
  const envVar = ENV_MAP[name];
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!.trim();
  }
  const path = join(CONFIG_DIR, name);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      parsed[key] = val;
    } else {
      (parsed._ as string[]).push(args[i]);
    }
  }
  return parsed;
}

async function fetchJSON<T = unknown>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const text = await res.text();
  let data: T | string;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data as T;
}

function getClients(): Clients {
  const pk = loadKey('private_key');
  if (!pk) throw new Error('Private key not found. Set REPPO_PRIVATE_KEY or create ~/.config/reppo/private_key');

  const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  return { account, publicClient, walletClient };
}

// --- Privy SIWE Auth ---

const PRIVY_SESSION_FILE = join(CONFIG_DIR, 'privy_session.json');

function loadPrivySession(): PrivySession | null {
  if (!existsSync(PRIVY_SESSION_FILE)) return null;
  try {
    const data: PrivySession = JSON.parse(readFileSync(PRIVY_SESSION_FILE, 'utf-8'));
    // Check if token looks valid (JWT has 3 parts)
    if (data.token && data.token.split('.').length === 3) {
      // Decode JWT to check expiry
      const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString()) as { exp?: number };
      if (payload.exp && payload.exp * 1000 > Date.now() - 60000) {
        return data;
      }
    }
    // Try refresh if we have a refresh token
    if (data.refreshToken) return { ...data, expired: true };
    return null;
  } catch {
    return null;
  }
}

function savePrivySession(session: PrivySession): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(PRIVY_SESSION_FILE, JSON.stringify(session, null, 2));
}

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

async function privyRefreshSession(session: PrivySession): Promise<PrivySession | null> {
  console.log('🔄 Refreshing Privy session...');
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
    console.log('✅ Session refreshed');
    return newSession;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`⚠️  Refresh failed: ${msg}`);
    return null;
  }
}

async function privyLogin(): Promise<PrivySession> {
  const pk = loadKey('private_key');
  if (!pk) throw new Error('Private key not found');
  const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);

  // Check existing session
  let session = loadPrivySession();
  if (session && !session.expired) {
    return session;
  }
  if (session?.expired && session.refreshToken) {
    const refreshed = await privyRefreshSession(session);
    if (refreshed) return refreshed;
  }

  console.log(`🔑 Logging into Reppo via Privy (wallet: ${account.address})...`);

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
  console.log(`✅ Logged in as ${authData.user?.id || 'unknown'}`);
  return session;
}

async function getPrivyAuthHeaders(): Promise<Record<string, string>> {
  const session = await privyLogin();
  return {
    Authorization: `Bearer ${session.token}`,
  };
}

// --- Moltbook ---

async function postToMoltbook({ title, body, submolt }: { title: string; body: string; submolt?: string }): Promise<MoltbookResult> {
  const key = loadKey('moltbook_key');
  if (!key) throw new Error('Moltbook API key not found. Set MOLTBOOK_API_KEY or create ~/.config/reppo/moltbook_key');

  console.log(`📝 Posting to Moltbook (m/${submolt || DEFAULT_SUBMOLT})...`);
  const data = await fetchJSON<MoltbookPostResponse>(`${MOLTBOOK_API}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify({ title, body, ...(submolt && { submolt }) }),
  });

  const url = data.url || `https://moltbook.com/post/${data.id}`;
  console.log(`✅ Posted to Moltbook: ${url}`);
  return { id: data.id, url };
}

// --- On-Chain ---

function getPublicClient(): PublicClient {
  return createPublicClient({ chain: base, transport: http() });
}

async function getPublishingFee(): Promise<bigint> {
  const publicClient = getPublicClient();
  const fee = await publicClient.readContract({
    address: POD_CONTRACT,
    abi: POD_ABI,
    functionName: 'publishingFee',
  });
  return fee;
}

async function getReppoBalance(address: Address): Promise<bigint> {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: REPPO_TOKEN,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
}

async function mintPod({ skipApprove }: { skipApprove: boolean }): Promise<MintResult> {
  const { account, publicClient, walletClient } = getClients();

  // Check publishing fee
  const fee = await publicClient.readContract({
    address: POD_CONTRACT,
    abi: POD_ABI,
    functionName: 'publishingFee',
  });
  console.log(`💰 Publishing fee: ${formatUnits(fee, 18)} REPPO`);

  if (fee > 0n && !skipApprove) {
    // Check balance
    const balance = await publicClient.readContract({
      address: REPPO_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log(`💳 REPPO balance: ${formatUnits(balance, 18)}`);
    if (balance < fee)
      throw new Error(`Insufficient REPPO balance. Need ${formatUnits(fee, 18)}, have ${formatUnits(balance, 18)}`);

    // Check existing allowance
    const allowance = await publicClient.readContract({
      address: REPPO_TOKEN,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, POD_CONTRACT],
    });

    if (allowance < fee) {
      console.log(`🔓 Approving REPPO spend...`);
      const approveTx = await walletClient.writeContract({
        address: REPPO_TOKEN,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [POD_CONTRACT, fee],
        chain: base,
        account,
      });
      console.log(`   Approve tx: ${approveTx}`);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log(`   ✅ Approved`);
    } else {
      console.log(`🔓 Already approved`);
    }
  }

  // Mint pod
  console.log(`⛏️  Minting pod on Base...`);
  const mintTx = await walletClient.writeContract({
    address: POD_CONTRACT,
    abi: POD_ABI,
    functionName: 'mintPod',
    args: [account.address, EMISSION_SHARE],
    chain: base,
    account,
  });
  console.log(`   Mint tx: ${mintTx}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log(`   ✅ Pod minted! Block: ${receipt.blockNumber}`);

  return { txHash: mintTx, receipt };
}

// --- Reppo Metadata ---

async function submitMetadata({ txHash, title, description, url, imageURL }: SubmitMetadataParams): Promise<unknown> {
  const authHeaders = await getPrivyAuthHeaders();

  console.log(`📤 Submitting metadata to Reppo...`);
  const data = await fetchJSON(`${REPPO_API}/pods`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      txHash,
      verifyTx: txHash,
      podName: title,
      podDescription: description || title,
      url,
      subnet: 'AGENTS',
      platform: 'moltbook',
      category: 'AGENTS',
      ...(imageURL && { imageURL }),
    }),
  });

  console.log(`✅ Metadata submitted!`);
  return data;
}

// --- Commands ---

async function cmdPost(args: ParsedArgs): Promise<MoltbookResult> {
  const { title, body, submolt } = args as ParsedArgs & { title?: string; body?: string; submolt?: string };
  if (!title || !body) {
    console.error('Usage: publish.ts post --title "..." --body "..."  [--submolt name]');
    process.exit(1);
  }
  return await postToMoltbook({ title: title as string, body: body as string, submolt: (submolt as string) || DEFAULT_SUBMOLT });
}

async function cmdMint(args: ParsedArgs): Promise<unknown> {
  const { title, description, url, imageURL } = args as ParsedArgs & {
    title?: string;
    description?: string;
    url?: string;
    imageURL?: string;
  };
  const skipApprove = args['skip-approve'] === true;
  if (!title || !url) {
    console.error('Usage: publish.ts mint --title "..." --url "..." [--description "..."] [--skip-approve]');
    process.exit(1);
  }

  const { txHash } = await mintPod({ skipApprove });
  const result = await submitMetadata({ txHash, title: title as string, description: description as string | undefined, url: url as string, imageURL: imageURL as string | undefined });

  console.log(`\n🎉 Pod published!`);
  console.log(`   Tx: https://basescan.org/tx/${txHash}`);
  return result;
}

async function cmdAuto(args: ParsedArgs): Promise<unknown> {
  const { title, body, description, submolt, imageURL } = args as ParsedArgs & {
    title?: string;
    body?: string;
    description?: string;
    submolt?: string;
    imageURL?: string;
  };
  const skipApprove = args['skip-approve'] === true;
  if (!title || !body) {
    console.error('Usage: publish.ts auto --title "..." --body "..." [--description "..."] [--skip-approve]');
    process.exit(1);
  }

  // Step 1: Post to Moltbook
  const moltPost = await postToMoltbook({ title: title as string, body: body as string, submolt: (submolt as string) || DEFAULT_SUBMOLT });

  // Step 2: Mint pod on-chain
  const { txHash } = await mintPod({ skipApprove });

  // Step 3: Submit metadata
  const result = await submitMetadata({
    txHash,
    title: title as string,
    description: (description as string) || (body as string).slice(0, 200),
    url: moltPost.url,
    imageURL: imageURL as string | undefined,
  });

  console.log(`\n🎉 Full publish complete!`);
  console.log(`   Moltbook: ${moltPost.url}`);
  console.log(`   Tx: https://basescan.org/tx/${txHash}`);
  return result;
}

async function cmdFee(): Promise<void> {
  const fee = await getPublishingFee();
  console.log(`Publishing fee: ${formatUnits(fee, 18)} REPPO`);
  if (fee === 0n) console.log('✅ No fee required!');
}

async function cmdLogin(): Promise<void> {
  const session = await privyLogin();
  console.log(`\n🎉 Privy session active`);
  console.log(`   User: ${session.userId || 'unknown'}`);
  console.log(`   Token saved to: ${PRIVY_SESSION_FILE}`);
}

async function cmdStatus(): Promise<void> {
  const pk = loadKey('private_key');
  const moltbookKey = loadKey('moltbook_key');

  console.log('🔑 Auth Status:');
  console.log(`   Private key:      ${pk ? '✅ configured' : '❌ missing'}`);
  console.log(`   Moltbook API key: ${moltbookKey ? '✅ configured' : '❌ missing'}`);

  // Check Privy session
  const session = loadPrivySession();
  if (session && !session.expired) {
    console.log(`   Privy session:    ✅ active (user: ${session.userId || 'unknown'})`);
  } else if (session?.expired) {
    console.log(`   Privy session:    ⚠️  expired (will auto-refresh on next request)`);
  } else {
    console.log(`   Privy session:    ❌ not logged in (run: npx tsx publish.ts login)`);
  }

  if (pk) {
    try {
      const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
      console.log(`\n💳 Wallet: ${account.address}`);
      const balance = await getReppoBalance(account.address);
      console.log(`   REPPO balance: ${formatUnits(balance, 18)}`);
      const fee = await getPublishingFee();
      console.log(`   Publishing fee: ${formatUnits(fee, 18)} REPPO`);
      if (fee > 0n && balance < fee) {
        console.log(`   ⚠️  Insufficient REPPO for publishing!`);
      } else {
        console.log(`   ✅ Ready to publish`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`   ⚠️  Could not fetch on-chain data: ${msg}`);
    }
  }

  console.log(`\n📡 Config:`);
  console.log(`   Chain:       Base (${CHAIN_ID})`);
  console.log(`   Pod contract: ${POD_CONTRACT}`);
  console.log(`   REPPO token:  ${REPPO_TOKEN}`);
  console.log(`   Privy App ID: ${PRIVY_APP_ID}`);
  console.log(`   Config dir:   ${CONFIG_DIR}`);
}

// --- Main ---

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

try {
  switch (command) {
    case 'login':
      await cmdLogin();
      break;
    case 'post':
      await cmdPost(args);
      break;
    case 'mint':
      await cmdMint(args);
      break;
    case 'auto':
      await cmdAuto(args);
      break;
    case 'fee':
      await cmdFee();
      break;
    case 'status':
      await cmdStatus();
      break;
    default:
      console.log(`Reppo AgentMind Publisher

Commands:
  login     Authenticate with Reppo via Privy (SIWE wallet login)
  post      Post content to Moltbook
  mint      Mint pod on-chain + submit metadata to Reppo
  auto      Post to Moltbook + mint + submit (full flow)
  fee       Check current publishing fee
  status    Check auth, wallet balance, and config

Setup:
  mkdir -p ~/.config/reppo
  echo "0xYOUR_PRIVATE_KEY" > ~/.config/reppo/private_key
  echo "moltbook_sk_xxx" > ~/.config/reppo/moltbook_key
  npx tsx publish.ts login    # authenticate with Reppo

Examples:
  npx tsx publish.ts login
  npx tsx publish.ts post --title "Learning Goal" --body "I want to..."
  npx tsx publish.ts mint --title "Learning Goal" --url "https://moltbook.com/post/123"
  npx tsx publish.ts auto --title "Learning Goal" --body "I want to..." --description "Short summary"
  npx tsx publish.ts fee
  npx tsx publish.ts status`);
  }
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`❌ Error: ${msg}`);
  process.exit(1);
}
