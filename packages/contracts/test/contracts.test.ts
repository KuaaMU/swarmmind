import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AgentRegistry", () => {
  async function deployFixture() {
    const [owner, scout, oracle, executor, manager, other] =
      await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();

    return { registry, owner, scout, oracle, executor, manager, other };
  }

  describe("registerAgent", () => {
    it("registers a new agent", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(scout)
          .registerAgent("Alpha Scout", 0, "http://localhost:3001", 1000),
      )
        .to.emit(registry, "AgentRegistered")
        .withArgs(scout.address, "Alpha Scout", 0);

      const info = await registry.getAgent(scout.address);
      expect(info.name).to.equal("Alpha Scout");
      expect(info.role).to.equal(0); // SCOUT
      expect(info.isActive).to.be.true;
      expect(info.pricePerCall).to.equal(1000);
    });

    it("rejects duplicate registration", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await registry
        .connect(scout)
        .registerAgent("Scout", 0, "http://localhost:3001", 1000);

      await expect(
        registry
          .connect(scout)
          .registerAgent("Scout2", 0, "http://localhost:3001", 2000),
      ).to.be.revertedWith("Agent already registered");
    });

    it("rejects empty name", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await expect(
        registry.connect(scout).registerAgent("", 0, "http://localhost", 1000),
      ).to.be.revertedWith("Name required");
    });

    it("rejects empty endpoint", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await expect(
        registry.connect(scout).registerAgent("Scout", 0, "", 1000),
      ).to.be.revertedWith("Endpoint required");
    });

    it("increments agent count", async () => {
      const { registry, scout, oracle } = await loadFixture(deployFixture);

      expect(await registry.getAgentCount()).to.equal(0);

      await registry
        .connect(scout)
        .registerAgent("Scout", 0, "http://scout", 1000);
      expect(await registry.getAgentCount()).to.equal(1);

      await registry
        .connect(oracle)
        .registerAgent("Oracle", 1, "http://oracle", 2000);
      expect(await registry.getAgentCount()).to.equal(2);
    });
  });

  describe("updatePricing", () => {
    it("updates price per call", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await registry
        .connect(scout)
        .registerAgent("Scout", 0, "http://scout", 1000);

      await expect(registry.connect(scout).updatePricing(5000))
        .to.emit(registry, "PricingUpdated")
        .withArgs(scout.address, 5000);

      const info = await registry.getAgent(scout.address);
      expect(info.pricePerCall).to.equal(5000);
    });

    it("rejects unregistered agent", async () => {
      const { registry, other } = await loadFixture(deployFixture);

      await expect(
        registry.connect(other).updatePricing(1000),
      ).to.be.revertedWith("Agent not registered");
    });
  });

  describe("recordPayment", () => {
    it("records payment and updates earnings/spending", async () => {
      const { registry, owner, scout, oracle } =
        await loadFixture(deployFixture);

      await registry
        .connect(scout)
        .registerAgent("Scout", 0, "http://scout", 1000);
      await registry
        .connect(oracle)
        .registerAgent("Oracle", 1, "http://oracle", 2000);

      await expect(
        registry.connect(owner).recordPayment(scout.address, oracle.address, 500),
      )
        .to.emit(registry, "PaymentRecorded")
        .withArgs(scout.address, oracle.address, 500);

      const scoutInfo = await registry.getAgent(scout.address);
      expect(scoutInfo.totalSpending).to.equal(500);

      const oracleInfo = await registry.getAgent(oracle.address);
      expect(oracleInfo.totalEarnings).to.equal(500);
    });

    it("rejects non-owner calls", async () => {
      const { registry, scout, oracle } = await loadFixture(deployFixture);

      await expect(
        registry.connect(scout).recordPayment(scout.address, oracle.address, 100),
      ).to.be.reverted;
    });
  });

  describe("deactivateAgent", () => {
    it("deactivates an agent", async () => {
      const { registry, scout } = await loadFixture(deployFixture);

      await registry
        .connect(scout)
        .registerAgent("Scout", 0, "http://scout", 1000);

      await expect(registry.connect(scout).deactivateAgent())
        .to.emit(registry, "AgentDeactivated")
        .withArgs(scout.address);

      const info = await registry.getAgent(scout.address);
      expect(info.isActive).to.be.false;
    });
  });

  describe("getActiveAgentsByRole", () => {
    it("returns only active agents of given role", async () => {
      const { registry, scout, oracle, executor } =
        await loadFixture(deployFixture);

      // Register 2 scouts and 1 oracle
      await registry
        .connect(scout)
        .registerAgent("Scout1", 0, "http://s1", 1000);
      await registry
        .connect(executor)
        .registerAgent("Scout2", 0, "http://s2", 1000);
      await registry
        .connect(oracle)
        .registerAgent("Oracle", 1, "http://o1", 2000);

      const scouts = await registry.getActiveAgentsByRole(0);
      expect(scouts).to.have.length(2);

      const oracles = await registry.getActiveAgentsByRole(1);
      expect(oracles).to.have.length(1);

      // Deactivate one scout
      await registry.connect(scout).deactivateAgent();
      const activeScouts = await registry.getActiveAgentsByRole(0);
      expect(activeScouts).to.have.length(1);
    });
  });
});

describe("AgentWalletFactory", () => {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AgentWalletFactory");
    const factory = await Factory.deploy();

    return { factory, owner, user1, user2 };
  }

  describe("createWallet", () => {
    it("creates a deterministic wallet", async () => {
      const { factory, user1 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("alpha-scout-wallet"));
      const predicted = await factory.predictWalletAddress(salt);

      await expect(factory.connect(user1).createWallet(salt))
        .to.emit(factory, "WalletCreated")
        .withArgs(user1.address, predicted, salt);

      expect(await factory.getWalletCount()).to.equal(1);

      const wallets = await factory.getWalletsByOwner(user1.address);
      expect(wallets).to.have.length(1);
      expect(wallets[0]).to.equal(predicted);
    });

    it("creates wallets at predicted addresses", async () => {
      const { factory, user1 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("test-salt"));
      const predicted = await factory.predictWalletAddress(salt);

      await factory.connect(user1).createWallet(salt);

      const wallets = await factory.getWalletsByOwner(user1.address);
      expect(wallets[0]).to.equal(predicted);
    });

    it("creates multiple wallets per user", async () => {
      const { factory, user1 } = await loadFixture(deployFixture);

      const salt1 = ethers.keccak256(ethers.toUtf8Bytes("wallet-1"));
      const salt2 = ethers.keccak256(ethers.toUtf8Bytes("wallet-2"));

      await factory.connect(user1).createWallet(salt1);
      await factory.connect(user1).createWallet(salt2);

      const wallets = await factory.getWalletsByOwner(user1.address);
      expect(wallets).to.have.length(2);
      expect(await factory.getWalletCount()).to.equal(2);
    });
  });

  describe("AgentWallet", () => {
    it("initializes with correct owner", async () => {
      const { factory, user1 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await factory.connect(user1).createWallet(salt);

      const wallets = await factory.getWalletsByOwner(user1.address);
      const wallet = await ethers.getContractAt("AgentWallet", wallets[0]);

      expect(await wallet.owner()).to.equal(user1.address);
    });

    it("rejects double initialization", async () => {
      const { factory, user1, user2 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await factory.connect(user1).createWallet(salt);

      const wallets = await factory.getWalletsByOwner(user1.address);
      const wallet = await ethers.getContractAt("AgentWallet", wallets[0]);

      await expect(
        wallet.connect(user2).initialize(user2.address),
      ).to.be.revertedWith("Already initialized");
    });

    it("only owner can execute", async () => {
      const { factory, user1, user2 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await factory.connect(user1).createWallet(salt);

      const wallets = await factory.getWalletsByOwner(user1.address);
      const wallet = await ethers.getContractAt("AgentWallet", wallets[0]);

      await expect(
        wallet.connect(user2).execute(user2.address, 0, "0x"),
      ).to.be.revertedWith("Not owner");
    });

    it("receives and withdraws ETH", async () => {
      const { factory, user1 } = await loadFixture(deployFixture);

      const salt = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await factory.connect(user1).createWallet(salt);

      const wallets = await factory.getWalletsByOwner(user1.address);
      const walletAddr = wallets[0];
      const wallet = await ethers.getContractAt("AgentWallet", walletAddr);

      // Send ETH to wallet
      await user1.sendTransaction({
        to: walletAddr,
        value: ethers.parseEther("1.0"),
      });

      const balanceBefore = await ethers.provider.getBalance(walletAddr);
      expect(balanceBefore).to.equal(ethers.parseEther("1.0"));

      // Withdraw
      await wallet.connect(user1).withdraw();

      const balanceAfter = await ethers.provider.getBalance(walletAddr);
      expect(balanceAfter).to.equal(0);
    });
  });
});

describe("PaymentSettlement", () => {
  async function deployFixture() {
    const [owner, payer, payee, other] = await ethers.getSigners();

    // Deploy mock USDC (ERC20)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy registry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();

    // Deploy settlement
    const Settlement = await ethers.getContractFactory("PaymentSettlement");
    const settlement = await Settlement.deploy(
      await usdc.getAddress(),
      await registry.getAddress(),
    );

    // Transfer registry ownership to settlement for recordPayment
    await registry.setPaymentSettlement(await settlement.getAddress());

    // Mint USDC to payer
    await usdc.mint(payer.address, ethers.parseUnits("1000", 6));

    // Approve settlement to spend USDC
    await usdc
      .connect(payer)
      .approve(await settlement.getAddress(), ethers.MaxUint256);

    return { usdc, registry, settlement, owner, payer, payee, other };
  }

  describe("settlePayment", () => {
    it("settles a single payment", async () => {
      const { settlement, payer, payee } = await loadFixture(deployFixture);

      const amount = ethers.parseUnits("1", 6); // 1 USDC

      await expect(
        settlement.connect(payer).settlePayment(payee.address, amount, "signal"),
      ).to.emit(settlement, "PaymentSettled");

      expect(await settlement.paymentCount()).to.equal(1);
    });

    it("transfers USDC from payer to payee", async () => {
      const { usdc, settlement, payer, payee } =
        await loadFixture(deployFixture);

      const amount = ethers.parseUnits("5", 6);
      const payeeBefore = await usdc.balanceOf(payee.address);

      await settlement
        .connect(payer)
        .settlePayment(payee.address, amount, "risk_assessment");

      const payeeAfter = await usdc.balanceOf(payee.address);
      expect(payeeAfter - payeeBefore).to.equal(amount);
    });

    it("rejects zero amount", async () => {
      const { settlement, payer, payee } = await loadFixture(deployFixture);

      await expect(
        settlement.connect(payer).settlePayment(payee.address, 0, "signal"),
      ).to.be.revertedWith("Amount must be positive");
    });

    it("rejects zero address recipient", async () => {
      const { settlement, payer } = await loadFixture(deployFixture);

      await expect(
        settlement
          .connect(payer)
          .settlePayment(ethers.ZeroAddress, 1000, "signal"),
      ).to.be.revertedWith("Invalid recipient");
    });

    it("rejects self-payment", async () => {
      const { settlement, payer } = await loadFixture(deployFixture);

      await expect(
        settlement.connect(payer).settlePayment(payer.address, 1000, "signal"),
      ).to.be.revertedWith("Cannot pay self");
    });

    it("stores payment record", async () => {
      const { settlement, payer, payee } = await loadFixture(deployFixture);

      const amount = ethers.parseUnits("2", 6);
      const tx = await settlement
        .connect(payer)
        .settlePayment(payee.address, amount, "signal");

      const receipt = await tx.wait();

      // Find PaymentSettled event from settlement contract
      const settlementAddr = await settlement.getAddress();
      const eventLog = receipt?.logs.find(
        (log) => log.address.toLowerCase() === settlementAddr.toLowerCase() && log.topics.length === 4,
      );
      expect(eventLog).to.not.be.undefined;

      const paymentId = eventLog!.topics[1];

      const payment = await settlement.getPayment(paymentId);
      expect(payment.from).to.equal(payer.address);
      expect(payment.to).to.equal(payee.address);
      expect(payment.amount).to.equal(amount);
      expect(payment.serviceType).to.equal("signal");
    });
  });

  describe("batchSettle", () => {
    it("settles multiple payments in one transaction", async () => {
      const { settlement, payer, payee, other } =
        await loadFixture(deployFixture);

      const amounts = [
        ethers.parseUnits("1", 6),
        ethers.parseUnits("2", 6),
      ];

      await expect(
        settlement
          .connect(payer)
          .batchSettle(
            [payee.address, other.address],
            amounts,
            ["signal", "risk"],
          ),
      ).to.emit(settlement, "BatchSettled");

      expect(await settlement.paymentCount()).to.equal(2);
    });

    it("rejects array length mismatch", async () => {
      const { settlement, payer, payee } = await loadFixture(deployFixture);

      await expect(
        settlement.connect(payer).batchSettle([payee.address], [1000, 2000], ["a"]),
      ).to.be.revertedWith("Array length mismatch");
    });

    it("rejects empty batch", async () => {
      const { settlement, payer } = await loadFixture(deployFixture);

      await expect(
        settlement.connect(payer).batchSettle([], [], []),
      ).to.be.revertedWith("Empty batch");
    });
  });

  describe("getRecentPayments", () => {
    it("returns paginated payment IDs", async () => {
      const { settlement, payer, payee } = await loadFixture(deployFixture);

      const amount = ethers.parseUnits("1", 6);
      await settlement
        .connect(payer)
        .settlePayment(payee.address, amount, "s1");
      await settlement
        .connect(payer)
        .settlePayment(payee.address, amount, "s2");
      await settlement
        .connect(payer)
        .settlePayment(payee.address, amount, "s3");

      const page1 = await settlement.getRecentPayments(0, 2);
      expect(page1).to.have.length(2);

      const page2 = await settlement.getRecentPayments(2, 2);
      expect(page2).to.have.length(1);
    });

    it("returns empty for offset beyond range", async () => {
      const { settlement } = await loadFixture(deployFixture);

      const result = await settlement.getRecentPayments(100, 10);
      expect(result).to.have.length(0);
    });
  });
});
