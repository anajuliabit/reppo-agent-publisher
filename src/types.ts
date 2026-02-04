import type { Hash, Address, TransactionReceipt } from 'viem';

export interface PrivySession {
  token: string;
  privyAccessToken?: string;
  refreshToken?: string;
  userId?: string;
  expired?: boolean;
}

export interface SiweInitResponse {
  nonce: string;
}

export interface SiweAuthResponse {
  token: string;
  privy_access_token?: string;
  refresh_token?: string;
  user?: { id: string };
}

export interface SessionRefreshResponse {
  token?: string;
  privy_access_token?: string;
  refresh_token?: string;
}

export interface MoltbookPostResponse {
  id: string;
  url?: string;
}

export interface MoltbookResult {
  id: string;
  url: string;
}

export interface MintResult {
  txHash: Hash;
  receipt: TransactionReceipt;
  podId?: bigint;
}

export interface SubmitMetadataParams {
  txHash: Hash;
  title: string;
  description?: string;
  url: string;
  imageURL?: string;
}

export interface Clients {
  account: import('viem/accounts').PrivateKeyAccount;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
}

export type KeyName = 'api_key' | 'moltbook_key' | 'private_key';

export interface PublishResult {
  moltbook: MoltbookResult;
  mint: MintResult;
  metadata: unknown;
}

export interface OutputOptions {
  json?: boolean;
  dryRun?: boolean;
}
