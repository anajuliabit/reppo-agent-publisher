import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
      simulateContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      getBalance: vi.fn(),
      estimateContractGas: vi.fn(),
      getGasPrice: vi.fn(),
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: vi.fn(),
    })),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    signMessage: vi.fn(),
  })),
}));

vi.mock('../config.js', () => ({
  loadKey: vi.fn(() => '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  getRpcUrl: vi.fn(() => ''),
}));

vi.mock('../http.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  fetchJSON: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  getPrivyAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
}));

let quoteReppoPrice: typeof import('../swap.js').quoteReppoPrice;
let buyReppo: typeof import('../swap.js').buyReppo;

describe('quoteReppoPrice', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('viem', async () => {
      const actual = await vi.importActual<typeof import('viem')>('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: vi.fn(),
          simulateContract: vi.fn().mockResolvedValue({
            result: [5000000n, 0n, 0, 0n], // 5 USDC
          }),
          waitForTransactionReceipt: vi.fn(),
          getBalance: vi.fn(),
          estimateContractGas: vi.fn(),
          getGasPrice: vi.fn(),
        })),
        createWalletClient: vi.fn(() => ({
          writeContract: vi.fn(),
        })),
      };
    });
    vi.doMock('viem/accounts', () => ({
      privateKeyToAccount: vi.fn(() => ({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signMessage: vi.fn(),
      })),
    }));
    vi.doMock('../config.js', () => ({
      loadKey: vi.fn(() => '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
      getRpcUrl: vi.fn(() => ''),
    }));
    vi.doMock('../http.js', () => ({
      withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
      fetchJSON: vi.fn(),
    }));
    vi.doMock('../auth.js', () => ({
      getPrivyAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
    }));

    const mod = await import('../swap.js');
    quoteReppoPrice = mod.quoteReppoPrice;
    buyReppo = mod.buyReppo;
  });

  it('returns quoted USDC amount for given REPPO amount', async () => {
    const amount = 100n * 10n ** 18n; // 100 REPPO
    const quote = await quoteReppoPrice(amount);
    expect(quote).toBe(5000000n); // 5 USDC
  });
});

describe('buyReppo dry-run', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('viem', async () => {
      const actual = await vi.importActual<typeof import('viem')>('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: vi.fn().mockResolvedValue(100000000n), // 100 USDC balance
          simulateContract: vi.fn().mockResolvedValue({
            result: [5000000n, 0n, 0, 0n], // 5 USDC
          }),
          waitForTransactionReceipt: vi.fn(),
          getBalance: vi.fn(),
          estimateContractGas: vi.fn(),
          getGasPrice: vi.fn(),
        })),
        createWalletClient: vi.fn(() => ({
          writeContract: vi.fn(),
        })),
      };
    });
    vi.doMock('viem/accounts', () => ({
      privateKeyToAccount: vi.fn(() => ({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signMessage: vi.fn(),
      })),
    }));
    vi.doMock('../config.js', () => ({
      loadKey: vi.fn(() => '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
      getRpcUrl: vi.fn(() => ''),
    }));
    vi.doMock('../http.js', () => ({
      withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
      fetchJSON: vi.fn(),
    }));
    vi.doMock('../auth.js', () => ({
      getPrivyAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
    }));

    const mod = await import('../swap.js');
    buyReppo = mod.buyReppo;
  });

  it('returns null in dry-run mode without executing swap', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await buyReppo({
      amount: 100n * 10n ** 18n,
      slippage: 1,
      dryRun: true,
    });
    expect(result).toBeNull();
  });

  it('logs quote and dry-run message', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await buyReppo({
      amount: 100n * 10n ** 18n,
      slippage: 1,
      dryRun: true,
    });
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Quoting');
    expect(output).toContain('[dry-run]');
    expect(output).toContain('USDC');
  });

  it('throws on insufficient USDC balance', async () => {
    vi.resetModules();
    vi.doMock('viem', async () => {
      const actual = await vi.importActual<typeof import('viem')>('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: vi.fn().mockResolvedValue(1000n), // 0.001 USDC — not enough
          simulateContract: vi.fn().mockResolvedValue({
            result: [5000000n, 0n, 0, 0n],
          }),
          waitForTransactionReceipt: vi.fn(),
          getBalance: vi.fn(),
          estimateContractGas: vi.fn(),
          getGasPrice: vi.fn(),
        })),
        createWalletClient: vi.fn(() => ({
          writeContract: vi.fn(),
        })),
      };
    });
    vi.doMock('viem/accounts', () => ({
      privateKeyToAccount: vi.fn(() => ({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signMessage: vi.fn(),
      })),
    }));
    vi.doMock('../config.js', () => ({
      loadKey: vi.fn(() => '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
      getRpcUrl: vi.fn(() => ''),
    }));
    vi.doMock('../http.js', () => ({
      withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
      fetchJSON: vi.fn(),
    }));
    vi.doMock('../auth.js', () => ({
      getPrivyAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
    }));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await import('../swap.js');
    await expect(
      mod.buyReppo({ amount: 100n * 10n ** 18n, slippage: 1, dryRun: true }),
    ).rejects.toThrow('Insufficient USDC balance');
  });
});
