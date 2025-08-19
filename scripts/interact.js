const hre = require("hardhat");

async function main() {
  // 배포된 컨트랙트 주소 (deploy.js 실행 후 나온 주소로 변경)
  const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
  
  const ABBetting = await hre.ethers.getContractFactory("ABBetting");
  const betting = ABBetting.attach(CONTRACT_ADDRESS);
  
  const [creator, oracle, bettor1, bettor2] = await hre.ethers.getSigners();
  
  console.log("=== ABBetting Enhanced Version 상호작용 시나리오 ===\n");
  
  // 1. 계약 생성
  console.log("1. 계약 생성 중...");
  const minBet = hre.ethers.parseEther("0.1");
  const maxBet = hre.ethers.parseEther("5");
  
  const tx1 = await betting.connect(creator).createContract(
    "Team Alpha",   // 당사자 A
    "Team Beta",    // 당사자 B
    5,              // 베팅 기간: 5분
    10,             // 당사자 보상: 10%
    minBet,         // 최소 베팅: 0.1 ETH
    maxBet          // 최대 베팅: 5 ETH
  );
  const receipt1 = await tx1.wait();
  
  // 이벤트에서 contractId 추출
  const event = receipt1.logs.find(log => {
    try {
      const parsed = betting.interface.parseLog(log);
      return parsed.name === "ContractCreated";
    } catch {
      return false;
    }
  });
  
  const contractId = event ? betting.interface.parseLog(event).args.contractId : 0;
  console.log("계약 생성 완료! Contract ID:", contractId.toString());
  
  // 2. 계약 정보 조회
  const contractBasic = await betting.getContractBasic(contractId);
  const contractBetting = await betting.getContractBetting(contractId);
  console.log("\n2. 계약 정보:");
  console.log("- 당사자 A:", contractBasic.partyA);
  console.log("- 당사자 B:", contractBasic.partyB);
  console.log("- 베팅 종료 시간:", new Date(Number(contractBasic.bettingEndTime) * 1000).toLocaleString());
  console.log("- Reveal 종료 시간:", new Date(Number(contractBasic.revealEndTime) * 1000).toLocaleString());
  console.log("- 최소 베팅:", hre.ethers.formatEther(contractBetting.minBetAmount), "ETH");
  console.log("- 최대 베팅:", hre.ethers.formatEther(contractBetting.maxBetAmount), "ETH");
  console.log("- 당사자 보상 비율:", contractBetting.partyRewardPercentage.toString() + "%");
  
  // 3. Commit-Reveal 베팅
  console.log("\n3. Commit-Reveal 베팅 진행 중...");
  
  // Bettor1: Team A에 0.5 ETH 베팅 (Commit)
  const nonce1 = Math.floor(Math.random() * 1000000);
  const betAmount1 = hre.ethers.parseEther("0.5");
  const commitHash1 = await betting.generateCommitHash(contractId, bettor1.address, 1, nonce1, betAmount1);
  
  await betting.connect(bettor1).commitBet(contractId, commitHash1, { value: betAmount1 });
  console.log("- Bettor1이 Team Alpha에 0.5 ETH 커밋 (nonce:", nonce1, ")");
  
  // Bettor2: Team B에 0.3 ETH 베팅 (Commit)
  const nonce2 = Math.floor(Math.random() * 1000000);
  const betAmount2 = hre.ethers.parseEther("0.3");
  const commitHash2 = await betting.generateCommitHash(contractId, bettor2.address, 2, nonce2, betAmount2);
  
  await betting.connect(bettor2).commitBet(contractId, commitHash2, { value: betAmount2 });
  console.log("- Bettor2가 Team Beta에 0.3 ETH 커밋 (nonce:", nonce2, ")");
  
  // 4. 플랫폼 통계 확인
  const platformStats = await betting.getPlatformStats();
  console.log("\n4. 플랫폼 통계:");
  console.log("- 총 계약 수:", platformStats.totalContracts.toString());
  console.log("- 총 베팅 수:", platformStats.totalBets.toString());
  console.log("- 총 거래량:", hre.ethers.formatEther(platformStats.totalVolume), "ETH");
  
  console.log("\n=== 다음 단계 ===");
  console.log("1. 베팅 기간이 끝나면 베팅 공개 (revealBet)");
  console.log(`   await betting.connect(bettor1).revealBet(${contractId}, 1, ${nonce1})`);
  console.log(`   await betting.connect(bettor2).revealBet(${contractId}, 2, ${nonce2})`);
  console.log("2. Reveal 기간이 끝나면 closeBetting() 호출");
  console.log("3. 오라클이 declareWinner() 호출하여 승자 결정");
  console.log("4. distributeRewards() 호출하여 보상 분배");
  console.log("5. 베팅자들이 claimReward() 호출하여 보상 수령");
  
  console.log("\n=== 베팅 취소 옵션 ===");
  console.log("베팅 종료 30분 전까지 cancelBet() 호출로 베팅 취소 가능");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });