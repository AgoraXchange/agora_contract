const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ABBetting - Enhanced Version", function () {
  let betting;
  let owner, oracle, bettor1, bettor2, bettor3, feeRecipient;
  
  beforeEach(async function () {
    [owner, oracle, bettor1, bettor2, bettor3, feeRecipient] = await ethers.getSigners();
    
    const ABBetting = await ethers.getContractFactory("ABBetting");
    betting = await ABBetting.deploy(oracle.address);
    await betting.waitForDeployment();
  });
  
  describe("Contract Creation with Enhanced Features", function () {
    it("Should create a contract with bet limits", async function () {
      const minBet = ethers.parseEther("0.1");
      const maxBet = ethers.parseEther("10");
      
      await betting.createContract(
        "Team A",
        "Team B",
        10, // 10 minutes
        15, // 15% party reward
        minBet,
        maxBet
      );
      
      const contractInfo = await betting.getContractBetting(0);
      expect(contractInfo.minBetAmount).to.equal(minBet);
      expect(contractInfo.maxBetAmount).to.equal(maxBet);
    });
    
    it("Should track platform statistics", async function () {
      await betting.createContract("Team A", "Team B", 10, 15, 0, 0);
      
      const stats = await betting.getPlatformStats();
      expect(stats.totalContracts).to.equal(1);
    });
  });
  
  describe("Commit-Reveal Betting Pattern", function () {
    let contractId;
    let commitHash;
    const nonce = 12345;
    const betAmount = ethers.parseEther("1.0");
    
    beforeEach(async function () {
      const tx = await betting.createContract(
        "Team A",
        "Team B",
        5, // 5 minutes betting period
        10, // 10% party reward
        ethers.parseEther("0.1"), // min bet
        ethers.parseEther("10") // max bet
      );
      await tx.wait();
      contractId = 0;
      
      // Generate commit hash
      commitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        1, // Choice.A
        nonce,
        betAmount
      );
    });
    
    it("Should commit and reveal bet correctly", async function () {
      // Commit phase
      await expect(betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount }))
        .to.emit(betting, "BetCommitted")
        .withArgs(contractId, bettor1.address, commitHash, betAmount);
      
      // Wait for betting period to end
      await time.increase(6 * 60);
      
      // Reveal phase
      await expect(betting.connect(bettor1).revealBet(contractId, 1, nonce))
        .to.emit(betting, "BetRevealed")
        .withArgs(contractId, bettor1.address, 1, betAmount);
      
      const contractInfo = await betting.getContractBetting(contractId);
      expect(contractInfo.totalPoolA).to.equal(betAmount);
    });
    
    it("Should reject bet below minimum", async function () {
      const lowBet = ethers.parseEther("0.05");
      const lowCommitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        1,
        nonce,
        lowBet
      );
      
      await expect(betting.connect(bettor1).commitBet(contractId, lowCommitHash, { value: lowBet }))
        .to.be.revertedWith("Bet below minimum");
    });
    
    it("Should reject bet above maximum", async function () {
      const highBet = ethers.parseEther("11");
      const highCommitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        1,
        nonce,
        highBet
      );
      
      await expect(betting.connect(bettor1).commitBet(contractId, highCommitHash, { value: highBet }))
        .to.be.revertedWith("Bet above maximum");
    });
  });
  
  describe("Bet Cancellation", function () {
    let contractId;
    let commitHash;
    const nonce = 12345;
    const betAmount = ethers.parseEther("1.0");
    
    beforeEach(async function () {
      const tx = await betting.createContract("Team A", "Team B", 60, 10, 0, 0); // 60 minutes
      await tx.wait();
      contractId = 0;
      
      commitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        1,
        nonce,
        betAmount
      );
      
      await betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount });
    });
    
    it("Should allow bet cancellation before deadline", async function () {
      const balanceBefore = await ethers.provider.getBalance(bettor1.address);
      
      await expect(betting.connect(bettor1).cancelBet(contractId))
        .to.emit(betting, "BetCancelled")
        .withArgs(contractId, bettor1.address, betAmount);
      
      const balanceAfter = await ethers.provider.getBalance(bettor1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(betAmount, ethers.parseEther("0.01"));
    });
    
    it("Should reject cancellation after deadline", async function () {
      await time.increase(31 * 60); // 31 minutes
      
      await expect(betting.connect(bettor1).cancelBet(contractId))
        .to.be.revertedWith("Cancellation deadline passed");
    });
  });
  
  describe("Platform Fee System", function () {
    let contractId;
    
    beforeEach(async function () {
      await betting.setFeeRecipient(feeRecipient.address);
      
      const tx = await betting.createContract("Team A", "Team B", 1, 10, 0, 0);
      await tx.wait();
      contractId = 0;
      
      // Commit and reveal bets
      const nonce1 = 111;
      const nonce2 = 222;
      const bet1 = ethers.parseEther("2");
      const bet2 = ethers.parseEther("1");
      
      const hash1 = await betting.generateCommitHash(contractId, bettor1.address, 1, nonce1, bet1);
      const hash2 = await betting.generateCommitHash(contractId, bettor2.address, 2, nonce2, bet2);
      
      await betting.connect(bettor1).commitBet(contractId, hash1, { value: bet1 });
      await betting.connect(bettor2).commitBet(contractId, hash2, { value: bet2 });
      
      await time.increase(2 * 60);
      
      await betting.connect(bettor1).revealBet(contractId, 1, nonce1);
      await betting.connect(bettor2).revealBet(contractId, 2, nonce2);
    });
    
    it("Should collect platform fees on distribution", async function () {
      await time.increase(2 * 60);
      await betting.closeBetting(contractId);
      await betting.connect(oracle).declareWinner(contractId, 1); // Team A wins
      
      const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      
      await betting.distributeRewards(contractId);
      
      const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      const platformFee = ethers.parseEther("0.02"); // 2% of loser pool (1 ETH)
      
      expect(feeBalanceAfter - feeBalanceBefore).to.equal(platformFee);
      
      const stats = await betting.getPlatformStats();
      expect(stats.totalFeesCollected).to.equal(platformFee);
    });
  });
  
  describe("Pausable Functionality", function () {
    it("Should pause and unpause contract operations", async function () {
      await betting.pause();
      
      await expect(betting.createContract("Team A", "Team B", 10, 10, 0, 0))
        .to.be.revertedWith("Pausable: paused");
      
      await betting.unpause();
      
      await expect(betting.createContract("Team A", "Team B", 10, 10, 0, 0))
        .to.not.be.reverted;
    });
  });
  
  describe("Contract Statistics", function () {
    let contractId;
    
    beforeEach(async function () {
      const tx = await betting.createContract("Team A", "Team B", 1, 10, 0, 0);
      await tx.wait();
      contractId = 0;
      
      // Multiple bets
      const bets = [
        { bettor: bettor1, choice: 1, amount: ethers.parseEther("2"), nonce: 100 },
        { bettor: bettor2, choice: 1, amount: ethers.parseEther("1"), nonce: 200 },
        { bettor: bettor3, choice: 2, amount: ethers.parseEther("1.5"), nonce: 300 }
      ];
      
      // Commit all bets
      for (const bet of bets) {
        const hash = await betting.generateCommitHash(
          contractId,
          bet.bettor.address,
          bet.choice,
          bet.nonce,
          bet.amount
        );
        await betting.connect(bet.bettor).commitBet(contractId, hash, { value: bet.amount });
      }
      
      await time.increase(2 * 60);
      
      // Reveal all bets
      for (const bet of bets) {
        await betting.connect(bet.bettor).revealBet(contractId, bet.choice, bet.nonce);
      }
    });
    
    it("Should return correct contract statistics", async function () {
      const stats = await betting.getContractStats(contractId);
      
      expect(stats.totalBets).to.equal(3);
      expect(stats.totalVolume).to.equal(ethers.parseEther("4.5"));
      expect(stats.totalBettorsA).to.equal(2);
      expect(stats.totalBettorsB).to.equal(1);
      expect(stats.averageBetA).to.equal(ethers.parseEther("1.5")); // 3 ETH / 2 bettors
      expect(stats.averageBetB).to.equal(ethers.parseEther("1.5")); // 1.5 ETH / 1 bettor
    });
  });
  
  describe("Contract Cancellation", function () {
    let contractId;
    
    it("Should allow contract cancellation when no bets placed", async function () {
      const tx = await betting.createContract("Team A", "Team B", 1, 10, 0, 0);
      await tx.wait();
      contractId = 0;
      
      await time.increase(2 * 60);
      await betting.closeBetting(contractId);
      
      await expect(betting.cancelContract(contractId))
        .to.emit(betting, "ContractCancelled")
        .withArgs(contractId);
      
      const contractInfo = await betting.getContractBasic(contractId);
      expect(contractInfo.status).to.equal(4); // Cancelled
    });
  });
  
  describe("Admin Functions", function () {
    it("Should update platform fee", async function () {
      await expect(betting.setPlatformFee(5))
        .to.emit(betting, "PlatformFeeUpdated")
        .withArgs(5);
      
      expect(await betting.platformFeePercentage()).to.equal(5);
    });
    
    it("Should update default bet limits", async function () {
      const newMin = ethers.parseEther("0.05");
      const newMax = ethers.parseEther("50");
      
      await expect(betting.setDefaultBetLimits(newMin, newMax))
        .to.emit(betting, "DefaultBetLimitsUpdated")
        .withArgs(newMin, newMax);
      
      expect(await betting.defaultMinBet()).to.equal(newMin);
      expect(await betting.defaultMaxBet()).to.equal(newMax);
    });
    
    it("Should reject high platform fee", async function () {
      await expect(betting.setPlatformFee(11))
        .to.be.revertedWith("Fee too high");
    });
  });
});