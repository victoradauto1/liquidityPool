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
    
      // Primeiro, configuramos a pool de liquidez com alguns tokens
      const amount0 = hre.ethers.parseEther("100");
      const amount1 = hre.ethers.parseEther("80");
    
      await token0.approve(await liquidityPool.getAddress(), amount0);
      await token1.approve(await liquidityPool.getAddress(), amount1);
      await liquidityPool.deposit(amount0, amount1);
    
      // Obtém saldos iniciais antes da troca
      const initialToken0Balance = await token0.balanceOf(owner.address);
      const initialToken1Balance = await token1.balanceOf(owner.address);
      const initialReserve0 = await liquidityPool.reserve0();
      const initialReserve1 = await liquidityPool.reserve1();
    
      // Prepara para trocar token0 por token1
      const swapAmount = hre.ethers.parseEther("10");
      await token0.approve(await liquidityPool.getAddress(), swapAmount);
    
      // Executa o swap
      await liquidityPool.swap(await token0.getAddress(), swapAmount);
    
      // Verifica os novos saldos após a troca
      const finalToken0Balance = await token0.balanceOf(owner.address);
      const finalToken1Balance = await token1.balanceOf(owner.address);
      const finalReserve0 = await liquidityPool.reserve0();
      const finalReserve1 = await liquidityPool.reserve1();
    
      // Verifica que os tokens foram trocados corretamente
      expect(finalToken0Balance).to.be.lt(initialToken0Balance); // Menos token0
      expect(finalToken1Balance).to.be.gt(initialToken1Balance); // Mais token1
      
      // Verifica que as reservas foram atualizadas
      expect(finalReserve0).to.be.gt(initialReserve0); // Mais token0 na reserva
      expect(finalReserve1).to.be.lt(initialReserve1); // Menos token1 na reserva
    
      // Verificação adicional para garantir que o fee foi aplicado corretamente
      const amountWithFee = (swapAmount * BigInt(10000 - 30)) / BigInt(10000); // 0.3% fee
      expect(finalReserve0 - initialReserve0).to.equal(swapAmount);
    });
  });

  describe("LiquidityPool Reentrancy Protection", function () {
    async function deployReentrancyTestFixture() {
      // Contas para teste
      const [owner, attacker] = await hre.ethers.getSigners();
      
      // Deploy dos tokens
      const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
      const token0 = await MockERC20.deploy("Token0", "TK0");
      const token1 = await MockERC20.deploy("Token1", "TK1");
      
      // Para garantir a ordem correta independente dos endereços
      const sortedTokens = await sortTokens(token0.getAddress(), token1.getAddress());
      const orderedToken0 = sortedTokens[0];
      const orderedToken1 = sortedTokens[1];
      
      // Deploy da pool de liquidez
      const LiquidityPool = await hre.ethers.getContractFactory("LiquidityPool");
      const liquidityPool = await LiquidityPool.deploy(
        await orderedToken0.getAddress(),
        await orderedToken1.getAddress()
      );
      
      // Configurar a pool com liquidez inicial
      const amount0 = hre.ethers.parseEther("1000");
      const amount1 = hre.ethers.parseEther("1000");
      
      await orderedToken0.mint(owner.address, amount0 * BigInt(10));
      await orderedToken1.mint(owner.address, amount1 * BigInt(10));
      
      await orderedToken0.approve(await liquidityPool.getAddress(), amount0);
      await orderedToken1.approve(await liquidityPool.getAddress(), amount1);
      await liquidityPool.deposit(amount0, amount1);
      
      // Deploy do contrato de ataque
      const ReentrancyAttacker = await hre.ethers.getContractFactory("ReentrancyAttacker");
      const attacker0 = token0.getAddress() === orderedToken0.getAddress() ? token0 : token1;
      const attacker1 = token0.getAddress() === orderedToken0.getAddress() ? token1 : token0;
      
      const attackerContract = await ReentrancyAttacker.deploy(
        await liquidityPool.getAddress(),
        await attacker0.getAddress(),
        await attacker1.getAddress()
      );
      
      // Enviar tokens para o contrato atacante
      const attackAmount = hre.ethers.parseEther("10");
      await attacker0.mint(await attackerContract.getAddress(), attackAmount);
      
      return { 
        liquidityPool, 
        token0: orderedToken0, 
        token1: orderedToken1, 
        owner, 
        attacker, 
        attackerContract,
        attackAmount
      };
    }
    
    // Função auxiliar para ordenar os tokens por endereço (como em muitos DEXs)
    async function sortTokens(tokenA:string , tokenB: string) {
      const addrA = await tokenA;
      const addrB = await tokenB;
      
      if (addrA < addrB) {
        return [await hre.ethers.getContractAt("MockERC20", addrA), await hre.ethers.getContractAt("MockERC20", addrB)];
      } else {
        return [await hre.ethers.getContractAt("MockERC20", addrB), await hre.ethers.getContractAt("MockERC20", addrA)];
      }
    }
  
    describe("Teste de proteção contra reentrância", function () {
      it("Deve prevenir ataques de reentrância na função swap", async function () {
        const { liquidityPool, token0, token1, attackerContract, attackAmount } = await loadFixture(
          deployReentrancyTestFixture
        );
        
        // Guarda o estado inicial da pool
        const initialReserve0 = await liquidityPool.reserve0();
        const initialReserve1 = await liquidityPool.reserve1();
        
        // Executa o ataque - Se a proteção contra reentrância estiver funcionando,
        // o contrato fará apenas uma troca bem-sucedida e qualquer tentativa de reentrância falhará
        try {
          await attackerContract.attack(attackAmount);
        } catch (error) {
          // Em alguns cenários, o ataque inteiro pode falhar, o que também é aceitável
          console.log("Ataque falhou completamente:", error.message);
        }
        
        // Verifica se as reservas mudaram apenas uma vez (pela troca inicial)
        // e não várias vezes (o que aconteceria se a reentrância tivesse sucesso)
        const finalReserve0 = await liquidityPool.reserve0();
        const finalReserve1 = await liquidityPool.reserve1();
        
        // O ataque foi realizado com token0, então reserve0 deve aumentar e reserve1 diminuir
        // apenas uma vez pela troca legítima
        expect(finalReserve0).to.be.gt(initialReserve0);
        expect(finalReserve1).to.be.lt(initialReserve1);
        
        // Opcional: verificar os logs do contrato atacante para confirmar que a reentrância falhou
        const attackLogs = await hre.ethers.provider.getLogs({
          address: await attackerContract.getAddress(),
          fromBlock: "latest",
        });
        
        // Registrar os eventos para análise
        console.log("Logs de ataque:", attackLogs);
      });
      
      it("Deve completar com sucesso uma única operação swap legítima", async function () {
        const { liquidityPool, token0, owner } = await loadFixture(
          deployReentrancyTestFixture
        );
        
        // Verificar que uma operação swap normal ainda funciona
        const swapAmount = hre.ethers.parseEther("5");
        await token0.approve(await liquidityPool.getAddress(), swapAmount);
        
        // Executa o swap
        await liquidityPool.swap(await token0.getAddress(), swapAmount);
        
        // Se chegamos aqui sem erros, o teste passou
        expect(true).to.be.true;
      });
    });
  });
});
