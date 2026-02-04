import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TransactionReceipt } from 'viem';

// Mock all external dependencies before importing the module
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
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

// Need to reset the module singleton between tests
let getClients: typeof import('../chain.js').getClients;
let mintPod: typeof import('../chain.js').mintPod;

describe('getClients', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Re-setup mocks after module reset
    vi.doMock('viem', async () => {
      const actual = await vi.importActual<typeof import('viem')>('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: vi.fn(),
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

    const mod = await import('../chain.js');
    getClients = mod.getClients;
    mintPod = mod.mintPod;
  });

  it('returns clients object with account, publicClient, walletClient', () => {
    const clients = getClients();
    expect(clients).toHaveProperty('account');
    expect(clients).toHaveProperty('publicClient');
    expect(clients).toHaveProperty('walletClient');
  });

  it('returns same instance on subsequent calls (singleton)', () => {
    const first = getClients();
    const second = getClients();
    expect(first).toBe(second);
  });
});

describe('mintPod dry-run', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('viem', async () => {
      const actual = await vi.importActual<typeof import('viem')>('viem');
      return {
        ...actual,
        createPublicClient: vi.fn(() => ({
          readContract: vi.fn().mockResolvedValue(0n),
          waitForTransactionReceipt: vi.fn(),
          getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
          estimateContractGas: vi.fn().mockResolvedValue(21000n),
          getGasPrice: vi.fn().mockResolvedValue(1000000000n),
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

    const mod = await import('../chain.js');
    mintPod = mod.mintPod;
  });

  it('returns dummy hash and empty receipt in dry-run mode', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await mintPod({ skipApprove: false, dryRun: true });
    expect(result.txHash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
    expect(result.receipt).toEqual({});
    expect(result.podId).toBeUndefined();
  });
});

describe('extractPodId', () => {
  it('extracts tokenId from Transfer event', async () => {
    const { decodeEventLog } = await import('viem');

    // extractPodId is not exported, but we can test it indirectly
    // by checking that mintPod returns podId from the receipt
    // For a direct test, we'll use decodeEventLog with the POD_ABI
    const { POD_ABI } = await import('../../constants.js');

    // Simulate a Transfer event log
    const { encodeEventTopics, encodeAbiParameters } = await import('viem');
    const topics = encodeEventTopics({
      abi: POD_ABI,
      eventName: 'Transfer',
      args: {
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: 42n,
      },
    });

    const decoded = decodeEventLog({
      abi: POD_ABI,
      topics: topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      data: '0x',
    });

    expect(decoded.eventName).toBe('Transfer');
    expect((decoded.args as { tokenId: bigint }).tokenId).toBe(42n);
  });
});
