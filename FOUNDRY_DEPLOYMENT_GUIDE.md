# Foundry를 이용한 Base Sepolia & Monad Testnet 배포 및 검증 완전 가이드

## 📋 목차
1. [환경 설정](#환경-설정)
2. [Foundry 프로젝트 설정](#foundry-프로젝트-설정)
3. [배포 스크립트 작성](#배포-스크립트-작성)
4. [Base Sepolia 배포 및 검증](#base-sepolia-배포-및-검증)
5. [Monad Testnet 배포](#monad-testnet-배포)
6. [주의사항 및 팁](#주의사항-및-팁)
7. [ABI 사용법](#abi-사용법)
8. [트러블슈팅](#트러블슈팅)

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
# Base Sepolia 배포에 사용할 계정의 Private Key (0x 접두사 없이)
PRIVATE_KEY=your_private_key_here

# Monad Testnet 배포에 사용할 계정의 Private Key (0x 접두사 없이)
MONAD_PRIVATE_KEY=your_monad_private_key_here

# Base Sepolia RPC URL
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Monad Testnet RPC URL
MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz

# Basescan API Key (Base Sepolia 검증용)
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
monad = "${MONAD_TESTNET_RPC_URL}"
```

## 📝 배포 스크립트

### script/Deploy.s.sol (공통 사용)
기존 `script/Deploy.s.sol` 파일을 Base Sepolia와 Monad Testnet 모두에서 사용합니다:

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
        
        // Deploy with deployer as oracle (for testing)
        ABBetting betting = new ABBetting(deployer);
        
        vm.stopBroadcast();
        
        console.log("ABBetting deployed at:", address(betting));
        console.log("Oracle address:", deployer);
        
        return betting;
    }
}
```

## 🚀 Base Sepolia 배포 및 검증

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

## 🌙 Monad Testnet 배포

### 1. Monad Testnet 정보
- **Chain ID**: 10143 (0x279F)
- **RPC URL**: https://testnet-rpc.monad.xyz
- **Explorer**: https://explorer.testnet.monad.xyz
- **Native Token**: MON (Monad)
- **Block Time**: ~1 second
- **EVM Compatible**: Yes

### 2. Monad Testnet MON 획득
```bash
# Monad Discord의 faucet 채널 사용
# 또는 공식 Faucet 웹사이트 방문 (추후 제공 예정)
```

### 3. Monad Testnet 배포
```bash
# 방법 1: .env 파일의 환경변수 사용 (권장)
source .env && forge script script/Deploy.s.sol \
  --rpc-url ${MONAD_TESTNET_RPC_URL} \
  --private-key ${MONAD_PRIVATE_KEY} \
  --broadcast

# 방법 2: 직접 RPC URL 입력
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key ${MONAD_PRIVATE_KEY} \
  --broadcast

# 배포 성공 후 컨트랙트 주소를 저장
# 예: CONTRACT_ADDRESS=0x...
```

### 4. 배포 후 검증 ⚠️ **현재 제한사항**

**현재 상황:** Monad testnet에서 자동 검증이 어려운 상태
- Monadscan API: "Invalid API Key" 오류
- SocialScan API: 연결 실패 또는 API 키 문제  
- Sourcify API: 서버 응답 없음
- 수동 검증: Via IR 옵션 없어서 Stack too deep 오류

#### 방법 1: 자동 검증 시도 (현재 제한적)
```bash
# 먼저 API 키 없이 시도
forge verify-contract \
  --rpc-url https://testnet-rpc.monad.xyz \
  --verifier etherscan \
  --verifier-url https://api-testnet.monadscan.com/api \
  0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe \
  contracts/ABBetting.sol:ABBetting

# API 키가 필요한 경우 (Base Sepolia API 키로는 "Invalid API Key" 오류 발생)
# Monadscan 전용 API 키가 필요할 수 있음
# source .env && forge verify-contract \
#   --rpc-url https://testnet-rpc.monad.xyz \
#   --verifier etherscan \
#   --verifier-url https://api-testnet.monadscan.com/api \
#   --etherscan-api-key ${MONADSCAN_API_KEY} \
#   0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe \
#   contracts/ABBetting.sol:ABBetting
```

**Monadscan API 키 발급:**
- https://testnet.monadscan.com 방문
- 계정 생성 후 API 키 발급
- .env에 `MONADSCAN_API_KEY=your_api_key` 추가

#### 방법 2: Monad Explorer를 통한 수동 검증

**1단계: Flatten된 코드 생성**
```bash
# 모든 import를 포함한 평면화된 코드 생성
forge flatten contracts/ABBetting.sol > ABBetting_flattened.sol

# 생성된 파일 확인
cat ABBetting_flattened.sol
```

**2단계: Explorer에서 검증 (대안)**
**Monad Explorer:** https://testnet.monadexplorer.com  
**Monadscan:** https://testnet.monadscan.com  

1. 위 탐색기 중 하나에 접속
2. 배포된 컨트랙트 주소 검색: `0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe`
3. "Contract" 탭 → "Verify & Publish" 클릭
4. 검증 정보 입력:
   - **Compiler Type**: `Solidity (Single file)`
   - **Compiler Version**: `v0.8.20+commit.a1b79de6`
   - **Open Source License Type**: `MIT`
   - **Optimization**: `Yes`
   - **Optimization Runs**: `200`
   - **EVM Version**: `paris`
   - **⚠️ 중요**: "Advanced Options" 또는 "More Settings" 클릭
   - **Via IR**: `Yes` (Stack too deep 오류 방지)
5. **Source Code**: `ABBetting_flattened.sol` 파일의 전체 내용을 복사하여 붙여넣기
6. **Constructor Arguments**: 배포 시 사용한 Oracle 주소 (ABI 인코딩된 형태)

**중요 사항:**
- "Via IR" 옵션을 반드시 활성화해야 함 (Stack too deep 오류 방지)
- 이 옵션이 보이지 않으면 "Advanced Options"나 "Show more options" 버튼을 찾아서 클릭
- ⚠️ **Via IR 옵션이 없는 Explorer는 수동 검증 불가** (Stack too deep 오류로 인해 컴파일 실패)

**Via IR 옵션이 없을 경우 대안:**
1. 자동 검증 API 사용 (SocialScan, Monadscan 등)
2. Via IR을 지원하는 다른 Explorer 찾기
3. 컨트랙트 코드 단순화 (함수 분리, 변수 최적화)

**Constructor Arguments 인코딩 방법:**
```bash
# Oracle 주소를 ABI 인코딩
cast abi-encode "constructor(address)" 0x배포자주소
```

#### 방법 3: 다른 Explorer API 시도
```bash
# SocialScan API 시도
source .env && forge verify-contract \
  --rpc-url https://testnet-rpc.monad.xyz \
  --verifier etherscan \
  --verifier-url https://api.socialscan.io/monad-testnet/v1/explorer/command_api/contract \
  --etherscan-api-key ${ETHERSCAN_API_KEY} \
  0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe \
  contracts/ABBetting.sol:ABBetting

# Sourcify (BlockVision) - 현재 작동 안 함
# forge verify-contract --rpc-url https://testnet-rpc.monad.xyz --verifier sourcify --verifier-url 'https://sourcify-api-monad.blockvision.org' 0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe contracts/ABBetting.sol:ABBetting
```

**검증 성공 후 확인사항:**
- Explorer에서 "Contract" 탭이 활성화되고 소스코드가 표시됨
- Read/Write Contract 기능 사용 가능
- 트랜잭션에서 함수 호출 내역이 디코딩되어 표시됨

### 5. 검증 없이 컨트랙트 사용하기

**검증이 실패해도 컨트랙트는 정상 작동합니다:**
- 배포된 컨트랙트: `0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe`
- 트랜잭션과 상태 변화는 Explorer에서 확인 가능
- ABI를 알고 있으면 직접 상호작용 가능

**ABI 사용 방법:**
```bash
# ABI 파일 생성
forge inspect ABBetting abi > ABBetting_ABI.json

# ethers.js나 viem 등으로 컨트랙트 상호작용
# const contract = new ethers.Contract(address, abi, provider);
```

### 6. Monad Testnet 특이사항
- **빠른 블록 타임**: ~1초의 블록 타임으로 트랜잭션이 매우 빠르게 처리됨
- **가스비**: Base Sepolia와 유사한 가스 구조
- **EVM 호환성**: Solidity 0.8.x 완벽 지원
- **검증**: 현재 자동/수동 검증 모두 제한적 (생태계 초기 단계)

## ⚠️ 주의사항 및 팁

### 1. 필수 주의사항
- ❗ **Private Key 보안**: `.env` 파일을 `.gitignore`에 추가하고 절대 Git에 커밋하지 마세요
- ❗ **테스트넷 사용**: 실제 메인넷을 사용하지 마세요
- ❗ **가스비 준비**: 
  - Base Sepolia: ETH가 충분히 있는지 확인
  - Monad Testnet: MON이 충분히 있는지 확인

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

# 건식 실행 - Base Sepolia (실제 배포 안 함)
forge script script/Deploy.s.sol --rpc-url base_sepolia

# 건식 실행 - Monad Testnet (실제 배포 안 함)
source .env && forge script script/Deploy.s.sol --rpc-url ${MONAD_TESTNET_RPC_URL}

# 상세한 가스 정보와 함께 실행 - Base Sepolia
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --private-key 0x${PRIVATE_KEY} -vvvv

# 상세한 가스 정보와 함께 실행 - Monad Testnet
source .env && forge script script/Deploy.s.sol --rpc-url ${MONAD_TESTNET_RPC_URL} --broadcast --private-key ${MONAD_PRIVATE_KEY} -vvvv
```

## 📁 ABI 사용법

### 1. ABI 파일 추출

#### 방법 1: forge inspect 명령어 사용 (추천)
```bash
# ABI만 추출하여 콘솔에 출력
forge inspect ABBetting abi

# ABI를 JSON 파일로 저장 (jq 필요)
forge inspect ABBetting abi | jq . > ABBetting_ABI.json

# jq가 없는 경우 grep으로 간단히 추출
grep -A 2000 '"abi":' out/ABBetting.sol/ABBetting.json | head -2000 > ABBetting_ABI.json
```

#### 방법 2: 컴파일된 JSON에서 추출 (기존 방법)
```bash
# ABI 파일 생성 (jq 필요)
cat out/ABBetting.sol/ABBetting.json | jq '.abi' > ABBetting_ABI.json

# jq가 없는 경우 grep으로 추출
grep -A 2000 '"abi":' out/ABBetting.sol/ABBetting.json | head -2000 > ABBetting_ABI.json
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
# Base Sepolia: 다른 RPC 엔드포인트 시도
BASE_SEPOLIA_RPC_URL=https://sepolia-preconf.base.org

# Monad Testnet: 환경변수가 제대로 로드되었는지 확인
source .env
echo $MONAD_TESTNET_RPC_URL  # https://testnet-rpc.monad.xyz 출력되어야 함

# foundry.toml의 별칭 대신 직접 URL 사용
forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

### 2. 검증 실패 시 체크리스트
- ✅ Basescan API Key가 올바른가?
- ✅ Compiler version이 정확한가? (`v0.8.20+commit.a1b79de6`)
- ✅ Optimization 설정이 맞는가? (`200 runs`)
- ✅ Constructor arguments가 정확한가?
- ✅ `via_ir = true` 설정이 있는가?

#### Monad Explorer 검증 실패 시
```bash
# "Stack too deep" 오류 발생 시
- Advanced Options에서 "Via IR" 옵션 활성화 필수
- foundry.toml에 via_ir = true 설정 확인

# OpenZeppelin import 오류 발생 시
forge flatten contracts/ABBetting.sol > ABBetting_flattened.sol

# Constructor arguments 확인
cast abi-encode "constructor(address)" 0x배포자주소
```

### 3. 유용한 명령어들
```bash
# Foundry 버전 확인
forge --version

# 네트워크 연결 테스트 - Base Sepolia
cast block-number --rpc-url base_sepolia

# 네트워크 연결 테스트 - Monad Testnet
source .env && cast block-number --rpc-url ${MONAD_TESTNET_RPC_URL}

# 계정 잔액 확인 - Base Sepolia (ETH)
cast balance 0xYourAddress --rpc-url base_sepolia

# 계정 잔액 확인 - Monad Testnet (MON)
source .env && cast balance 0xYourAddress --rpc-url ${MONAD_TESTNET_RPC_URL}

# 가스 가격 확인 - Base Sepolia
cast gas-price --rpc-url base_sepolia

# 가스 가격 확인 - Monad Testnet
source .env && cast gas-price --rpc-url ${MONAD_TESTNET_RPC_URL}

# Chain ID 확인 - Monad Testnet (10143 반환되어야 함)
source .env && cast chain-id --rpc-url ${MONAD_TESTNET_RPC_URL}
```

## 🎯 배포된 컨트랙트 정보

### Base Sepolia
- **Contract Address**: `0x09a42120753E1773820C7195b4EF8deB58ebeFa2`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Explorer**: https://sepolia.basescan.org/address/0x09a42120753e1773820c7195b4ef8deb58ebefa2
- **Deployer/Oracle**: `0xDbE0e7090C563898691eEF3566b82980D9064d6B`
- **Verification**: ✅ Verified

### Monad Testnet
- **Contract Address**: `0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe`
- **Network**: Monad Testnet (Chain ID: 10143)
- **Explorers**: 
  - Monad Explorer: https://testnet.monadexplorer.com/address/0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe
  - Monadscan: https://testnet.monadscan.com/address/0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe
  - SocialScan: https://monad-testnet.socialscan.io/address/0x6bDE954F7C64c213ffa3DE429AB45dFb33791dBe
- **Deployer/Oracle**: `배포자 주소 확인 필요`
- **Verification**: ❌ 현재 자동/수동 검증 모두 제한적 (검증 없이도 컨트랙트는 정상 작동)

---

이 가이드를 따라하면 Foundry를 사용하여 Base Sepolia와 Monad Testnet에 스마트 컨트랙트를 안전하고 효율적으로 배포할 수 있습니다.