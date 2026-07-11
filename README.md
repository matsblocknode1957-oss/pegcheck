# pegcheck

Real-time stablecoin monitoring dashboard with live peg data, multi-source price aggregation, and automated depeg alerts.

## Features

- 19 stablecoins monitored every hour (USDT, USDC, USDS, USDe, PYUSD, FDUSD, RLUSD, TUSD, FRAX, GHO, crvUSD, LUSD, USDP, USDD, mkUSD, EURC, DOLA, alUSD, BOLD)
- 5–6 source median price (CoinGecko, Coinbase, Binance.US, Kraken, DefiLlama, Chainlink on-chain feeds)
- Deviation from peg in basis points stored to Supabase `price_history`
- Email alerts (Resend) and webhooks for depeg, caution, and recovery events
- On-chain depeg detection via StableGuard (Arbitrum Sepolia + Robinhood Chain testnet), broadcasting CCIP alerts to multiple destination chains in one tx
- Chainlink Proof of Reserve feeds for TUSD
- REST API: `/api/depeg-status?coin={symbol}` — multi-source real-time signal

## Signal Levels

| Deviation | Signal | Meaning |
|-----------|--------|---------|
| 0–19 bps  | STABLE | Within normal market spread |
| 20–49 bps | WATCH  | Elevated — monitor closely |
| 50–99 bps | HEDGE  | Reduce exposure 30–50% |
| 100+ bps  | EXIT   | Rotate immediately |

## Backtest Accuracy

Analysis of **260,950 price snapshots** stored in the `price_history` table across all tracked stablecoins.

### Signal Tier Distribution

| Tier | Threshold | Readings | % of Total |
|------|-----------|----------|------------|
| STABLE | < 20 bps | ~248,000 | ~95.1% |
| WATCH | 20–49 bps | ~1,223 | ~0.47% |
| HEDGE / EXIT | ≥ 50 bps | 11,727 | 4.49% |

### Depeg Events (HEDGE threshold ≥ 50 bps)

37 distinct depeg events were identified across 6 coins (gap-clustered: readings >3 hours apart = separate event).

| Coin | Events | Confirmed | Peak Deviation | Peak Price | Direction |
|------|--------|-----------|----------------|------------|-----------|
| alUSD (Alchemix) | 1 | 1 | 444 bps | $0.9556 | Below peg |
| EURC (Circle) | 9 | 6 | 323 bps | $1.1665 | Above peg (EUR/USD) |
| mkUSD (Prisma) | 13 | 11 | 189 bps | $0.9811 | Below peg |
| FRAX | 5 | 5 | 143 bps | $0.9857 | Below peg |
| DOLA (Inverse Finance) | 1 | 1 | 94 bps | $0.9906 | Below peg |
| LUSD (Liquity) | 8 | 7 | 87 bps | $1.0087 | Above peg |
| **Total** | **37** | **31** | — | — | — |

### Multi-Source Confirmation Rate: **83.8%**

31 of 37 events were **confirmed** — defined as the signal persisting across two or more consecutive cron readings (≥ 1 hour apart), eliminating single-tick API anomalies. The remaining 16.2% were transient spikes that self-corrected within a single polling cycle.

Every confirmed reading already passes a 5-to-6 source median filter (CoinGecko, Coinbase, Binance.US, Kraken, DefiLlama, and on-chain Chainlink feeds for USDT/USDC/USDS/TUSD), so each row in `price_history` is itself a multi-source consensus price before event confirmation is applied.

> Major blue-chip stablecoins (USDT, USDC, USDS, PYUSD, FDUSD) produced **zero HEDGE-level events** over the entire observed history, consistent with their strong collateralisation and market liquidity.

**Methodology:**
- `deviation_bps` = `(price − peg) / peg × 10,000` (signed; negative = below peg). EURC uses live EUR/USD as its peg reference.
- Events are gap-clustered per coin with a 3-hour separation threshold.
- "Confirmed" = event spanned ≥ 2 consecutive polling cycles (~1 hour apart).

## StableGuard Contracts

Autonomous cross-chain depeg protection powered by Chainlink Price Feeds, Automation, and CCIP. Each StableGuard instance monitors USDC and DAI prices, scores confidence across sources, and broadcasts alerts to all configured destination chains in a single `performUpkeep` tx.

### Deployed Contracts

#### StableGuard (monitors + sends alerts)

| Network | Address | Explorer |
|---------|---------|---------|
| Arbitrum Sepolia | `0xb94af0F75ed9E431B32449980Ca4D57681c580e4` | [Arbiscan](https://sepolia.arbiscan.io/address/0xb94af0F75ed9E431B32449980Ca4D57681c580e4) |
| Robinhood Chain testnet | `0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa` | [Explorer](https://explorer.testnet.chain.robinhood.com/address/0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa) |

#### StableGuardReceiver (receives CCIP alerts)

| Network | Address | Trusted sender |
|---------|---------|---------------|
| Ethereum Sepolia | `0x70b88C8877f7Ec11500b75ff9cad37312A739AFF` | Arbitrum Sepolia StableGuard |
| Robinhood Chain testnet | `0x6381383Ff70434A7681Bc329D89b3a7AC17129A8` | Arbitrum Sepolia StableGuard |

#### MockUSDC & MockVault (Ethereum Sepolia)

| Contract | Address | Explorer |
|----------|---------|---------|
| MockUSDC | `0xcc502cE476D999f79b27bD1D45b7BD42564B05E7` | [Etherscan](https://sepolia.etherscan.io/address/0xcc502cE476D999f79b27bD1D45b7BD42564B05E7) |
| MockVault | `0x0B219D7045b879150b068EF86dDbDEAaBda6D1c4` | [Etherscan](https://sepolia.etherscan.io/address/0x0B219D7045b879150b068EF86dDbDEAaBda6D1c4) |

MockVault pauser is set to the Ethereum Sepolia StableGuardReceiver — a CCIP depeg alert landing there can call `pause()` to block new deposits while withdrawals remain open.

### CCIP Destinations (Arbitrum Sepolia StableGuard)

| Destination | Chain selector | Receiver |
|-------------|---------------|---------|
| Ethereum Sepolia | `16015286601757825753` | `0x70b88C8877f7Ec11500b75ff9cad37312A739AFF` |
| Robinhood Chain testnet | `2032988798112970440` | `0x6381383Ff70434A7681Bc329D89b3a7AC17129A8` |

### Deploy & Wire

```bash
# Deploy StableGuard (4 constructor args — destinations added post-deploy)
npx hardhat run scripts/deploy-arbitrum.js --network arbitrumSepolia
npx hardhat run scripts/deploy-robinhood.js --network robinhoodChain

# Deploy receiver on Robinhood Chain
npx hardhat run scripts/deploy-receiver-robinhood.js --network robinhoodChain

# Fund + addDestination x2 + setTrustedSender on both receivers in one run
node scripts/wire-arbitrum-stableguard.js

# Prove multi-destination alert fires (ephemeral StableGuard + mock feed)
npx hardhat run scripts/trip-depeg.js --network arbitrumSepolia
```

## API

```
GET /api/depeg-status?coin=USDT
```

Returns consensus price from up to 3 live sources (PegCheck/Chainlink, CoinGecko, CoinMarketCap), deviation in bps, signal tier, and confidence level (`HIGH` when ≥ 2 sources agree within 10 bps).

## Development

```bash
npm install
npm run dev
```

Requires environment variables — see `.env.example`.

## License

MIT
