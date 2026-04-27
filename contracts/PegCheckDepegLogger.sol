// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PegCheckDepegLogger {

    address public owner;

    struct DepegEventData {
        string  symbol;
        uint256 price;      // price * 1e8 (e.g. $0.97 = 97000000)
        uint256 timestamp;
        string  severity;   // "warning" or "depegged"
    }

    DepegEventData[] private depegEvents;

    event DepegEvent(
        string  indexed symbol,
        uint256 price,
        uint256 timestamp,
        string  severity
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function logDepegEvent(
        string calldata symbol,
        uint256 price,
        string calldata severity
    ) external onlyOwner {
        require(bytes(symbol).length > 0, "Symbol required");
        require(price > 0, "Price required");
        require(
            keccak256(bytes(severity)) == keccak256(bytes("warning")) ||
            keccak256(bytes(severity)) == keccak256(bytes("depegged")),
            "Severity must be warning or depegged"
        );

        depegEvents.push(DepegEventData({
            symbol:    symbol,
            price:     price,
            timestamp: block.timestamp,
            severity:  severity
        }));

        emit DepegEvent(symbol, price, block.timestamp, severity);
    }

    function getDepegEvents() external view returns (DepegEventData[] memory) {
        return depegEvents;
    }

    function getDepegEventCount() external view returns (uint256) {
        return depegEvents.length;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
