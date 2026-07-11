// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

struct CCIPTokenAmount { address token; uint256 amount; }
struct Any2EVMMessage {
    bytes32           messageId;
    uint64            sourceChainSelector;
    bytes             sender;
    bytes             data;
    CCIPTokenAmount[] tokenAmounts;
}

interface IAny2EVMMessageReceiver {
    function ccipReceive(Any2EVMMessage calldata message) external;
}

/// Diagnostic-only receiver: stores msg.sender and message fields as state,
/// no access control, so it always succeeds regardless of who calls it.
/// Poll lastCaller / called / lastSender via view calls instead of getLogs.
contract DiagnosticReceiver is IAny2EVMMessageReceiver {
    bool    public called;
    address public lastCaller;
    bytes32 public lastMessageId;
    uint64  public lastSourceChainSelector;
    bytes   public lastSender;
    bytes   public lastData;

    function ccipReceive(Any2EVMMessage calldata message) external override {
        called                  = true;
        lastCaller              = msg.sender;
        lastMessageId           = message.messageId;
        lastSourceChainSelector = message.sourceChainSelector;
        lastSender              = message.sender;
        lastData                = message.data;
    }

    receive() external payable {}
}
