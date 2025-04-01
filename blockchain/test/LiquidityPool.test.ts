import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { LiquidityPool__factory } from "../typechain-types";

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

    it("Should revert when deposit would result in zero shares", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(
        deployLiquidityPoolFixture
      );
    
      // scenarios for trying deposit with zero shares
      const testScenarios = [
        { 
          amount0: 1n,  // Minimum possible value
          amount1: 0n,  // Zero tokens
          expectedReason: "Insufficient liquidity"
        },
        { 
          amount0: 0n,  // Zero tokens
          amount1: 1n,  // Minimum possible value
          expectedReason: "Insufficient liquidity"
        }
      ];
    
      for (const scenario of testScenarios) {
      
        await token0.approve(await liquidityPool.getAddress(), scenario.amount0);
        await token1.approve(await liquidityPool.getAddress(), scenario.amount1);
    

        //Try to deposit and wait for it be reverted
        await expect(
          liquidityPool.deposit(scenario.amount0, scenario.amount1)
        ).to.be.revertedWith(scenario.expectedReason);
      }
    });
    
  });

  describe("Withdraw", function () {
 
      async function deployLiquidityPoolFixtureWithdraw(amount0: bigint, amount1: bigint) {
        const [owner, otherAccount] = await hre.ethers.getSigners();
    
        // Deployando tokens mock ERC-20 sem pré-mintar
        const MockToken = await hre.ethers.getContractFactory("MockERC20");
        // Modifique o construtor para não pré-mintar ou use outra abordagem
        const token0 = await MockToken.deploy("Token0", "TK0");
        const token1 = await MockToken.deploy("Token1", "TK1");
    
        await token0.waitForDeployment();
        await token1.waitForDeployment();

        //Only the necessary amount mint
        const testAmount0 = hre.ethers.parseEther(`${amount0}`);
        const testAmount1 = hre.ethers.parseEther(`${amount1}`);
        await token0.mint(owner.address, testAmount0);
        await token1.mint(owner.address, testAmount1);
    
        // Deploying the LiquidityPool
        const LiquidityPool = await hre.ethers.getContractFactory("LiquidityPool");
        const liquidityPool = await LiquidityPool.deploy(
          await token0.getAddress(),
          await token1.getAddress()
        );
    
        await liquidityPool.waitForDeployment();

        const baseCoin =  1000000n * 10n**18n;
    
        return { liquidityPool, token0, token1, owner, otherAccount, baseCoin };
    }
    

    it("Should withdraw tokens proportionally to shares", async function () {
      
      const { liquidityPool, token0, token1, owner, otherAccount, baseCoin } = await deployLiquidityPoolFixtureWithdraw(100n, 80n);
  
      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("80");
  
      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);

      await liquidityPool.deposit(amount0, amount1);
      
      //getting the lp token owner
      const ownerShares = await liquidityPool.balanceOf(owner.address);
      const ownertoken0AmountBefore = await token0.balanceOf(owner.address);
      const ownertoken1AmountBefore = await token1.balanceOf(owner.address);

      expect( ownertoken0AmountBefore ).to.equal(baseCoin);
      expect( ownertoken1AmountBefore ).to.equal(baseCoin)

      await liquidityPool.withdraw(ownerShares);

      const ownertoken0AmountAfter =  await token0.balanceOf(owner.address);
      const ownertoken1AmountAfter =  await token1.balanceOf(owner.address);

      expect(ownertoken0AmountAfter).to.equal(hre.ethers.parseEther("100") + baseCoin);
      expect(ownertoken1AmountAfter).to.equal(hre.ethers.parseEther("80") + baseCoin);
    });

  });

  describe("swap", function () {
    it("Should swap", async function () {
      const { liquidityPool, token0, token1, owner, otherAccount } = await loadFixture(
        deployLiquidityPoolFixture
      );

      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("80");
  
      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);

      await liquidityPool.deposit(amount0, amount1);

    });
  });
});
