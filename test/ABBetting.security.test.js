const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ABBetting with Security Improvements", function () {
  let betting;
  let owner, oracle, bettor1, bettor2, bettor3;
  
  beforeEach(async function () {
    [owner, oracle, bettor1, bettor2, bettor3] = await ethers.getSigners();
    
    const ABBetting = await ethers.getContractFactory("ABBetting");
    betting = await ABBetting.deploy(oracle.address);
    await betting.waitForDeployment();
  });
  
  describe("Contract Creation", function () {
    it("Should create a new contract with correct parameters", async function () {
      const tx = await betting.createContract("Team A", "Team B", 10, 15);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = betting.interface.parseLog(log);
          return parsed.name === "ContractCreated";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
      
      const contractId = 0;
      const contractInfo = await betting.getContract(contractId);
      
      expect(contractInfo.partyA).to.equal("Team A");
      expect(contractInfo.partyB).to.equal("Team B");
      expect(contractInfo.partyRewardPercentage).to.equal(15);
      expect(contractInfo.status).to.equal(0); // Active
    });
  });
  
  describe("Commit-Reveal Betting (Front-running Prevention)", function () {
    let contractId;
    
    beforeEach(async function () {
      const tx = await betting.createContract("Team A", "Team B", 10, 10);
      await tx.wait();
      contractId = 0;
    });
    
    it("Should allow commit and reveal pattern", async function () {
      const betAmount = ethers.parseEther("1.0");
      const choice = 1; // Choice.A
      const nonce = 12345;
      
      // Generate commit hash
      const commitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        choice,
        nonce,
        betAmount
      );
      
      // Commit phase
      await expect(betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount }))
        .to.emit(betting, "BetCommitted")
        .withArgs(contractId, bettor1.address, commitHash, betAmount);
      
      // Fast forward past betting end time
      await time.increase(11 * 60); // 11 minutes
      
      // Reveal phase
      await expect(betting.connect(bettor1).revealBet(contractId, choice, nonce))
        .to.emit(betting, "BetRevealed")
        .withArgs(contractId, bettor1.address, choice, betAmount);
      
      const contractInfo = await betting.getContract(contractId);
      expect(contractInfo.totalPoolA).to.equal(betAmount);
    });
    
    it("Should reject reveal with wrong nonce", async function () {
      const betAmount = ethers.parseEther("1.0");
      const choice = 1; // Choice.A
      const correctNonce = 12345;
      const wrongNonce = 54321;
      
      const commitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        choice,
        correctNonce,
        betAmount
      );
      
      await betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount });
      await time.increase(11 * 60);
      
      await expect(betting.connect(bettor1).revealBet(contractId, choice, wrongNonce))
        .to.be.revertedWith("Invalid reveal");
    });
    
    it("Should allow refund for unrevealed bets", async function () {
      const betAmount = ethers.parseEther("1.0");
      const choice = 1;
      const nonce = 12345;
      
      const commitHash = await betting.generateCommitHash(
        contractId,
        bettor1.address,
        choice,
        nonce,
        betAmount
      );
      
      await betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount });
      
      // Wait for reveal period to end (1 hour after betting ends)
      await time.increase(11 * 60 + 61 * 60); // 11 minutes + 61 minutes
      
      const balanceBefore = await ethers.provider.getBalance(bettor1.address);
      await betting.connect(bettor1).refundUnrevealedBet(contractId);
      const balanceAfter = await ethers.provider.getBalance(bettor1.address);
      
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
  
  describe("Pagination (DoS Prevention)", function () {
    let contractId;
    
    beforeEach(async function () {
      const tx = await betting.createContract("Team A", "Team B", 10, 10);
      await tx.wait();
      contractId = 0;
    });
    
    it("Should return paginated results for user bets", async function () {
      // Create multiple bets
      const betAmount = ethers.parseEther("0.1");
      const nonce = 1000;
      
      // Make 5 bets
      for (let i = 0; i < 5; i++) {
        const choice = (i % 2) + 1; // Alternate between A and B
        const commitHash = await betting.generateCommitHash(
          contractId,
          bettor1.address,
          choice,
          nonce + i,
          betAmount
        );
        
        await betting.connect(bettor1).commitBet(contractId, commitHash, { value: betAmount });
      }
      
      // Reveal all bets
      await time.increase(11 * 60);
      for (let i = 0; i < 5; i++) {
        const choice = (i % 2) + 1;
        await betting.connect(bettor1).revealBet(contractId, choice, nonce + i);
      }
      
      // Test pagination
      const result1 = await betting.getUserBetsPaginated(contractId, bettor1.address, 0, 3);
      expect(result1.amounts.length).to.equal(3);
      expect(result1.totalBets).to.equal(5);
      
      const result2 = await betting.getUserBetsPaginated(contractId, bettor1.address, 3, 3);
      expect(result2.amounts.length).to.equal(2); // Only 2 remaining
      expect(result2.totalBets).to.equal(5);
    });
    
    it("Should limit results per page", async function () {
      // Request more than MAX_BETS_PER_PAGE
      const result = await betting.getUserBetsPaginated(contractId, bettor1.address, 0, 200);
      expect(result.amounts.length).to.equal(0); // No bets yet
      expect(result.totalBets).to.equal(0);
    });
  });
  
  describe("End-to-End Flow with Security Features", function () {
    it("Should complete full betting cycle with commit-reveal", async function () {
      // Create contract
      const tx = await betting.createContract("Team A", "Team B", 1, 10);
      await tx.wait();
      const contractId = 0;
      
      // Commit phase
      const betAmount1 = ethers.parseEther("2.0");
      const betAmount2 = ethers.parseEther("1.0");
      const betAmount3 = ethers.parseEther("1.0");
      
      const commitHash1 = await betting.generateCommitHash(contractId, bettor1.address, 1, 111, betAmount1);
      const commitHash2 = await betting.generateCommitHash(contractId, bettor2.address, 1, 222, betAmount2);
      const commitHash3 = await betting.generateCommitHash(contractId, bettor3.address, 2, 333, betAmount3);
      
      await betting.connect(bettor1).commitBet(contractId, commitHash1, { value: betAmount1 });
      await betting.connect(bettor2).commitBet(contractId, commitHash2, { value: betAmount2 });
      await betting.connect(bettor3).commitBet(contractId, commitHash3, { value: betAmount3 });
      
      // Wait for betting to end
      await time.increase(2 * 60);
      
      // Reveal phase
      await betting.connect(bettor1).revealBet(contractId, 1, 111);
      await betting.connect(bettor2).revealBet(contractId, 1, 222);
      await betting.connect(bettor3).revealBet(contractId, 2, 333);
      
      // Close betting
      await time.increase(61 * 60); // Wait for reveal period to end
      await betting.closeBetting(contractId);
      
      // Declare winner
      await betting.connect(oracle).declareWinner(contractId, 1); // Team A wins
      
      // Distribute rewards
      await betting.distributeRewards(contractId);
      
      // Claim rewards
      const bettor1BalanceBefore = await ethers.provider.getBalance(bettor1.address);
      await betting.connect(bettor1).claimReward(contractId);
      const bettor1BalanceAfter = await ethers.provider.getBalance(bettor1.address);
      
      // Bettor1 should receive more than their initial bet
      expect(bettor1BalanceAfter - bettor1BalanceBefore).to.be.gt(ethers.parseEther("1.9")); // Account for gas
    });
  });
});