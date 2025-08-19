# ABBetting - Enhanced Betting Smart Contract

이더리움 기반의 향상된 베팅 스마트 컨트랙트입니다. 당사자 A/B 간의 대결에 대해 제3자들이 베팅할 수 있으며, AI 에이전트(오라클)가 승자를 결정합니다.

## 주요 기능

### 1. 기본 기능
- **계약 생성**: 당사자 A/B를 정의하고 베팅 기간 설정
- **베팅**: 제3자들이 A 또는 B에 토큰 베팅
- **승자 결정**: AI 에이전트(오라클)가 승자 선언
- **보상 분배**: 승자에게 베팅한 사람들에게 자동 분배

### 2. 개선된 기능
- **Commit-Reveal 패턴**: 프론트러닝 방지를 위한 2단계 베팅
- **최소/최대 베팅 금액 제한**: 계약별로 베팅 금액 범위 설정
- **베팅 취소**: 베팅 종료 30분 전까지 취소 가능
- **긴급 정지 (Pausable)**: 관리자가 긴급 상황시 컨트랙트 일시정지
- **플랫폼 수수료**: 패자 풀에서 2% 플랫폼 수수료 징수
- **계약 취소**: 베팅이 없거나 문제 발생시 계약 취소
- **통계 조회**: 계약별/플랫폼 전체 통계 확인
- **페이지네이션**: DoS 공격 방지를 위한 베팅 조회 페이징

## 베팅 흐름

1. **계약 생성** → 2. **베팅 커밋** → 3. **베팅 공개** → 4. **베팅 종료** → 5. **승자 결정** → 6. **보상 분배** → 7. **보상 청구**

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 컴파일
npm run compile

# 테스트 실행
npm run test

# 로컬 노드 실행
npm run node

# 배포 (다른 터미널에서)
npm run deploy
```

## 주요 함수

### 계약 생성
```solidity
createContract(
    string partyA,
    string partyB,
    uint256 bettingDurationInMinutes,
    uint256 partyRewardPercentage,
    uint256 minBetAmount,
    uint256 maxBetAmount
)
```

### 베팅 (Commit-Reveal)
```solidity
// 1단계: 커밋
commitBet(uint256 contractId, bytes32 commitHash) payable

// 2단계: 공개 (베팅 기간 종료 후)
revealBet(uint256 contractId, Choice choice, uint256 nonce)
```

### 베팅 취소
```solidity
cancelBet(uint256 contractId)
```

### 관리자 함수
```solidity
pause() / unpause()
setPlatformFee(uint256 newFeePercentage)
setDefaultBetLimits(uint256 minBet, uint256 maxBet)
```

## 보상 분배 구조

1. **플랫폼 수수료**: 패자 풀의 2%
2. **당사자 보상**: (패자 풀 - 플랫폼 수수료)의 x%
3. **베팅자 배당**: 나머지 금액을 승자 베팅 비율에 따라 분배

### 계산 예시
- 총 베팅: A에 3 ETH, B에 1 ETH
- A 승리시:
  - 플랫폼 수수료: 0.02 ETH (1 ETH × 2%)
  - 당사자 보상: 0.098 ETH ((1 - 0.02) × 10%)
  - 베팅자 풀: 0.882 ETH
  - 베팅자별 배당: 원금 + (베팅액/승자풀 × 베팅자풀)

## 보안 기능

- **ReentrancyGuard**: 재진입 공격 방지
- **Pausable**: 긴급 상황 대응
- **Ownable**: 관리자 권한 제어
- **Commit-Reveal**: 프론트러닝 방지
- **안전한 이더 전송**: call 함수 사용

## 라이선스

MIT