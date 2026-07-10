// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ================================================================
//  StableGuard.sol — Autonomous Cross-Chain Depeg Protection
//  Network:  Ethereum Sepolia testnet
//
//  Chainlink integrations
//  ──────────────────────────────────────────────────────────────
//  • Price Feeds   — USDC/USD + USDT/USD depeg detection
//  • Automation    — keeper loop via checkUpkeep / performUpkeep
//  • CCIP          — cross-chain alert dispatch on high confidence
//
//  Confidence scoring (multi-source firewall)
//  ──────────────────────────────────────────────────────────────
//  +3  Chainlink Price Feed confirms depeg (≥ 50 bps deviation)
//  +2  Uniswap V3 on-chain DEX price cross-check confirms depeg
//  ──────────────────────────────────────────────────────────────
//  Score 1–2 → emit DepegAlert event (log only)
//  Score 3   → emit DepegAlert + send CCIP cross-chain alert
//  Score 5   → CCIP alert + emit ProtectionTriggered
//
//  [DATA STREAMS slot — see Section 6 below]
// ================================================================


// ──────────────────────────────────────────────────────────────
//  INTERFACES  (inlined — no external npm imports required)
// ──────────────────────────────────────────────────────────────

/// @dev Chainlink Data Feed — latestRoundData returns price × 10^decimals
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80  roundId,
        int256  answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80  answeredInRound
    );
    function decimals() external view returns (uint8);
}

/// @dev Chainlink Automation compatible interface
interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

/// @dev Uniswap V3 pool — only slot0 needed for price reading
interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24   tick,
        uint16  observationIndex,
        uint16  observationCardinality,
        uint16  observationCardinalityNext,
        uint8   feeProtocol,
        bool    unlocked
    );
}

// ── CCIP types (mirrors Chainlink Client library structs) ──────

struct CCIPTokenAmount {
    address token;
    uint256 amount;
}

/// @dev Message sent via IRouterClient.ccipSend()
struct EVM2AnyMessage {
    bytes             receiver;       // abi.encode(receiverAddress)
    bytes             data;           // arbitrary payload
    CCIPTokenAmount[] tokenAmounts;   // empty — no token transfer
    address           feeToken;       // address(0) = pay fee in native ETH
    bytes             extraArgs;      // optional EVMExtraArgsV1 (gas limit etc.)
}

/// @dev Message received by CCIPReceiver.ccipReceive()
struct Any2EVMMessage {
    bytes32           messageId;
    uint64            sourceChainSelector;
    bytes             sender;          // abi.encode(senderAddress)
    bytes             data;
    CCIPTokenAmount[] tokenAmounts;
}

interface IRouterClient {
    /// @notice Calculates the CCIP fee for a given message (paid in ETH or LINK)
    function getFee(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external view returns (uint256 fee);

    /// @notice Sends message cross-chain; returns a unique messageId
    function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external payable returns (bytes32 messageId);
}

interface IAny2EVMMessageReceiver {
    function ccipReceive(Any2EVMMessage calldata message) external;
}


// ================================================================
//  STABLEGUARD — main contract
// ================================================================
contract StableGuard is AutomationCompatibleInterface {

    // ── Network addresses (set in constructor — chain-agnostic) ──
    address public ccipRouter;
    address public usdcUsdFeed;
    address public daiUsdFeed;

    // ── CCIP destinations ─────────────────────────────────────
    struct Destination {
        uint64  chainSelector;
        address receiver;
    }
    // Destinations to which depeg alerts are broadcast via CCIP.
    // Manage with addDestination() / removeDestination().
    // Full selector list: https://docs.chain.link/ccip/supported-networks
    Destination[] public destinations;

    // Uniswap V3 USDC/USDT pool on Sepolia.
    // Set to address(0) to skip the DEX cross-check (e.g. when no pool has liquidity).
    // Find deployed pools at https://app.uniswap.org/#/pools (switch to Sepolia).
    address public uniswapPool;

    // ── Depeg parameters ──────────────────────────────────────
    // Threshold: 50 basis points = 0.50% deviation from $1.00
    uint256 public constant DEPEG_THRESHOLD_BPS = 50;
    uint256 public constant PEG_TARGET_1E8       = 1e8;  // $1.00 in 8-decimal format

    // Minimum seconds between performUpkeep executions (prevents duplicate alerts)
    uint256 public constant COOLDOWN = 5 minutes;
    uint256 public lastPerformTimestamp;

    // ── Events ────────────────────────────────────────────────
    event DepegAlert(
        string  indexed symbol,
        int256  chainlinkPrice,   // raw Chainlink answer (8 decimals)
        uint256 uniswapPrice1e8,  // DEX cross-check price (0 if pool unavailable)
        uint8   confidenceScore,
        uint256 timestamp
    );

    event CCIPAlertSent(
        bytes32 indexed messageId,
        uint64          destinationChainSelector,
        string          symbol,
        uint8           confidenceScore
    );

    event CCIPAlertFailed(
        uint64  destinationChainSelector,
        string  symbol,
        uint8   confidenceScore
    );

    event ProtectionTriggered(
        string  symbol,
        uint8   confidenceScore,
        uint256 timestamp
    );

    // ── Access control ────────────────────────────────────────
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────
    /// @param _ccipRouter   CCIP Router address on this chain
    /// @param _usdcUsdFeed  Chainlink USDC/USD price feed on this chain (address(0) to disable)
    /// @param _daiUsdFeed   Chainlink DAI/USD price feed on this chain (address(0) to disable)
    /// @param _uniswapPool  USDC/USDT V3 pool; address(0) to skip DEX check
    constructor(
        address _ccipRouter,
        address _usdcUsdFeed,
        address _daiUsdFeed,
        address _uniswapPool
    ) {
        owner       = msg.sender;
        ccipRouter  = _ccipRouter;
        usdcUsdFeed = _usdcUsdFeed;
        daiUsdFeed  = _daiUsdFeed;
        uniswapPool = _uniswapPool;
    }

    /// @dev Allows contract to receive ETH to cover CCIP fees
    receive() external payable {}


    // ================================================================
    //  SECTION 1 — CHAINLINK PRICE FEEDS
    // ================================================================

    /// @notice Reads the latest answer from a Chainlink price feed.
    /// @return price    Raw answer (8 decimals; $1.00 = 100_000_000)
    /// @return fresh    False if data is stale (older than 24 hours)
    function _getChainlinkPrice(address feed)
        internal view returns (int256 price, bool fresh)
    {
        try AggregatorV3Interface(feed).latestRoundData()
            returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80)
        {
            fresh = (block.timestamp - updatedAt) < 24 hours;
            price = answer;
        } catch {
            // Feed unavailable — return zero; caller treats this as no-signal
            return (0, false);
        }
    }

    /// @notice Returns true if an 8-decimal price deviates more than DEPEG_THRESHOLD_BPS from $1.00
    function _isPriceDepegged(int256 price1e8) internal pure returns (bool) {
        if (price1e8 <= 0) return false;
        uint256 p         = uint256(price1e8);
        uint256 threshold = PEG_TARGET_1E8 * DEPEG_THRESHOLD_BPS / 10_000; // 500_000 (= 0.005 * 1e8)
        return p < PEG_TARGET_1E8 - threshold || p > PEG_TARGET_1E8 + threshold;
    }


    // ================================================================
    //  SECTION 2 — UNISWAP V3 DEX CROSS-CHECK
    // ================================================================

    /// @notice Reads the Uniswap V3 pool's sqrtPriceX96 and converts it to
    ///         an 8-decimal price equivalent for depeg comparison.
    ///
    ///         Assumes a USDC/USDT pool where both tokens have 6 decimals,
    ///         so no decimal adjustment is needed.
    ///
    ///         Math:  price = (sqrtPriceX96 / 2^96)^2
    ///                price_1e8 = ((sqrtPriceX96^2 >> 160) * 1e8) >> 32
    ///                Proof for 1:1 pair: sqrtPriceX96 = 2^96
    ///                  sq = 2^192; sq>>160 = 2^32; (2^32 * 1e8)>>32 = 1e8 ✓
    ///
    /// @return price1e8   Pool-implied price in 8-decimal format
    /// @return available  False if pool address is zero or call reverts
    function _getUniswapPrice()
        internal view returns (uint256 price1e8, bool available)
    {
        if (uniswapPool == address(0)) return (0, false);

        try IUniswapV3Pool(uniswapPool).slot0()
            returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool)
        {
            uint256 sq   = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
            price1e8     = ((sq >> 160) * 1e8) >> 32;
            available    = true;
        } catch {
            return (0, false);
        }
    }


    // ================================================================
    //  SECTION 3 — CONFIDENCE SCORING
    // ================================================================

    /// @notice Evaluates USDC and USDT across all available price sources and
    ///         returns a composite confidence score for the first depegged coin.
    ///
    /// @return score    0 = no depeg; 3 = Chainlink only; 5 = Chainlink + Uniswap
    /// @return symbol   "USDC" or "USDT" (empty string when score == 0)
    /// @return clPrice  Raw Chainlink price answer for the depegged coin
    /// @return uniPrice Uniswap cross-check price in 8-decimal format (0 if unavailable)
    function _computeScore()
        internal view
        returns (uint8 score, string memory symbol, int256 clPrice, uint256 uniPrice)
    {
        // ── Check USDC ────────────────────────────────────────
        {
            (int256 p, bool fresh) = _getChainlinkPrice(usdcUsdFeed);
            if (fresh && _isPriceDepegged(p)) {
                score   = 3;          // +3: Chainlink confirms depeg
                symbol  = "USDC";
                clPrice = p;

                (uint256 uniP, bool uniOk) = _getUniswapPrice();
                if (uniOk && _isPriceDepegged(int256(uniP))) {
                    score   += 2;     // +2: Uniswap V3 cross-check confirms
                    uniPrice = uniP;
                }
                return (score, symbol, clPrice, uniPrice);
            }
        }

        // ── Check DAI ─────────────────────────────────────────
        {
            (int256 p, bool fresh) = _getChainlinkPrice(daiUsdFeed);
            if (fresh && _isPriceDepegged(p)) {
                score   = 3;
                symbol  = "DAI";
                clPrice = p;

                (uint256 uniP, bool uniOk) = _getUniswapPrice();
                if (uniOk && _isPriceDepegged(int256(uniP))) {
                    score   += 2;
                    uniPrice = uniP;
                }
                return (score, symbol, clPrice, uniPrice);
            }
        }

        // No depeg detected
        return (0, "", 0, 0);
    }


    // ================================================================
    //  SECTION 4 — CHAINLINK AUTOMATION
    // ================================================================

    /// @notice Called off-chain every block by the Chainlink Automation network.
    ///         Gas-efficient — view only, no state changes.
    ///
    /// @param  checkData  Unused; pass "" when registering the upkeep
    /// @return upkeepNeeded  true when a depeg is detected and cooldown has elapsed
    /// @return performData   abi-encoded (score, symbol, clPrice, uniPrice) for performUpkeep
    function checkUpkeep(bytes calldata checkData)
        external view override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // Suppress unused-variable warning
        checkData;

        // Respect cooldown — prevents performUpkeep spam during sustained depeg
        if (block.timestamp < lastPerformTimestamp + COOLDOWN) {
            return (false, "");
        }

        (uint8 score, string memory sym, int256 clPrice, uint256 uniPrice) = _computeScore();
        if (score == 0) return (false, "");

        upkeepNeeded = true;
        performData  = abi.encode(score, sym, clPrice, uniPrice);
    }

    /// @notice Executed on-chain by the Automation forwarder when checkUpkeep returns true.
    ///         Re-validates live prices (performData may be stale by the time the tx lands).
    ///
    ///         Score 1–2 → DepegAlert event only
    ///         Score 3   → DepegAlert + CCIP cross-chain message
    ///         Score 5   → CCIP message + ProtectionTriggered event
    ///
    /// @param performData  abi-encoded (uint8 score, string symbol, int256 clPrice, uint256 uniPrice)
    function performUpkeep(bytes calldata performData) external override {
        require(block.timestamp >= lastPerformTimestamp + COOLDOWN, "Cooldown active");

        // Decode the data prepared by checkUpkeep
        (uint8 score, string memory sym, int256 clPrice, uint256 uniPrice) =
            abi.decode(performData, (uint8, string, int256, uint256));

        // Re-run live score check — reject stale performData that no longer reflects reality
        (uint8 liveScore,,,) = _computeScore();
        require(liveScore > 0, "No active depeg");

        lastPerformTimestamp = block.timestamp;

        // Score 1–2: log only
        emit DepegAlert(sym, clPrice, uniPrice, score, block.timestamp);

        // Score 3+: send CCIP cross-chain alert
        if (score >= 3) {
            _sendCCIPAlert(sym, score);
        }

        // Score 5: all sources agree — full protection response
        if (score >= 5) {
            emit ProtectionTriggered(sym, score, block.timestamp);
            // The CCIP receiver on the destination chain handles the
            // protection action (e.g. pause deposits, freeze bridge).
        }
    }


    // ================================================================
    //  SECTION 5 — CHAINLINK CCIP
    // ================================================================

    /// @notice Encodes a depeg alert payload and dispatches it to all configured destinations
    ///         via CCIP. Fee is paid in native ETH per destination — ensure this contract
    ///         holds enough ETH. Fund with: `cast send <address> --value 0.1ether`
    function _sendCCIPAlert(string memory symbol, uint8 score) internal {
        if (destinations.length == 0) return;

        bytes memory payload = abi.encode(symbol, score, block.timestamp);

        for (uint256 i = 0; i < destinations.length; i++) {
            Destination memory dest = destinations[i];

            EVM2AnyMessage memory message = EVM2AnyMessage({
                receiver:     abi.encode(dest.receiver),
                data:         payload,
                tokenAmounts: new CCIPTokenAmount[](0),
                feeToken:     address(0),
                extraArgs:    ""
            });

            try IRouterClient(ccipRouter).getFee(dest.chainSelector, message) returns (uint256 fee) {
                if (address(this).balance < fee) {
                    emit CCIPAlertFailed(dest.chainSelector, symbol, score);
                    continue;
                }
                try IRouterClient(ccipRouter).ccipSend{value: fee}(dest.chainSelector, message)
                    returns (bytes32 messageId)
                {
                    emit CCIPAlertSent(messageId, dest.chainSelector, symbol, score);
                } catch {
                    emit CCIPAlertFailed(dest.chainSelector, symbol, score);
                }
            } catch {
                emit CCIPAlertFailed(dest.chainSelector, symbol, score);
            }
        }
    }


    // ================================================================
    //  SECTION 6 — CHAINLINK DATA STREAMS  [PLACEHOLDER]
    // ================================================================
    //
    //  ╔══════════════════════════════════════════════════════════════╗
    //  ║  DATA STREAMS — PENDING API CREDENTIALS                     ║
    //  ║                                                              ║
    //  ║  When Chainlink Data Streams credentials are available,      ║
    //  ║  Data Streams becomes a third confidence source (+2 pts),    ║
    //  ║  raising the maximum score from 5 to 7:                      ║
    //  ║                                                              ║
    //  ║   +3  Chainlink Price Feed confirms depeg                    ║
    //  ║   +2  Uniswap V3 DEX cross-check confirms depeg             ║
    //  ║   +2  Data Streams low-latency report confirms depeg  ← NEW  ║
    //  ║                                                              ║
    //  ║  Score thresholds stay the same (3 → CCIP, 5 → protect).    ║
    //  ║                                                              ║
    //  ║  Implementation steps:                                       ║
    //  ║  1. Add StreamsLookupCompatibleInterface import              ║
    //  ║  2. Add `error StreamsLookup(...)` revert in checkUpkeep     ║
    //  ║  3. Implement checkCallback(bytes[] reports, bytes lookup)   ║
    //  ║  4. Decode report in performUpkeep, add +2 if depegged       ║
    //  ║                                                              ║
    //  ║  Sepolia feed IDs (obtain from Data Streams portal):         ║
    //  ║    USDC/USD: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b ║
    //  ║    USDT/USD: 0x00037da06d56d083fe599397a4769a042d63aa73dc   ║
    //  ║  (verify at https://docs.chain.link/data-streams/stream-ids) ║
    //  ╚══════════════════════════════════════════════════════════════╝
    //
    // --- Stub (uncomment and complete when credentials arrive) ------
    //
    // error StreamsLookup(
    //     string feedParamKey, string[] feeds,
    //     string timeParamKey, uint256 time,
    //     bytes  extraData
    // );
    //
    // function checkUpkeep(...) {
    //     ...
    //     revert StreamsLookup("feedIDs", feedIds, "timestamp", block.timestamp, "");
    // }
    //
    // function checkCallback(bytes[] calldata values, bytes calldata extraData)
    //     external pure returns (bool, bytes memory) {
    //     return (true, abi.encode(values, extraData));
    // }
    //
    // function _scoreDataStreams(bytes memory report) internal pure returns (uint8) {
    //     // (bytes32 feedId, uint32 validFrom, uint32 observationsTs,
    //     //  uint192 nativeFee, uint192 linkFee, uint32 expiresAt, int192 price)
    //     // = abi.decode(report, (bytes32,uint32,uint32,uint192,uint192,uint32,int192));
    //     // return _isPriceDepegged(int256(price)) ? 2 : 0;
    // }
    // ----------------------------------------------------------------


    // ================================================================
    //  ADMIN
    // ================================================================

    /// @notice Add a CCIP destination to broadcast alerts to
    function addDestination(uint64 _chainSelector, address _receiver) external onlyOwner {
        destinations.push(Destination({ chainSelector: _chainSelector, receiver: _receiver }));
    }

    /// @notice Remove a CCIP destination by chain selector (swap-and-pop)
    function removeDestination(uint64 _chainSelector) external onlyOwner {
        uint256 n = destinations.length;
        for (uint256 i = 0; i < n; i++) {
            if (destinations[i].chainSelector == _chainSelector) {
                destinations[i] = destinations[n - 1];
                destinations.pop();
                return;
            }
        }
        revert("Destination not found");
    }

    /// @notice Set or clear the Uniswap V3 pool for DEX cross-check
    function setUniswapPool(address _pool) external onlyOwner {
        uniswapPool = _pool;
    }

    /// @notice Update the USDC/USD Chainlink price feed (pass address(0) to disable)
    function setUsdcFeed(address _feed) external onlyOwner {
        usdcUsdFeed = _feed;
    }

    /// @notice Update the DAI/USD Chainlink price feed (pass address(0) to disable)
    function setDaiFeed(address _feed) external onlyOwner {
        daiUsdFeed = _feed;
    }

    /// @notice Withdraw accumulated ETH (e.g. unused CCIP fee balance)
    function withdrawETH() external onlyOwner {
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}


// ================================================================
//  STABLEGUARD RECEIVER — deploy on destination chain
//
//  Receives CCIP depeg alerts from StableGuard on Sepolia.
//  Emits events that off-chain infrastructure (e.g. a bridge pause
//  service) can subscribe to, or add on-chain protection logic here.
// ================================================================
contract StableGuardReceiver is IAny2EVMMessageReceiver {

    // CCIP Router address on the destination chain — set to the correct
    // network's router before deploying.
    // Router addresses: https://docs.chain.link/ccip/supported-networks
    address public immutable ccipRouter;

    address public owner;

    // The StableGuard contract address on the source chain — only accept messages from it
    address public trustedSender;

    // CCIP chain selector for the source chain (set in constructor)
    // Common testnet selectors:
    //   Ethereum Sepolia:  16015286601757825753
    //   Arbitrum Sepolia:   3478487238524512106
    // Full list: https://docs.chain.link/ccip/supported-networks
    uint64 public immutable sourceChainSelector;

    event AlertReceived(
        bytes32 indexed messageId,
        string  symbol,
        uint8   confidenceScore,
        uint256 originalTimestamp,
        uint256 receivedAt
    );

    event ProtectionActivated(
        string  symbol,
        uint8   confidenceScore,
        uint256 timestamp
    );

    modifier onlyRouter() {
        require(msg.sender == ccipRouter, "Caller is not CCIP router");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _ccipRouter, address _trustedSender, uint64 _sourceChainSelector) {
        ccipRouter           = _ccipRouter;
        trustedSender        = _trustedSender;
        sourceChainSelector  = _sourceChainSelector;
        owner                = msg.sender;
    }

    /// @notice Called by the CCIP router when a cross-chain message arrives.
    ///         Only accepts messages from the trusted StableGuard on the configured source chain.
    function ccipReceive(Any2EVMMessage calldata message)
        external override onlyRouter
    {
        // Verify message originates from the correct source chain
        require(
            message.sourceChainSelector == sourceChainSelector,
            "Untrusted source chain"
        );

        // Verify sender is the authorised StableGuard contract
        address sender = abi.decode(message.sender, (address));
        require(sender == trustedSender, "Untrusted sender");

        // Decode the depeg alert payload
        (string memory symbol, uint8 score, uint256 originalTs) =
            abi.decode(message.data, (string, uint8, uint256));

        emit AlertReceived(message.messageId, symbol, score, originalTs, block.timestamp);

        // Score 5 = all sources agreed — activate full protection
        if (score >= 5) {
            emit ProtectionActivated(symbol, score, block.timestamp);
            // Insert protection logic here:
            // e.g. IBridge(bridgeAddress).pause();
            //      IVault(vaultAddress).freezeDeposits();
        }
    }

    // ── Admin ─────────────────────────────────────────────────
    function setTrustedSender(address _sender) external onlyOwner {
        trustedSender = _sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
