import { formatUnits } from 'viem';
import { base } from 'viem/chains';
import {
  USDC_TOKEN,
  REPPO_TOKEN,
  UNISWAP_ROUTER,
  UNISWAP_QUOTER,
  UNISWAP_POOL_FEE,
  SWAP_ROUTER_ABI,
  QUOTER_ABI,
  ERC20_ABI,
  TX_RECEIPT_TIMEOUT,
} from '../constants.js';
import { getClients } from './chain.js';
import { withRetry } from './http.js';
import type { SwapResult } from '../types.js';

export async function quoteReppoPrice(amountOut: bigint): Promise<bigint> {
  const { publicClient } = getClients();
  const result = await withRetry(
    async () =>
      publicClient.simulateContract({
        address: UNISWAP_QUOTER,
        abi: QUOTER_ABI,
        functionName: 'quoteExactOutputSingle',
        args: [
          {
            tokenIn: USDC_TOKEN,
            tokenOut: REPPO_TOKEN,
            amount: amountOut,
            fee: UNISWAP_POOL_FEE,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    'quoteExactOutputSingle',
  );
  const [amountIn] = result.result as [bigint, bigint, number, bigint];
  return amountIn;
}

export async function buyReppo({
  amount,
  slippage = 1,
  dryRun = false,
}: {
  amount: bigint;
  slippage?: number;
  dryRun?: boolean;
}): Promise<SwapResult | null> {
  const { account, publicClient, walletClient } = getClients();

  // 1. Get quote
  console.log(`Quoting ${formatUnits(amount, 18)} REPPO...`);
  const quotedAmountIn = await quoteReppoPrice(amount);
  const amountInMaximum = quotedAmountIn + (quotedAmountIn * BigInt(Math.round(slippage * 100))) / 10000n;

  console.log(`  Estimated cost: ${formatUnits(quotedAmountIn, 6)} USDC`);
  console.log(`  Max cost (${slippage}% slippage): ${formatUnits(amountInMaximum, 6)} USDC`);

  // 2. Check USDC balance
  const usdcBalance = (await withRetry(
    async () =>
      publicClient.readContract({
        address: USDC_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }),
    'readUsdcBalance',
  )) as bigint;

  console.log(`  USDC balance: ${formatUnits(usdcBalance, 6)}`);

  if (usdcBalance < amountInMaximum) {
    throw new Error(
      `Insufficient USDC balance. Need ${formatUnits(amountInMaximum, 6)}, have ${formatUnits(usdcBalance, 6)}`,
    );
  }

  // 3. Dry run — stop here
  if (dryRun) {
    console.log(`[dry-run] Would swap up to ${formatUnits(amountInMaximum, 6)} USDC for ${formatUnits(amount, 18)} REPPO`);
    return null;
  }

  // 4. Approve USDC if needed
  const allowance = (await withRetry(
    async () =>
      publicClient.readContract({
        address: USDC_TOKEN,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, UNISWAP_ROUTER],
      }),
    'readUsdcAllowance',
  )) as bigint;

  if (allowance < amountInMaximum) {
    console.log(`Approving USDC spend...`);
    const approveTx = await walletClient.writeContract({
      address: USDC_TOKEN,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [UNISWAP_ROUTER, amountInMaximum],
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
  } else {
    console.log(`Already approved`);
  }

  // 5. Execute swap
  console.log(`Swapping USDC for REPPO...`);
  const swapTx = await walletClient.writeContract({
    address: UNISWAP_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactOutputSingle',
    args: [
      {
        tokenIn: USDC_TOKEN,
        tokenOut: REPPO_TOKEN,
        fee: UNISWAP_POOL_FEE,
        recipient: account.address,
        amountOut: amount,
        amountInMaximum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    chain: base,
    account,
  });
  console.log(`  Swap tx: ${swapTx}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: swapTx,
    timeout: TX_RECEIPT_TIMEOUT,
  });

  if (receipt.status === 'reverted') {
    throw new Error(`Swap transaction reverted: ${swapTx}`);
  }

  console.log(`  Swap complete! Block: ${receipt.blockNumber}`);

  return {
    txHash: swapTx,
    amountIn: amountInMaximum,
    amountOut: amount,
  };
}
