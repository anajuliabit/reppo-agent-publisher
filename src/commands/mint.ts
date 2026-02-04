import { mintPod, submitMetadata } from '../lib/chain.js';
import { validateTitle, validateDescription } from '../lib/validate.js';
import { isJsonMode, outputResult } from '../lib/output.js';

export async function cmdMint(opts: {
  title: string;
  url: string;
  description?: string;
  imageURL?: string;
  skipApprove?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  validateTitle(opts.title);
  if (opts.description) validateDescription(opts.description);

  if (opts.dryRun) {
    if (isJsonMode()) {
      outputResult({ dryRun: true, title: opts.title, url: opts.url });
    } else {
      console.log(`[dry-run] Would mint pod and submit metadata`);
      console.log(`  Title: ${opts.title}`);
      console.log(`  URL: ${opts.url}`);
    }
    return;
  }

  const { txHash, podId } = await mintPod({ skipApprove: opts.skipApprove || false });
  const result = await submitMetadata({
    txHash,
    title: opts.title,
    description: opts.description,
    url: opts.url,
    imageURL: opts.imageURL,
  });

  if (isJsonMode()) {
    outputResult({
      txHash,
      podId: podId?.toString() || null,
      txUrl: `https://basescan.org/tx/${txHash}`,
      metadata: result,
    });
  } else {
    console.log(`\nPod published!`);
    console.log(`  Tx: https://basescan.org/tx/${txHash}`);
    if (podId !== undefined) console.log(`  Pod ID: ${podId}`);
  }
}
