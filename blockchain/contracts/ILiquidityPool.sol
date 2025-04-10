// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ILiquidityPool {

    function deposit(
        uint _amount0,
        uint _amount1
    ) external  returns (uint shares);

    function withdraw(
        uint _shares
    ) external returns (uint amount0, uint amount1);

    
    function swap(
        address _tokenIn,
        uint _amountIn
    ) external  returns (uint amountOut) ;
}
