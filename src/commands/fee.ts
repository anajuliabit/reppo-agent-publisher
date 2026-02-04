import { formatUnits } from 'viem';
import { getPublishingFee } from '../lib/chain.js';
import { isJsonMode, outputResult } from '../lib/output.js';

export async function cmdFee(): Promise<void> {
  const fee = await getPublishingFee();

  if (isJsonMode()) {
    outputResult({
      fee: fee.toString(),
      feeFormatted: formatUnits(fee, 18),
      decimals: 18,
      symbol: 'REPPO',
    });
  } else {
    console.log(`Publishing fee: ${formatUnits(fee, 18)} REPPO`);
    if (fee === 0n) console.log('No fee required!');
  }
}
