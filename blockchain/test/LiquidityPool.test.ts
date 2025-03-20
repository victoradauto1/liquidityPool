import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Liquidity Pool", function () {
  async function deployLiquidityPoolFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // Deployando tokens mock ERC-20
    const Token = await hre.ethers.getContractFactory("ERC20");
    const token0 = await Token.deploy("Token0", "TK0");
    const token1 = await Token.deploy("Token1", "TK1");

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deployando o LiquidityPool com os endereços dos tokens
    const LiquidityPool = await hre.ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(
      await token0.getAddress(),
      await token1.getAddress()
    );

    return { liquidityPool, token0, token1, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy correctly", async function () {
      const { liquidityPool, token0, token1 } = await loadFixture(deployLiquidityPoolFixture);
      
      expect(await liquidityPool.token0()).to.equal(await token0.getAddress());
      expect(await liquidityPool.token1()).to.equal(await token1.getAddress());
    });
  });
});
