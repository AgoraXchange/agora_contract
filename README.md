# ABBetting - Advanced Prediction Market Smart Contract

완전 자동 정산 시스템을 통해 현대적인 베팅 플랫폼과 동일한 사용자 경험을 제공하는 예측 시장 스마트 컨트랙트입니다.

## 🌟 핵심 특징

- ✨ **완전 자동 정산** - 즉시 정산
- 🔐 **베팅자 전용 댓글** - 베팅 참여자만 토론 가능
- 🛡️ **Commit-Reveal 패턴** - 프론트러닝 방지
- 🎯 **AI 오라클 시스템** - 자동화된 승자 결정

## 주요 기능

### 1. Agreement 생성 시스템
- **상세 정보 포함**: 주제(topic), 설명(description), 당사자 A/B 정의
- **베팅 조건 설정**: 최소/최대 베팅 금액, 베팅 기간 설정
- **자동 시간 관리**: 베팅 기간 + 공개 기간 자동 설정

### 2. 베팅 시스템
- **Commit-Reveal 패턴**: 프론트러닝 방지를 위한 2단계 베팅
- **베팅 취소**: 베팅 종료 30분 전까지 취소 가능
- **베팅 자격 확인**: `canBet()` 함수로 실시간 베팅 가능 여부 확인

### 3. 댓글 시스템 (NEW)
- **베팅자 전용**: 베팅에 참여한 사용자만 댓글 작성 가능
- **댓글 좋아요**: 댓글에 좋아요 기능 (중복 방지)
- **무료 댓글**: 댓글 작성에 별도 수수료 없음
- **길이 제한**: 댓글 최대 500자 제한

### 4. 완전 자동 정산 시스템 (NEW)
- **승자 결정 시 즉시 전액 분배**: 오라클이 승자 결정하면 모든 당사자에게 즉시 자동 정산
- **플랫폼 수수료 자동 차감**: 패자 풀에서 2% 자동 징수 → `feeRecipient`
- **당사자 보상 자동 지급**: 계약 생성자에게 보상 자동 지급
- **승자 배당금 자동 지급**: 모든 승자들에게 배당금 자동 지급 (개별 청구 불필요)

### 5. 보안 및 관리 기능
- **긴급 정지 (Pausable)**: 관리자가 긴급 상황시 컨트랙트 일시정지
- **계약 취소**: 베팅이 없거나 문제 발생시 계약 취소
- **통계 조회**: 계약별/플랫폼 전체 통계 확인
- **페이지네이션**: DoS 공격 방지를 위한 베팅/댓글 조회 페이징

## 🔄 플로우 다이어그램

```
📝 Agreement 생성
    ↓
🎯 베팅 참여 (Commit-Reveal)
    ↓
💬 댓글 토론 (베팅자만)
    ↓
⏰ 베팅 기간 종료
    ↓
🏆 AI 오라클 승자 결정
    ↓
💰 완전 자동 정산 ✨
   ├── 플랫폼 수수료 (5%) → 플랫폼
   ├── 당사자 보상 (1% 고정) → 생성자
   └── 승자 배당금 → 모든 승자 🎉
```

### ⚡ 즉시 정산 시스템
승자 결정과 동시에 모든 당사자가 자동으로 자금을 받습니다. 추가 액션이 필요하지 않습니다!

## 설치 및 실행

### 1. Foundry 설치
```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash

# 새 터미널 세션 시작하거나 PATH 로드
source ~/.zshenv

# Foundry 도구 설치
foundryup
```

### 2. 프로젝트 설정
```bash
# OpenZeppelin Contracts 설치 (이미 설치되어 있음)
forge install OpenZeppelin/openzeppelin-contracts@v5.4.0

# 컴파일
forge build

# 환경 변수 설정 (.env 파일 생성 필요)
# PRIVATE_KEY=your_private_key_here
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# ETHERSCAN_API_KEY=your_basescan_api_key_here
```

### 3. 배포 (Base Sepolia)
```bash
# 환경 변수 로드 후 배포 및 검증
export PATH="$HOME/.foundry/bin:$PATH"
source .env && forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --private-key 0x${PRIVATE_KEY}
```

📖 **자세한 가이드**: [FOUNDRY_DEPLOYMENT_GUIDE.md](./FOUNDRY_DEPLOYMENT_GUIDE.md)

## 🔧 스마트 컨트랙트 API

### 핵심 기능별 함수 그룹

### Agreement 생성 (업데이트됨)
```solidity
createContract(
    string topic,           // 주제
    string description,     // 설명 (NEW)
    string partyA,         // 당사자 A
    string partyB,         // 당사자 B
    uint256 bettingDurationInMinutes,
    uint256 minBetAmount,
    uint256 maxBetAmount
)
// 당사자 보상 비율은 1%로 고정됨
```

### 베팅 (Commit-Reveal)
```solidity
// 1단계: 커밋
commitBet(uint256 contractId, bytes32 commitHash) payable

// 2단계: 공개 (베팅 기간 종료 후)
revealBet(uint256 contractId, Choice choice, uint256 nonce)

// 베팅 가능 여부 확인
canBet(uint256 contractId) view returns (bool)
```

### 댓글 시스템 (NEW)
```solidity
// 댓글 작성 (베팅한 사람만)
addComment(uint256 contractId, string content)

// 댓글 좋아요
likeComment(uint256 contractId, uint256 commentId)

// 댓글 조회 (페이징)
getComments(uint256 contractId, uint256 offset, uint256 limit)

// 베팅 여부 확인
hasUserBet(uint256 contractId, address user) view returns (bool)
```

### 베팅 취소
```solidity
cancelBet(uint256 contractId)
```

### 승자 결정 및 완전 자동 정산 (업데이트됨)
```solidity
// 승자 결정 시 모든 당사자에게 즉시 자동 정산
declareWinner(uint256 contractId, Choice winner) // 오라클 전용

// 환불 및 자동 정산 실패 시만 사용 (일반적으로 불필요)
claimReward(uint256 contractId)
```

### 관리자 함수
```solidity
pause() / unpause()
setPlatformFee(uint256 newFeePercentage)
setDefaultBetLimits(uint256 minBet, uint256 maxBet)
```

## 완전 자동 정산 시스템

### 승자 결정 시 즉시 실행되는 완전 자동 정산
1. **플랫폼 수수료**: 패자 풀의 5% → `feeRecipient`로 즉시 전송 ✅
2. **당사자 보상**: (패자 풀 - 플랫폼 수수료)의 1% → 계약 생성자에게 즉시 전송 ✅
3. **모든 승자 배당금**: 나머지 금액을 모든 승자들에게 즉시 자동 지급 ✅

### 자동 정산의 장점
- **즉시 지급**: 승자 결정과 동시에 모든 당사자가 자금 수령
- **가스비 효율**: 하나의 트랜잭션으로 모든 정산 완료
- **사용자 경험**: 추가 액션 불필요한 즉시 정산
- **자금 묶임 방지**: 미청구로 인한 컨트랙트 잔고 누적 없음

### 배당 계산 예시 (완전 자동)
- 총 베팅: A에 3 ETH, B에 1 ETH 
- A 승리시 (모든 지급 즉시 자동 실행):
  - 플랫폼 수수료: 0.05 ETH (1 ETH × 5%) → `feeRecipient` 즉시 수령 ✅
  - 당사자 보상: 0.0095 ETH ((1 - 0.05) × 1%) → 계약 생성자 즉시 수령 ✅
  - 베팅자 풀: 0.9405 ETH → A 승자들에게 즉시 자동 분배 ✅
  - 베팅자별 배당: 원금 + (베팅액/승자풀 × 베팅자풀) - 모든 승자가 즉시 수령

## 댓글 시스템 특징

### 접근 제한
- 베팅에 참여한 사용자만 댓글 작성 가능
- `hasUserBet()` 함수로 베팅 여부 검증

### 댓글 기능
- 최대 500자까지 작성 가능
- 댓글별 좋아요 기능
- 좋아요 중복 방지 (한 사용자당 한 번만)
- 댓글 작성 수수료 없음

### 댓글 조회
- 페이징 지원 (최대 100개씩)
- 작성 시간순 조회
- 좋아요 수 포함

## 보안 기능

- **ReentrancyGuard**: 재진입 공격 방지
- **Pausable**: 긴급 상황 대응
- **Ownable**: 관리자 권한 제어
- **Commit-Reveal**: 프론트러닝 방지
- **안전한 이더 전송**: call 함수 사용
- **베팅 자격 검증**: 댓글 작성 시 베팅 여부 확인
- **자동 정산**: 승자 결정 시 즉시 정산으로 지연 위험 최소화

## Contract Status 관리

### 상태 전환
- **Active**: 베팅 가능한 상태
- **Closed**: 베팅 종료, 공개 대기
- **Resolved**: 승자 결정됨
- **Distributed**: 배당금 분배 완료 (자동)
- **Cancelled**: 계약 취소

### 완전 자동화된 상태 관리
- 승자 결정 시 `Resolved` → `Distributed` 자동 전환
- 플랫폼 수수료, 당사자 보상, 모든 승자 배당금 즉시 자동 지급
- 중복 정산 방지
- 즉시 정산 경험

## 라이선스

MIT