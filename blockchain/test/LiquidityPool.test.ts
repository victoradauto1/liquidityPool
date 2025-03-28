import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Liquidity Pool", function () {
  async function deployLiquidityPoolFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // Deployando tokens mock ERC-20
    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const token0 = await MockToken.deploy("Token0", "TK0");
    const token1 = await MockToken.deploy("Token1", "TK1");

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deployando o LiquidityPool com os endereços dos tokens
    const LiquidityPool = await hre.ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(
      await token0.getAddress(),
      await token1.getAddress()
    );

    await liquidityPool.waitForDeployment();

    return { liquidityPool, token0, token1, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy correctly", async function () {
      const { liquidityPool, token0, token1 } = await loadFixture(
        deployLiquidityPoolFixture
      );

      expect(await liquidityPool.token0()).to.equal(await token0.getAddress());
      expect(await liquidityPool.token1()).to.equal(await token1.getAddress());
    });
  });

  describe("Deposit", function () {
    it("Should allow deposit when liquidity pool is empty", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(
        deployLiquidityPoolFixture
      );

      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("100");

      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);

      await expect(liquidityPool.deposit(amount0, amount1))
        .to.emit(liquidityPool, "Transfer")
        .withArgs(
          hre.ethers.ZeroAddress,
          owner.address,
          hre.ethers.parseEther("100")
        ); // Assume LP tokens are sqrt(100 * 100)

      expect(await liquidityPool.reserve0()).to.equal(amount0);
      expect(await liquidityPool.reserve1()).to.equal(amount1);
    });

    it("Should not allow deposit (different proportion of peers)", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(
        deployLiquidityPoolFixture
      );

      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("100");

      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);

      await liquidityPool.deposit(amount0, amount1);

      const amount3 = hre.ethers.parseEther("100");
      const amount4 = hre.ethers.parseEther("80");

      await token0.approve(await liquidityPool.getAddress(), amount3);
      await token1.approve(await liquidityPool.getAddress(), amount4);

      await expect(liquidityPool.deposit(amount3, amount4)).to.be.revertedWith(
        "x/y != dx/dy"
      );
    });

    it("Should correctly calculate shares when totalSupply is not zero", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(deployLiquidityPoolFixture);
    
      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("100");
    
      // Initial deposit to ensure the total supply is not zero
      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);
    
      await liquidityPool.deposit(amount0, amount1);
    
      // verifying that the total supply is not zero after the first deposit
      const totalSupply = await liquidityPool.totalSupply();
      expect(totalSupply).to.be.gt(0);

      //now we do the second deposit to test the shres calculate logical
      const amount2 = hre.ethers.parseEther("150");
      const amount3 = hre.ethers.parseEther("150");
    
      await token0.approve(await liquidityPool.getAddress(), amount2);
      await token1.approve(await liquidityPool.getAddress(), amount3);
    
      await liquidityPool.deposit(amount2, amount3);
    
      // Verifying the total supply again
      const totalSupplyAfter = await liquidityPool.totalSupply();
      expect(totalSupplyAfter).to.be.gt(totalSupply);  // The total supply must be increased
    });

    it("Should handle first deposit correctly", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(
        deployLiquidityPoolFixture
      );
  
      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("100");
  
      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);
  
      // Verifique se o primeiro depósito funciona corretamente
      await expect(liquidityPool.deposit(amount0, amount1))
        .to.emit(liquidityPool, "Transfer")
        .withArgs(hre.ethers.ZeroAddress, owner.address, hre.ethers.parseEther("100"));
    });
    
  });

  describe("Withdraw", function () {
    // it("Should allow deposit when liquidity pool is empty", async function () {
    //   const { liquidityPool, token0, token1, owner } = await loadFixture(deployLiquidityPoolFixture);
    // });
  });
});
