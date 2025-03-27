// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// , ERC20Burnable, Ownable,
contract LiquidityPool is ERC20, ReentrancyGuard {
    IERC20 public token0;
    IERC20 public token1;

    uint public reserve0; //balance token0
    uint public reserve1; //balance token1

    uint public fee = 30;//0.30%

    constructor(address _token0, address _token1) ERC20("LP Token", "LPT") {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function _update(uint _reserve0, uint _reserve1) private {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
    }

    // returns the square root of a number
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint x, uint y) internal pure returns(uint){
        return x >= y? x : y;
    }

    function deposit(
        uint _amount0,
        uint _amount1
    ) external nonReentrant returns (uint shares) {
        if (reserve0 > 0 || reserve1 > 0) {
            require(reserve0 * _amount1 == reserve1 * _amount0, "x/y != dx/dy"); //x/y == dx/dy;
        }

        token0.transferFrom(msg.sender, address(this), _amount0);
        token1.transferFrom(msg.sender, address(this), _amount1);

        uint totalSupply = totalSupply();
        if(totalSupply == 0){
            shares = sqrt(_amount0 * _amount1);
        }else{
            shares = _min((_amount0 * _amount1) / reserve0, (_amount0 * _amount1) / reserve1); 
        }
        require(shares > 0, "shares = 0");
        _mint(msg.sender, shares);
        _update(reserve0 + _amount0, reserve1 + _amount1);
    }

    function withdraw(uint _shares) external nonReentrant returns(uint amount0, uint amount1){
        uint bal0 = token0.balanceOf(address(this));
        uint bal1 = token1.balanceOf(address(this));

        uint totalSupply = totalSupply();
        amount0 = (_shares * bal0) / totalSupply;
        amount1 = (_shares * bal1) / totalSupply;

        require(amount0 > 0 && amount1 > 0, "amount0 or amount1 == 0");
        _burn(msg.sender, _shares);
        _update(bal0 -amount0, bal1 - amount1);

        token0.transfer(msg.sender, amount0);
        token0.transfer(msg.sender, amount1);
    }

    function swap(address _tokenIn, uint _amountIn) external returns(uint amountOut){
        require(_tokenIn == address(token0) || _tokenIn == address(token1), "invalid token");
        require(_amountIn > 0, "invalid Amount");

        bool isToken0 = _tokenIn == address(token0);
        (
            IERC20 tokenIn, 
            IERC20 tokenOut, 
            uint256 reserveIn, 
            uint256 reserveOut) = 
            isToken0
            ? (token1, token0, reserve1, reserve0)
            : (token0, token1, reserve0, reserve1);
        
        tokenIn.transferFrom(msg.sender, address(this), _amountIn);

        uint amountWithFee = ( _amountIn * (10000 - fee)) / 10000;
        
        amountOut = (reserveOut * amountWithFee) / (reserveIn * amountWithFee);

        tokenOut.transfer(msg.sender, amountOut);
        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));

    }
}
