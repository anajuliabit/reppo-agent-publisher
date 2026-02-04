import type { Hash, Address, TransactionReceipt, PublicClient, Transport, Chain } from 'viem';
import type { WalletClient } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';

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
  account: PrivateKeyAccount;
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, PrivateKeyAccount>;
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

export interface SwapResult {
  txHash: Hash;
  amountIn: bigint;   // USDC spent
  amountOut: bigint;   // REPPO received
}
