# Foundry를 이용한 Base Sepolia 배포 및 검증 완전 가이드

## 📋 목차
1. [환경 설정](#환경-설정)
2. [Foundry 프로젝트 설정](#foundry-프로젝트-설정)
3. [배포 스크립트 작성](#배포-스크립트-작성)
4. [배포 및 검증](#배포-및-검증)
5. [주의사항 및 팁](#주의사항-및-팁)
6. [ABI 사용법](#abi-사용법)
7. [트러블슈팅](#트러블슈팅)

## 🛠️ 환경 설정

### 1. Foundry 설치
```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash

# 새 터미널 세션 시작하거나 PATH 로드
source ~/.zshenv

# Foundry 도구 설치
foundryup
```

### 2. 필수 환경 변수 (.env)
```env
# 배포에 사용할 계정의 Private Key (0x 접두사 없이)
PRIVATE_KEY=your_private_key_here

# Base Sepolia RPC URL
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Basescan API Key (검증용)
ETHERSCAN_API_KEY=your_basescan_api_key_here
```

## ⚙️ Foundry 프로젝트 설정

### 1. 프로젝트 초기화
```bash
# 현재 디렉토리에 Foundry 프로젝트 초기화
forge init --force

# OpenZeppelin Contracts 설치
forge install OpenZeppelin/openzeppelin-contracts@v5.4.0
```

### 2. foundry.toml 설정
```toml
[profile.default]
src = "contracts"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = true                    # Stack too deep 에러 해결
evm_version = "paris"

remappings = [
    "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
    "forge-std/=lib/forge-std/src/"
]

[etherscan]
base_sepolia = { key = "${ETHERSCAN_API_KEY}" }

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
```

## 📝 배포 스크립트 작성

### script/Deploy.s.sol 생성
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ABBetting.sol";

contract DeployScript is Script {
    function run() external returns (ABBetting) {
        address deployer = msg.sender;
        
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast();
        
        // Deploy with deployer as oracle
        ABBetting betting = new ABBetting(deployer);
        
        vm.stopBroadcast();
        
        console.log("ABBetting deployed at:", address(betting));
        console.log("Oracle address:", deployer);
        
        return betting;
    }
}
```

## 🚀 배포 및 검증

### 1. 컴파일
```bash
# 환경 변수 로드를 위해 PATH 설정
export PATH="$HOME/.foundry/bin:$PATH"

# 컴파일
forge build
```

### 2. 배포 (자동 검증 포함)
```bash
# .env 파일 로드 후 배포 및 검증
source .env && forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --private-key 0x${PRIVATE_KEY}
```

### 성공 시 출력 예시
```
Contract successfully verified
All (1) contracts were verified!

== Return ==
0: contract ABBetting 0x09a42120753E1773820C7195b4EF8deB58ebeFa2

== Logs ==
  ABBetting deployed at: 0x09a42120753E1773820C7195b4EF8deB58ebeFa2
  Oracle address: 0xDbE0e7090C563898691eEF3566b82980D9064d6B
```

## ⚠️ 주의사항 및 팁

### 1. 필수 주의사항
- ❗ **Private Key 보안**: `.env` 파일을 `.gitignore`에 추가하고 절대 Git에 커밋하지 마세요
- ❗ **테스트넷 사용**: 실제 메인넷을 사용하지 마세요
- ❗ **가스비 준비**: Base Sepolia ETH가 충분히 있는지 확인하세요

### 2. 환경 설정 팁
```bash
# .gitignore에 추가할 항목들
.env
broadcast/
cache/
out/
node_modules/
```

### 3. 디버깅을 위한 명령어
```bash
# 컴파일만 실행
forge build

# 건식 실행 (실제 배포 안 함)
forge script script/Deploy.s.sol --rpc-url base_sepolia

# 상세한 가스 정보와 함께 실행
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --private-key 0x${PRIVATE_KEY} -vvvv
```

## 📁 ABI 사용법

### 1. ABI 파일 추출
```bash
# ABI 파일 생성
cat out/ABBetting.sol/ABBetting.json | jq '.abi' > ABBetting_ABI.json
```

### 2. JavaScript/TypeScript에서 ABI 사용

#### ethers.js v6 사용 예시
```javascript
import { ethers } from 'ethers';
import ABBettingABI from './ABBetting_ABI.json';

// Provider 설정
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

// 컨트랙트 인스턴스 생성
const contractAddress = '0x09a42120753E1773820C7195b4EF8deB58ebeFa2';
const contract = new ethers.Contract(contractAddress, ABBettingABI, provider);

// 읽기 함수 호출 예시
async function getContractInfo() {
  const owner = await contract.owner();
  const oracle = await contract.oracle();
  const stats = await contract.getPlatformStats();
  
  console.log('Owner:', owner);
  console.log('Oracle:', oracle);
  console.log('Platform Stats:', stats);
}

// 쓰기 함수 호출 예시 (지갑 연결 필요)
async function createContract(signer) {
  const contractWithSigner = contract.connect(signer);
  
  const tx = await contractWithSigner.createContract(
    "Team A",           // partyA
    "Team B",           // partyB
    60,                 // bettingDurationInMinutes
    5,                  // partyRewardPercentage (5%)
    ethers.parseEther("0.01"), // minBetAmount
    ethers.parseEther("1.0")   // maxBetAmount
  );
  
  await tx.wait();
  console.log('Contract created:', tx.hash);
}
```

#### Web3.js 사용 예시
```javascript
import Web3 from 'web3';
import ABBettingABI from './ABBetting_ABI.json';

const web3 = new Web3('https://sepolia.base.org');
const contractAddress = '0x09a42120753E1773820C7195b4EF8deB58ebeFa2';
const contract = new web3.eth.Contract(ABBettingABI, contractAddress);

// 컨트랙트 정보 조회
const owner = await contract.methods.owner().call();
console.log('Owner:', owner);
```

### 3. React 앱에서 사용 예시
```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ABBettingABI from './ABBetting_ABI.json';

const CONTRACT_ADDRESS = '0x09a42120753E1773820C7195b4EF8deB58ebeFa2';

function ABBettingApp() {
  const [contract, setContract] = useState(null);
  const [owner, setOwner] = useState('');

  useEffect(() => {
    async function initContract() {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS, 
          ABBettingABI, 
          provider
        );
        setContract(contractInstance);
        
        const ownerAddress = await contractInstance.owner();
        setOwner(ownerAddress);
      }
    }
    
    initContract();
  }, []);

  const connectWallet = async () => {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
  };

  return (
    <div>
      <h1>AB Betting DApp</h1>
      <p>Contract Owner: {owner}</p>
      <button onClick={connectWallet}>Connect Wallet</button>
    </div>
  );
}
```

## 🔧 트러블슈팅

### 1. 일반적인 오류들

#### "Stack too deep" 오류
```bash
# foundry.toml에 다음 설정 확인
via_ir = true
```

#### Private Key 형식 오류
```bash
# 올바른 형식: 0x 접두사 포함
--private-key 0x1234567890abcdef...
```

#### RPC 연결 오류
```bash
# 다른 RPC 엔드포인트 시도
BASE_SEPOLIA_RPC_URL=https://sepolia-preconf.base.org
```

### 2. 검증 실패 시 체크리스트
- ✅ Basescan API Key가 올바른가?
- ✅ Compiler version이 정확한가? (`v0.8.20+commit.a1b79de6`)
- ✅ Optimization 설정이 맞는가? (`200 runs`)
- ✅ Constructor arguments가 정확한가?
- ✅ `via_ir = true` 설정이 있는가?

### 3. 유용한 명령어들
```bash
# Foundry 버전 확인
forge --version

# 네트워크 연결 테스트
cast block-number --rpc-url base_sepolia

# 계정 잔액 확인
cast balance 0xYourAddress --rpc-url base_sepolia

# 가스 가격 확인
cast gas-price --rpc-url base_sepolia
```

## 🎯 현재 배포된 컨트랙트 정보

- **Contract Address**: `0x09a42120753E1773820C7195b4EF8deB58ebeFa2`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Explorer**: https://sepolia.basescan.org/address/0x09a42120753e1773820c7195b4ef8deb58ebefa2
- **Deployer/Oracle**: `0xDbE0e7090C563898691eEF3566b82980D9064d6B`
- **Verification**: ✅ Verified

---

이 가이드를 따라하면 Foundry를 사용하여 Base Sepolia에 스마트 컨트랙트를 안전하고 효율적으로 배포하고 검증할 수 있습니다.