// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Minimal Chainlink AggregatorV3 mock for local/testnet depeg testing.
///      Returns a hardcoded price that can be updated by the deployer.
contract MockAggregatorV3 {
    int256 public answer;
    address public owner;

    uint8  public constant decimals = 8;
    uint80 private constant ROUND   = 1;

    constructor(int256 _answer) {
        answer = _answer;
        owner  = msg.sender;
    }

    function setAnswer(int256 _answer) external {
        require(msg.sender == owner, "Not owner");
        answer = _answer;
    }

    function latestRoundData()
        external view
        returns (
            uint80  roundId,
            int256  ans,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        )
    {
        return (ROUND, answer, block.timestamp, block.timestamp, ROUND);
    }
}
