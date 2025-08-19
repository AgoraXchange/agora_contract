const hre = require("hardhat");

async function main() {
  console.log("Deploying ABBetting contract...");

  // 배포자와 오라클 주소 가져오기
  const [deployer, oracle] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Oracle address:", oracle.address);

  const ABBetting = await hre.ethers.getContractFactory("ABBetting");
  // 오라클 주소를 생성자 파라미터로 전달
  const betting = await ABBetting.deploy(oracle.address);

  await betting.waitForDeployment();

  const address = await betting.getAddress();
  console.log("ABBetting deployed to:", address);
  
  // 배포된 컨트랙트의 소유자 확인
  const owner = await betting.owner();
  console.log("Contract owner:", owner);
  
  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", address);
  console.log("Oracle Address:", oracle.address);
  console.log("Owner Address:", owner);
  console.log("=========================\n");
  
  console.log("Key features:");
  console.log("- Min bet amount:", hre.ethers.formatEther(await betting.MIN_BET_AMOUNT()), "ETH");
  console.log("- Max bet amount:", hre.ethers.formatEther(await betting.MAX_BET_AMOUNT()), "ETH");
  console.log("- Max party reward percentage:", (await betting.MAX_PARTY_REWARD_PERCENTAGE()).toString() + "%");
  console.log("- Pausable: Yes");
  console.log("- Emergency refund: Disabled by default");
  console.log("- Draw support: Yes");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });