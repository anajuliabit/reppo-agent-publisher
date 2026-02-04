import { formatUnits } from 'viem';
import { getClients, getReppoBalance, getEthBalance } from '../lib/chain.js';
import { USDC_TOKEN, ERC20_ABI } from '../constants.js';
import { withRetry } from '../lib/http.js';
import { isJsonMode, outputResult } from '../lib/output.js';

export async function cmdBalance(): Promise<void> {
  const { account, publicClient } = getClients();

  const [ethBalance, reppoBalance, usdcBalance] = await Promise.all([
    getEthBalance(account.address),
    getReppoBalance(account.address),
    withRetry(
      async () =>
        publicClient.readContract({
          address: USDC_TOKEN,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }) as Promise<bigint>,
      'readUsdcBalance',
    ),
  ]);

  if (isJsonMode()) {
    outputResult({
      address: account.address,
      eth: { raw: ethBalance.toString(), formatted: formatUnits(ethBalance, 18) },
      reppo: { raw: reppoBalance.toString(), formatted: formatUnits(reppoBalance, 18) },
      usdc: { raw: usdcBalance.toString(), formatted: formatUnits(usdcBalance, 6) },
    });
  } else {
    console.log(`Wallet: ${account.address}`);
    console.log(`  ETH:   ${formatUnits(ethBalance, 18)}`);
    console.log(`  REPPO: ${formatUnits(reppoBalance, 18)}`);
    console.log(`  USDC:  ${formatUnits(usdcBalance, 6)}`);
  }
}
