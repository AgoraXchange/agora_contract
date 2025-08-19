const hre = require("hardhat");

async function main() {
  // 배포된 컨트랙트 주소 (deploy.js 실행 후 나온 주소로 변경)
  const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";
  
  const ABBetting = await hre.ethers.getContractFactory("ABBetting");
  const betting = ABBetting.attach(CONTRACT_ADDRESS);
  
  const [creator, oracle, bettor1, bettor2] = await hre.ethers.getSigners();
  
  console.log("=== ABBetting 보안 강화 버전 상호작용 시나리오 ===\n");
  
  // 1. 계약 생성
  console.log("1. 계약 생성 중...");
  const tx1 = await betting.connect(creator).createContract(
    "Team Alpha",   // 당사자 A
    "Team Beta",    // 당사자 B
    5,              // 베팅 기간: 5분
    10              // 당사자 보상: 10%
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
  const contractInfo = await betting.getContract(contractId);
  console.log("\n2. 계약 정보:");
  console.log("- 당사자 A:", contractInfo.partyA);
  console.log("- 당사자 B:", contractInfo.partyB);
  console.log("- 베팅 종료 시간:", new Date(Number(contractInfo.bettingEndTime) * 1000).toLocaleString());
  console.log("- 공개 종료 시간:", new Date(Number(contractInfo.revealEndTime) * 1000).toLocaleString());
  console.log("- 당사자 보상 비율:", contractInfo.partyRewardPercentage.toString() + "%");
  
  // 3. Commit 단계 - 베팅 커밋
  console.log("\n3. Commit 단계 - 베팅 정보 숨기기...");
  
  // Bettor1: Team A에 0.5 ETH 베팅 (숨김)
  const betAmount1 = hre.ethers.parseEther("0.5");
  const choice1 = 1; // Choice.A
  const nonce1 = Math.floor(Math.random() * 1000000); // 랜덤 nonce
  
  const commitHash1 = await betting.generateCommitHash(
    contractId,
    bettor1.address,
    choice1,
    nonce1,
    betAmount1
  );
  
  await betting.connect(bettor1).commitBet(contractId, commitHash1, { value: betAmount1 });
  console.log("- Bettor1이 0.5 ETH 베팅 커밋 (선택 숨김)");
  console.log("  Nonce:", nonce1, "(이 값을 저장해야 나중에 공개 가능)");
  
  // Bettor2: Team B에 0.3 ETH 베팅 (숨김)
  const betAmount2 = hre.ethers.parseEther("0.3");
  const choice2 = 2; // Choice.B
  const nonce2 = Math.floor(Math.random() * 1000000);
  
  const commitHash2 = await betting.generateCommitHash(
    contractId,
    bettor2.address,
    choice2,
    nonce2,
    betAmount2
  );
  
  await betting.connect(bettor2).commitBet(contractId, commitHash2, { value: betAmount2 });
  console.log("- Bettor2가 0.3 ETH 베팅 커밋 (선택 숨김)");
  console.log("  Nonce:", nonce2);
  
  console.log("\n=== 베팅 기간 종료 대기 중... ===");
  console.log("실제 사용 시에는 베팅 종료 시간까지 기다려야 합니다.");
  
  // 4. Reveal 단계 안내
  console.log("\n4. Reveal 단계 (베팅 종료 후):");
  console.log("베팅 기간이 종료되면 다음 명령어로 베팅을 공개하세요:");
  console.log(`- Bettor1: await betting.connect(bettor1).revealBet(${contractId}, ${choice1}, ${nonce1})`);
  console.log(`- Bettor2: await betting.connect(bettor2).revealBet(${contractId}, ${choice2}, ${nonce2})`);
  
  console.log("\n5. 페이지네이션으로 베팅 조회:");
  console.log("많은 베팅이 있을 때 페이지별로 조회 가능:");
  console.log(`await betting.getUserBetsPaginated(${contractId}, userAddress, offset, limit)`);
  
  console.log("\n=== 전체 프로세스 ===");
  console.log("1. Commit 단계: 베팅 정보를 해시로 숨겨서 제출");
  console.log("2. 베팅 종료 대기");
  console.log("3. Reveal 단계: 실제 베팅 정보 공개 (1시간 이내)");
  console.log("4. closeBetting() 호출하여 베팅 마감");
  console.log("5. 오라클이 declareWinner() 호출하여 승자 결정");
  console.log("6. distributeRewards() 호출하여 보상 분배");
  console.log("7. 베팅자들이 claimReward() 호출하여 보상 수령");
  
  console.log("\n=== 보안 개선사항 ===");
  console.log("- Commit-Reveal 패턴으로 프론트러닝 방지");
  console.log("- 페이지네이션으로 DoS 공격 방지");
  console.log("- ReentrancyGuard로 재진입 공격 방지");
  console.log("- call() 함수 사용으로 안전한 이더 전송");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });