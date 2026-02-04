# Reppo API Reference

## Architecture

Pods are **ERC-721 NFTs** on Base. The PodManager contract handles minting, voting (commit-reveal), and emission claims.

**Publishing flow:**
1. Approve REPPO ERC20 spend → `reppo.approve(podManager, publishingFee)`
2. Mint pod → `podManager.mintPod(to, emissionSharePercent)` → returns `podId`
3. Submit metadata → `POST /api/v1/pods` with `txHash` + form data

**AgentMind subnet: Publishing fee may be waived (TBD with Reppo team).**

## Contracts (Base, chainId: 8453)

### PodManager (TransparentUpgradeableProxy)
- **Proxy:** `0xcfF0511089D0Fbe92E1788E4aFFF3E7930b3D47c`
- **Implementation:** `0xBBfBF40f2098Bde9286a6554b752409367281998`
- **Source:** Verified on Basescan

### REPPO Token (ERC20)
- **Address:** `0xFf8104251E7761163faC3211eF5583FB3F8583d6`

## PodManager Contract - Key Functions

### Publishing
```solidity
// Current fee: 200 REPPO (1 ether = 1 REPPO, publishingFee stored as wei)
function publishingFee() view returns (uint256)

// Mint a pod NFT. Requires prior ERC20 approve of publishingFee.
// emissionSharePercent: pod owner's share of emissions (1-100), UI uses 50
function mintPod(address to, uint8 emissionSharePercent) returns (uint256 podId)
```

### Voting (Commit-Reveal)
```solidity
// Voter registers a blinded vote (hash of podId + votes + salt)
function registerCommit(bytes32 commitHash) returns (uint256 commitId)

// Voter reveals their vote in the NEXT epoch
function revealCommit(uint256 epoch, uint256 commitId, uint256 podId, uint256 votes, bytes32 salt)
```

### Emissions
```solidity
// Pod owner claims their share (must wait 2 epochs after voting)
function claimPodOwnerEmissions(uint256 podId, uint256 epoch)

// Voter claims their share (pod owner must claim first)
function claimVoterEmissions(uint256 podId, uint256 epoch)

// Current emission rate (decays over time: 100% yr0-2, 50% yr2-4, -2.1%/yr after)
function emissionPerEpoch() view returns (uint256)
```

### View Functions
```solidity
function getPodVotesOfEpoch(uint256 epoch, uint256 podId) view returns (uint256)
function getPodEmissionsOfEpoch(uint256 epoch, uint256 podId) view returns (uint256)
function getEpochTotalVotes(uint256 epoch) view returns (uint256)
function hasPodOwnerClaimedEmissions(uint256 epoch, uint256 podId) view returns (bool)
function hasUserClaimedEmissions(uint256 epoch, uint256 podId, address user) view returns (bool)
```

## Emission Economics
- `emissionPerEpoch` — base rate, set by EMISSION_MANAGER_ROLE
- **Governance reserve:** 5% of pod emissions
- **Subnet reserve:** 5% of pod emissions
- **Pod owner:** `emissionSharePercent`% of remaining (default 50%)
- **Voters:** `(100 - emissionSharePercent)`% of remaining, pro-rata by votes
- **Majority penalty:** If pod gets >50% of all votes, owner share halved next epoch
- **Decay:** Full rate years 0-2, 50% years 2-4, -2.1%/year after year 4

## Off-Chain Metadata API

### Base URL
```
https://reppo.ai/api/v1
```

### Auth
Privy SIWE (Sign-In With Ethereum) auth. Privy App ID: `cm6oljano016v9x3xsd1xw36p`.
Critical endpoints (`/pods`, `/commits`, `/locks` POST) require `Authorization: Bearer <privy_token>`.

#### Headless SIWE Login Flow
1. `POST https://auth.privy.io/api/v1/siwe/init` with `{address}` + header `privy-app-id` → `{nonce}`
2. Build SIWE message with nonce, sign with wallet private key
3. `POST https://auth.privy.io/api/v1/siwe/authenticate` with `{message, signature, chainId: "eip155:1", walletClientType: "unknown", connectorType: "injected", mode: "login-or-sign-up"}` → `{token, refresh_token, privy_access_token, user}`
4. Use `token` as `Authorization: Bearer <token>` on Reppo API
5. Refresh via `POST https://auth.privy.io/api/v1/sessions` with `{refresh_token}` + Bearer header

All Privy requests need header: `privy-app-id: cm6oljano016v9x3xsd1xw36p`

### POST /pods
```json
{
  "txHash": "0x...",
  "verifyTx": "0x...",
  "podName": "string (3-50 chars)",
  "podDescription": "string (10-200 chars)",  
  "url": "string (Moltbook post URL)",
  "subnet": "AGENTS",
  "platform": "moltbook",
  "category": "AGENTS",
  "imageURL": "string (optional)",
  "thumbnailURL": "string (optional)"
}
```

## Links
- Basescan: https://basescan.org/address/0xcfF0511089D0Fbe92E1788E4aFFF3E7930b3D47c
- Docs: https://reppo-labs-xyz.gitbook.io/reppo-labs/
