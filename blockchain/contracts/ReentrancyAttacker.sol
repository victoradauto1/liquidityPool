// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LiquidityPool.sol";

// Malicious contract to test reentrancy protection
contract ReentrancyAttacker {
    LiquidityPool public liquidityPool;
    IERC20 public token0;
    IERC20 public token1;
    
    uint256 public attackAmount;
    bool public attacking = false;
    
    event AttackLog(string message, uint256 amount);
    
    constructor(address _liquidityPool, address _token0, address _token1) {
        liquidityPool = LiquidityPool(_liquidityPool);
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }
    
    // Function to receive ETH (in case of fallback)
    receive() external payable {}
    
    // Function to initiate the attack
    function attack(uint256 _amount) external {
        attackAmount = _amount;
        attacking = true;
        
        // Approve the pool to spend tokens
        token0.approve(address(liquidityPool), attackAmount);
        
        // First swap call that will trigger the reentrancy
        liquidityPool.swap(address(token0), attackAmount);
        
        attacking = false;
        emit AttackLog("Attack completed", attackAmount);
    }
    
    // This function will be called by ERC20 token1.transfer during the swap
    function receiveTokens(address token, uint256 amount) external {
        // Only continue the attack if we are still in attacking mode
        if (attacking && token == address(token1)) {
            emit AttackLog("Received tokens during attack", amount);
            
            // Attempt reentrancy - call swap again before the first call finishes
            try liquidityPool.swap(address(token0), attackAmount) {
                emit AttackLog("Reentrancy successful!", attackAmount);
            } catch Error(string memory) {
                emit AttackLog("Reentrancy failed", 0);
            }
        }
    }
    
    // Function to simulate an ERC777-like token with hooks
    // that can potentially call back the swap function
    function tokenFallback(address, uint256 value) external {
        if (attacking && msg.sender == address(token1)) {
            emit AttackLog("tokenFallback called during attack", value);
            
            // Attempt reentrancy
            try liquidityPool.swap(address(token0), attackAmount) {
                emit AttackLog("Reentrancy via tokenFallback successful!", attackAmount);
            } catch Error(string memory) {
                emit AttackLog("Reentrancy via tokenFallback failed", 0);
            }
        }
    }
    
    // Function to withdraw tokens from the attacker contract
    function withdraw() external {
        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        
        token0.transfer(msg.sender, balance0);
        token1.transfer(msg.sender, balance1);
        
        emit AttackLog("Balance withdrawn", balance0 + balance1);
    }
}