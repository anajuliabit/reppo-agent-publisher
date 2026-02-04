import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  decodeEventLog,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  POD_CONTRACT,
  REPPO_TOKEN,
  POD_ABI,
  ERC20_ABI,
  EMISSION_SHARE,
  TX_RECEIPT_TIMEOUT,
  REPPO_API,
} from '../constants.js';
import { loadKey, getRpcUrl } from './config.js';
import { withRetry, fetchJSON } from './http.js';
import { getPrivyAuthHeaders } from './auth.js';
import type { Clients, MintResult, SubmitMetadataParams } from '../types.js';

let _clients: Clients | null = null;

export function getClients(): Clients {
  if (_clients) return _clients;

  const pk = loadKey('private_key');
  if (!pk) throw new Error('Private key not found. Set REPPO_PRIVATE_KEY or create ~/.config/reppo/private_key');

  const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
  const rpcUrl = getRpcUrl();
  const transport = rpcUrl ? http(rpcUrl) : http();
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ account, chain: base, transport });

  _clients = { account, publicClient, walletClient } as Clients;
  return _clients!;
}

export function getPublicClient() {
  return getClients().publicClient;
}

export async function getPublishingFee(): Promise<bigint> {
  const { publicClient } = getClients();
  return withRetry(
    async () =>
      (await publicClient.readContract({
        address: POD_CONTRACT,
        abi: POD_ABI,
        functionName: 'publishingFee',
      })) as bigint,
    'getPublishingFee',
  );
}

export async function getReppoBalance(address: Address): Promise<bigint> {
  const { publicClient } = getClients();
  return withRetry(
    async () =>
      (await publicClient.readContract({
        address: REPPO_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      })) as bigint,
    'getReppoBalance',
  );
}

export async function getEthBalance(address: Address): Promise<bigint> {
  const { publicClient } = getClients();
  return withRetry(
    async () => (await publicClient.getBalance({ address })) as bigint,
    'getEthBalance',
  );
}

export async function estimateMintGas(): Promise<bigint> {
  const { account, publicClient } = getClients();
  try {
    const gas = (await publicClient.estimateContractGas({
      address: POD_CONTRACT,
      abi: POD_ABI,
      functionName: 'mintPod',
      args: [account.address, EMISSION_SHARE],
      account: account.address,
    })) as bigint;
    const gasPrice = (await publicClient.getGasPrice()) as bigint;
    return gas * gasPrice;
  } catch {
    return 0n;
  }
}

function extractPodId(receipt: TransactionReceipt): bigint | undefined {
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: POD_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === 'Transfer') {
        return (event.args as { tokenId: bigint }).tokenId;
      }
    } catch {
      // Not a matching event
    }
  }
  return undefined;
}

export async function mintPod({ skipApprove, dryRun }: { skipApprove: boolean; dryRun?: boolean }): Promise<MintResult> {
  const { account, publicClient, walletClient } = getClients();

  const fee = (await withRetry(
    async () =>
      (await publicClient.readContract({
        address: POD_CONTRACT,
        abi: POD_ABI,
        functionName: 'publishingFee',
      })) as bigint,
    'readPublishingFee',
  )) as bigint;
  console.log(`Publishing fee: ${formatUnits(fee, 18)} REPPO`);

  if (fee > 0n && !skipApprove) {
    const balance = (await withRetry(
      async () =>
        (await publicClient.readContract({
          address: REPPO_TOKEN,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        })) as bigint,
      'readBalance',
    )) as bigint;
    console.log(`REPPO balance: ${formatUnits(balance, 18)}`);
    if (balance < fee) {
      throw new Error(`Insufficient REPPO balance. Need ${formatUnits(fee, 18)}, have ${formatUnits(balance, 18)}`);
    }

    const allowance = (await withRetry(
      async () =>
        (await publicClient.readContract({
          address: REPPO_TOKEN,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [account.address, POD_CONTRACT],
        })) as bigint,
      'readAllowance',
    )) as bigint;

    if (allowance < fee) {
      if (dryRun) {
        console.log(`[dry-run] Would approve ${formatUnits(fee, 18)} REPPO spend`);
      } else {
        console.log(`Approving REPPO spend...`);
        const approveTx = await walletClient.writeContract({
          address: REPPO_TOKEN,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POD_CONTRACT, fee],
          chain: base,
          account,
        });
        console.log(`  Approve tx: ${approveTx}`);
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTx,
          timeout: TX_RECEIPT_TIMEOUT,
        });
        if (approveReceipt.status === 'reverted') {
          throw new Error(`Approval transaction reverted: ${approveTx}`);
        }
        console.log(`  Approved`);
      }
    } else {
      console.log(`Already approved`);
    }
  }

  // Estimate gas and check ETH balance
  const ethBalance = await getEthBalance(account.address);
  const estimatedGas = await estimateMintGas();
  if (estimatedGas > 0n && ethBalance < estimatedGas) {
    throw new Error(
      `Insufficient ETH for gas. Estimated cost: ${formatUnits(estimatedGas, 18)} ETH, balance: ${formatUnits(ethBalance, 18)} ETH`,
    );
  }

  if (dryRun) {
    console.log(`[dry-run] Would mint pod on Base`);
    if (estimatedGas > 0n) {
      console.log(`[dry-run] Estimated gas cost: ${formatUnits(estimatedGas, 18)} ETH`);
    }
    return {
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hash,
      receipt: {} as TransactionReceipt,
    };
  }

  console.log(`Minting pod on Base...`);
  const mintTx = await walletClient.writeContract({
    address: POD_CONTRACT,
    abi: POD_ABI,
    functionName: 'mintPod',
    args: [account.address, EMISSION_SHARE],
    chain: base,
    account,
  });
  console.log(`  Mint tx: ${mintTx}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: mintTx,
    timeout: TX_RECEIPT_TIMEOUT,
  });

  if (receipt.status === 'reverted') {
    throw new Error(`Mint transaction reverted: ${mintTx}`);
  }

  const podId = extractPodId(receipt);
  console.log(`  Pod minted! Block: ${receipt.blockNumber}${podId !== undefined ? `, Pod ID: ${podId}` : ''}`);

  return { txHash: mintTx, receipt, podId };
}

export async function submitMetadata({
  txHash,
  title,
  description,
  url,
  imageURL,
}: SubmitMetadataParams): Promise<unknown> {
  const authHeaders = await getPrivyAuthHeaders();

  console.log(`Submitting metadata to Reppo...`);
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

  console.log(`Metadata submitted`);
  return data;
}
