import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
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

// ────────────────────────────────────────────────────────────────────────────
// ConsensusCommit
// ────────────────────────────────────────────────────────────────────────────

describe("ConsensusCommit", () => {
  const WINDOW = 86_400; // 1 day in seconds

  function randomBytes32(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  async function deployFixture() {
    const [owner, submitter, challenger, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ConsensusCommit");
    const contract = await Factory.deploy();
    return { contract, owner, submitter, challenger, other };
  }

  describe("anchor", () => {
    it("anchors a new commit and emits CommitAnchored", async () => {
      const { contract, submitter } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      const commitHash = randomBytes32();

      const tx = await contract.connect(submitter).anchor(roundId, commitHash, WINDOW);
      await expect(tx)
        .to.emit(contract, "CommitAnchored")
        .withArgs(roundId, commitHash, submitter.address, anyValue);

      const rec = await contract.getCommit(roundId);
      expect(rec.commitHash).to.equal(commitHash);
      expect(rec.submitter).to.equal(submitter.address);
      expect(rec.challenged).to.equal(false);
      expect(rec.finalized).to.equal(false);
    });

    it("rejects zero roundId", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.anchor(ethers.ZeroHash, randomBytes32(), WINDOW),
      ).to.be.revertedWith("Invalid roundId");
    });

    it("rejects zero commitHash", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.anchor(randomBytes32(), ethers.ZeroHash, WINDOW),
      ).to.be.revertedWith("Invalid commitHash");
    });

    it("rejects window shorter than MIN_CHALLENGE_WINDOW", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.anchor(randomBytes32(), randomBytes32(), 30),
      ).to.be.revertedWith("Window too short");
    });

    it("rejects duplicate roundId", async () => {
      const { contract } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await expect(
        contract.anchor(roundId, randomBytes32(), WINDOW),
      ).to.be.revertedWith("Round already anchored");
    });

    it("increments roundCount", async () => {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.roundCount()).to.equal(0);
      await contract.anchor(randomBytes32(), randomBytes32(), WINDOW);
      expect(await contract.roundCount()).to.equal(1);
    });
  });

  describe("challenge", () => {
    it("allows a challenge within window and emits ChallengeRaised", async () => {
      const { contract, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);

      await expect(
        contract.connect(challenger).challenge(roundId, "Incorrect claim"),
      )
        .to.emit(contract, "ChallengeRaised")
        .withArgs(roundId, challenger.address, "Incorrect claim");

      const rec = await contract.getCommit(roundId);
      expect(rec.challenged).to.equal(true);
    });

    it("rejects challenge for non-existent round", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.challenge(randomBytes32(), "bad"),
      ).to.be.revertedWith("Round not found");
    });

    it("rejects duplicate challenge", async () => {
      const { contract, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await contract.connect(challenger).challenge(roundId, "first");
      await expect(
        contract.connect(challenger).challenge(roundId, "second"),
      ).to.be.revertedWith("Already challenged");
    });

    it("rejects empty reason", async () => {
      const { contract, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await expect(
        contract.connect(challenger).challenge(roundId, ""),
      ).to.be.revertedWith("Reason required");
    });
  });

  describe("resolveChallenge", () => {
    it("owner can reject challenge (upheld=false), finalizes commit", async () => {
      const { contract, owner, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await contract.connect(challenger).challenge(roundId, "suspect");

      await expect(contract.connect(owner).resolveChallenge(roundId, false))
        .to.emit(contract, "ChallengeResolved")
        .withArgs(roundId, false, owner.address)
        .and.to.emit(contract, "CommitFinalized")
        .withArgs(roundId);

      const rec = await contract.getCommit(roundId);
      expect(rec.finalized).to.equal(true);
      expect(rec.challengeUpheld).to.equal(false);
    });

    it("owner can uphold challenge (upheld=true), does not emit CommitFinalized", async () => {
      const { contract, owner, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await contract.connect(challenger).challenge(roundId, "suspect");

      const tx = await contract.connect(owner).resolveChallenge(roundId, true);
      const receipt = await tx.wait();
      const finalizedTopic = contract.interface.getEvent("CommitFinalized").topicHash;
      const hasFinalizedEvent = receipt?.logs.some((l) => l.topics[0] === finalizedTopic);
      expect(hasFinalizedEvent).to.equal(false);

      const rec = await contract.getCommit(roundId);
      expect(rec.challengeUpheld).to.equal(true);
    });

    it("non-owner cannot resolve", async () => {
      const { contract, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await contract.connect(challenger).challenge(roundId, "suspect");
      await expect(
        contract.connect(challenger).resolveChallenge(roundId, false),
      ).to.be.reverted;
    });
  });

  describe("finalize", () => {
    it("finalizes an unchallenged commit after window expires", async () => {
      const { contract } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      // Use minimum window so we can mine past it
      const minWindow = Number(await contract.MIN_CHALLENGE_WINDOW());
      await contract.anchor(roundId, randomBytes32(), minWindow);

      // Advance time past the window
      await ethers.provider.send("evm_increaseTime", [minWindow + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(contract.finalize(roundId))
        .to.emit(contract, "CommitFinalized")
        .withArgs(roundId);

      const rec = await contract.getCommit(roundId);
      expect(rec.finalized).to.equal(true);
    });

    it("cannot finalize before window expires", async () => {
      const { contract } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      await expect(contract.finalize(roundId)).to.be.revertedWith(
        "Challenge window still open",
      );
    });

    it("cannot finalize a challenged commit directly", async () => {
      const { contract, challenger } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      const minWindow = Number(await contract.MIN_CHALLENGE_WINDOW());
      await contract.anchor(roundId, randomBytes32(), minWindow);
      await contract.connect(challenger).challenge(roundId, "dispute");

      await ethers.provider.send("evm_increaseTime", [minWindow + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(contract.finalize(roundId)).to.be.revertedWith(
        "Pending challenge - use resolveChallenge",
      );
    });
  });

  describe("isChallengeOpen", () => {
    it("returns true within window", async () => {
      const { contract } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      await contract.anchor(roundId, randomBytes32(), WINDOW);
      expect(await contract.isChallengeOpen(roundId)).to.equal(true);
    });

    it("returns false after finalize", async () => {
      const { contract } = await loadFixture(deployFixture);
      const roundId = randomBytes32();
      const minWindow = Number(await contract.MIN_CHALLENGE_WINDOW());
      await contract.anchor(roundId, randomBytes32(), minWindow);
      await ethers.provider.send("evm_increaseTime", [minWindow + 1]);
      await ethers.provider.send("evm_mine", []);
      await contract.finalize(roundId);
      expect(await contract.isChallengeOpen(roundId)).to.equal(false);
    });
  });

  describe("getRoundIds", () => {
    it("returns paginated round IDs", async () => {
      const { contract } = await loadFixture(deployFixture);
      const ids = [randomBytes32(), randomBytes32(), randomBytes32()];
      for (const id of ids) await contract.anchor(id, randomBytes32(), WINDOW);

      const page = await contract.getRoundIds(0, 2);
      expect(page).to.have.length(2);
      expect(page[0]).to.equal(ids[0]);

      const page2 = await contract.getRoundIds(2, 2);
      expect(page2).to.have.length(1);
    });

    it("returns empty for offset beyond range", async () => {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getRoundIds(100, 10)).to.have.length(0);
    });
  });
});

// ─── SwarmCommit ──────────────────────────────────────────────────────────────

describe("SwarmCommit", () => {
  async function deployFixture() {
    const [committer, other] = await ethers.getSigners();
    const SwarmCommit = await ethers.getContractFactory("SwarmCommit");
    const swarmCommit = await SwarmCommit.deploy();
    return { swarmCommit, committer, other };
  }

  const DECISION_HASH = ethers.encodeBytes32String("decision-hash-1");
  const EVIDENCE_ROOT = ethers.encodeBytes32String("evidence-root-1");
  const DOMAIN_ID = 0n; // liquidation_risk

  describe("commitDecision", () => {
    it("commits a new decision and emits DecisionCommitted", async () => {
      const { swarmCommit, committer } = await loadFixture(deployFixture);

      await expect(
        swarmCommit.connect(committer).commitDecision(DECISION_HASH, EVIDENCE_ROOT, DOMAIN_ID),
      )
        .to.emit(swarmCommit, "DecisionCommitted")
        .withArgs(DECISION_HASH, EVIDENCE_ROOT, DOMAIN_ID, committer.address, anyValue);

      expect(await swarmCommit.committed(DECISION_HASH)).to.be.true;
    });

    it("rejects zero decisionHash", async () => {
      const { swarmCommit, committer } = await loadFixture(deployFixture);

      await expect(
        swarmCommit
          .connect(committer)
          .commitDecision(ethers.ZeroHash, EVIDENCE_ROOT, DOMAIN_ID),
      ).to.be.revertedWith("SwarmCommit: zero decisionHash");
    });

    it("rejects duplicate commitments", async () => {
      const { swarmCommit, committer } = await loadFixture(deployFixture);

      await swarmCommit
        .connect(committer)
        .commitDecision(DECISION_HASH, EVIDENCE_ROOT, DOMAIN_ID);

      await expect(
        swarmCommit
          .connect(committer)
          .commitDecision(DECISION_HASH, EVIDENCE_ROOT, DOMAIN_ID),
      ).to.be.revertedWith("SwarmCommit: already committed");
    });

    it("allows different hashes to be committed independently", async () => {
      const { swarmCommit, committer } = await loadFixture(deployFixture);
      const hash2 = ethers.encodeBytes32String("decision-hash-2");

      await swarmCommit
        .connect(committer)
        .commitDecision(DECISION_HASH, EVIDENCE_ROOT, DOMAIN_ID);
      await swarmCommit.connect(committer).commitDecision(hash2, EVIDENCE_ROOT, DOMAIN_ID);

      expect(await swarmCommit.committed(DECISION_HASH)).to.be.true;
      expect(await swarmCommit.committed(hash2)).to.be.true;
    });

    it("returns false for uncommitted hash", async () => {
      const { swarmCommit } = await loadFixture(deployFixture);
      expect(await swarmCommit.committed(DECISION_HASH)).to.be.false;
    });
  });
});

// ─── SwarmChallenge ───────────────────────────────────────────────────────────

describe("SwarmChallenge", () => {
  async function deployFixture() {
    const [owner, challenger, other] = await ethers.getSigners();
    const SwarmChallenge = await ethers.getContractFactory("SwarmChallenge");
    const swarmChallenge = await SwarmChallenge.deploy();
    return { swarmChallenge, owner, challenger, other };
  }

  const DECISION_HASH = ethers.encodeBytes32String("sc-decision-1");

  async function deployWithRegisteredCommit() {
    const ctx = await deployFixture();
    await ctx.swarmChallenge.connect(ctx.owner).registerCommit(DECISION_HASH);
    return ctx;
  }

  describe("registerCommit", () => {
    it("records the commit timestamp", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployFixture);
      await swarmChallenge.connect(owner).registerCommit(DECISION_HASH);
      const ts = await swarmChallenge.commitTime(DECISION_HASH);
      expect(ts).to.be.greaterThan(0n);
    });

    it("does not overwrite an existing commit timestamp", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployFixture);
      await swarmChallenge.connect(owner).registerCommit(DECISION_HASH);
      const ts1 = await swarmChallenge.commitTime(DECISION_HASH);
      await swarmChallenge.connect(owner).registerCommit(DECISION_HASH);
      const ts2 = await swarmChallenge.commitTime(DECISION_HASH);
      expect(ts1).to.equal(ts2);
    });
  });

  describe("openChallenge", () => {
    it("opens a challenge and emits ChallengeOpened", async () => {
      const { swarmChallenge, challenger } = await loadFixture(deployWithRegisteredCommit);

      await expect(swarmChallenge.connect(challenger).openChallenge(DECISION_HASH))
        .to.emit(swarmChallenge, "ChallengeOpened")
        .withArgs(0n, DECISION_HASH, challenger.address);

      expect(await swarmChallenge.nextId()).to.equal(1n);
    });

    it("increments challenge ID for each new challenge", async () => {
      const { swarmChallenge, challenger, other } =
        await loadFixture(deployWithRegisteredCommit);

      await swarmChallenge.connect(challenger).openChallenge(DECISION_HASH);
      await swarmChallenge.connect(other).openChallenge(DECISION_HASH);

      expect(await swarmChallenge.nextId()).to.equal(2n);
    });

    it("rejects challenge on unknown decision", async () => {
      const { swarmChallenge, challenger } = await loadFixture(deployFixture);
      const unknown = ethers.encodeBytes32String("unknown-decision");

      await expect(
        swarmChallenge.connect(challenger).openChallenge(unknown),
      ).to.be.revertedWith("SwarmChallenge: unknown decision");
    });

    it("rejects challenge after window has passed", async () => {
      const { swarmChallenge, challenger } = await loadFixture(deployWithRegisteredCommit);
      const { time } = await import("@nomicfoundation/hardhat-toolbox/network-helpers");

      // Fast-forward past the 1-day challenge window
      await time.increase(2 * 24 * 60 * 60);

      await expect(
        swarmChallenge.connect(challenger).openChallenge(DECISION_HASH),
      ).to.be.revertedWith("SwarmChallenge: challenge window passed");
    });
  });

  describe("resolveChallenge", () => {
    async function deployWithOpenChallenge() {
      const ctx = await deployWithRegisteredCommit();
      await ctx.swarmChallenge.connect(ctx.challenger).openChallenge(DECISION_HASH);
      return ctx;
    }

    it("resolves a challenge as successful", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployWithOpenChallenge);

      await expect(swarmChallenge.connect(owner).resolveChallenge(0n, true))
        .to.emit(swarmChallenge, "ChallengeResolved")
        .withArgs(0n, true);

      const c = await swarmChallenge.challenges(0n);
      expect(c.resolved).to.be.true;
      expect(c.successful).to.be.true;
    });

    it("resolves a challenge as unsuccessful", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployWithOpenChallenge);

      await swarmChallenge.connect(owner).resolveChallenge(0n, false);
      const c = await swarmChallenge.challenges(0n);
      expect(c.successful).to.be.false;
    });

    it("rejects double resolution", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployWithOpenChallenge);

      await swarmChallenge.connect(owner).resolveChallenge(0n, true);
      await expect(
        swarmChallenge.connect(owner).resolveChallenge(0n, false),
      ).to.be.revertedWith("SwarmChallenge: already resolved");
    });

    it("rejects resolution of non-existent challenge", async () => {
      const { swarmChallenge, owner } = await loadFixture(deployFixture);
      await expect(
        swarmChallenge.connect(owner).resolveChallenge(99n, true),
      ).to.be.revertedWith("SwarmChallenge: challenge not found");
    });

    it("rejects resolution from non-owner", async () => {
      const { swarmChallenge, challenger } = await loadFixture(deployWithOpenChallenge);
      await expect(
        swarmChallenge.connect(challenger).resolveChallenge(0n, true),
      ).to.be.revertedWith("SwarmChallenge: caller is not owner");
    });
  });
});

