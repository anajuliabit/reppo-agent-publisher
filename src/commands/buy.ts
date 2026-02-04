import { parseUnits, formatUnits } from 'viem';
import { buyReppo } from '../lib/swap.js';
import { isJsonMode, outputResult } from '../lib/output.js';

export async function cmdBuy(opts: {
  amount: string;
  slippage?: string;
  dryRun?: boolean;
}): Promise<void> {
  const amount = parseUnits(opts.amount, 18);
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  const slippage = opts.slippage ? parseFloat(opts.slippage) : 1;
  if (isNaN(slippage) || slippage < 0 || slippage > 100) {
    throw new Error('Slippage must be a number between 0 and 100');
  }

  const result = await buyReppo({ amount, slippage, dryRun: opts.dryRun });

  if (opts.dryRun) {
    if (isJsonMode()) {
      outputResult({
        dryRun: true,
        amountReppo: formatUnits(amount, 18),
        slippage,
      });
    }
    return;
  }

  if (!result) return;

  if (isJsonMode()) {
    outputResult({
      txHash: result.txHash,
      amountIn: formatUnits(result.amountIn, 6),
      amountOut: formatUnits(result.amountOut, 18),
      txUrl: `https://basescan.org/tx/${result.txHash}`,
    });
  } else {
    console.log(`\nSwap complete!`);
    console.log(`  USDC spent: ${formatUnits(result.amountIn, 6)}`);
    console.log(`  REPPO received: ${formatUnits(result.amountOut, 18)}`);
    console.log(`  Tx: https://basescan.org/tx/${result.txHash}`);
  }
}
