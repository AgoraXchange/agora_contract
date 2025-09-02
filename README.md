# Agora Contract - Onchain Debate & Prediction Market

A fully automated prediction market smart contract designed for debate-based betting with AI oracle integration. Features instant settlement, betting-gated comments, and seamless user experience.

## 🌟 Key Features

- ✨ **Fully Automated Settlement** - Instant reward distribution upon winner declaration
- 🔐 **Betting-Gated Comments** - Only participants can join the debate
- 🚀 **Simple Betting System** - One-click instant betting with user-friendly experience
- 🎯 **AI Oracle Integration** - Automated winner determination by AI jury
- 💰 **Transparent Fee Structure** - 5% platform fee + 1% fixed creator reward

## Core Functionality

### 1. Debate Contract Creation
- **Rich Metadata**: topic, description, party A/B definitions
- **Flexible Betting Conditions**: customizable min/max bet amounts and duration
- **Automated Time Management**: betting period with automatic status transitions

### 2. Simple Betting System
- **One-Click Betting**: instant bet placement without complex steps
- **Real-time Pool Updates**: pools and odds updated immediately upon betting
- **AI Oracle Protection**: front-running protection through AI-based result determination
- **Betting Eligibility Check**: `canBet()` function for real-time betting status verification

### 3. Debate Comment System
- **Betting-Gated Access**: only users who have placed bets can comment
- **Comment Likes**: like functionality with duplicate prevention
- **Free Comments**: no additional fees for commenting
- **Length Limits**: maximum 500 characters per comment

### 4. Fully Automated Settlement System
- **Instant Distribution**: all parties receive funds immediately upon winner declaration
- **Automatic Platform Fees**: 5% automatically deducted from loser pool → `feeRecipient`
- **Automatic Creator Rewards**: fixed 1% reward automatically sent to contract creator
- **Automatic Winner Payouts**: all winners receive rewards instantly (no manual claiming needed)

### 5. Security & Management Features
- **Emergency Pause**: admin can pause contract operations during emergencies
- **Contract Cancellation**: contracts can be cancelled if no bets or issues arise
- **Statistics Tracking**: detailed contract and platform-wide analytics
- **Pagination Support**: DoS attack prevention through paginated bet/comment queries

## 🔄 Workflow Diagram

```
📝 Create Debate Contract
    ↓
🎯 Place Bets (One-Click Simple Betting)
    ↓
💬 Join Debate (Bettors Only)
    ↓
⏰ Betting Period Ends
    ↓
🏆 AI Oracle Declares Winner
    ↓
💰 Fully Automated Settlement ✨
   ├── Platform Fee (5%) → Platform
   ├── Creator Reward (1% Fixed) → Creator
   └── Winner Payouts → All Winners 🎉
```

### ⚡ Instant Settlement System
All parties automatically receive their funds simultaneously upon winner declaration. No additional actions required!

## Installation & Deployment

### 1. Install Foundry
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Start new terminal session or load PATH
source ~/.zshenv

# Install Foundry tools
foundryup
```

### 2. Project Setup
```bash
# Install OpenZeppelin Contracts (already installed)
forge install OpenZeppelin/openzeppelin-contracts@v5.4.0

# Compile
forge build

# Environment Variables Setup (.env file required)
# PRIVATE_KEY=your_private_key_here
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# ETHERSCAN_API_KEY=your_basescan_api_key_here
```

### 3. Deploy (Base Sepolia)
```bash
# Load environment variables and deploy with verification
export PATH="$HOME/.foundry/bin:$PATH"
source .env && forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --private-key 0x${PRIVATE_KEY}
```

📖 **Detailed Guide**: [FOUNDRY_DEPLOYMENT_GUIDE.md](./FOUNDRY_DEPLOYMENT_GUIDE.md)

## 🔧 Smart Contract API

### Core Functions by Category

### Contract Creation
```solidity
createContract(
    string topic,           // Debate topic
    string description,     // Detailed description
    string partyA,         // Party A name
    string partyB,         // Party B name
    uint256 bettingDurationInMinutes,
    uint256 minBetAmount,
    uint256 maxBetAmount
)
// Creator reward percentage is fixed at 1%
```

### Simple Betting
```solidity
// One-click instant betting
simpleBet(uint256 contractId, Choice choice) payable

// Check if betting is possible
canBet(uint256 contractId) view returns (bool)
```

### Comment System
```solidity
// Add comment (bettors only)
addComment(uint256 contractId, string content)

// Like comment
likeComment(uint256 contractId, uint256 commentId)

// Get comments (paginated)
getComments(uint256 contractId, uint256 offset, uint256 limit)

// Check if user has bet
hasUserBet(uint256 contractId, address user) view returns (bool)
```


### Winner Declaration & Automated Settlement
```solidity
// Declare winner with instant automated settlement
declareWinner(uint256 contractId, Choice winner) // Oracle only

// Manual claim (only for refunds or failed auto-settlement)
claimReward(uint256 contractId)
```

#### Oracle Winner Declaration Usage

**✅ Simplified Process: Winner can be declared immediately after betting period ends**

Once the betting period (`bettingEndTime`) ends, the oracle can immediately declare the winner:

```bash
# Declare Party A winner (Choice.A = 1)
cast send 0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db \
  "declareWinner(uint256,uint8)" \
  0 1 \
  --private-key 0x${ORACLE_PRIVATE_KEY} \
  --rpc-url https://sepolia.base.org

# Or declare Party B winner (Choice.B = 2)
cast send 0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db \
  "declareWinner(uint256,uint8)" \
  0 2 \
  --private-key 0x${ORACLE_PRIVATE_KEY} \
  --rpc-url https://sepolia.base.org
```

**Note: `closeBetting()` call is optional**
- New bets are automatically blocked when betting time ends
- `declareWinner()` can handle both Active/Closed states
- Manual `closeBetting()` call is still available if desired

**Status Check:**
```bash
# Check current status
cast call 0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db \
  "contracts(uint256)" \
  0 \
  --rpc-url https://sepolia.base.org
```

**Contract Status Values:**
- `0` = Active (betting in progress)
- `1` = Closed (betting ended, awaiting winner declaration)
- `2` = Resolved (winner declared)
- `3` = Distributed (rewards distributed)
- `4` = Cancelled (cancelled)

**Choice Values:**
- `0` = None (initial value)
- `1` = A (Party A wins)
- `2` = B (Party B wins)

**Complete Example Scenario:**
```bash
# After betting time ends, declare Party A winner immediately
cast send 0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db \
  "declareWinner(uint256,uint8)" \
  0 1 \
  --private-key 0x${ORACLE_PRIVATE_KEY} \
  --rpc-url https://sepolia.base.org
```

⚡ **Automated Settlement**: All participants automatically receive their rewards simultaneously upon winner declaration!

### Admin Functions
```solidity
pause() / unpause()
setPlatformFee(uint256 newFeePercentage)
setDefaultBetLimits(uint256 minBet, uint256 maxBet)
setFeeRecipient(address newRecipient)
setOracle(address newOracle)
```

## Fully Automated Settlement System

### Instant Execution Upon Winner Declaration
1. **Platform Fee**: 5% of loser pool → instantly sent to `feeRecipient` ✅
2. **Creator Reward**: 1% of (loser pool - platform fee) → instantly sent to contract creator ✅
3. **Winner Payouts**: remaining amount automatically distributed to all winners ✅

### Benefits of Automated Settlement
- **Instant Payout**: all parties receive funds simultaneously upon winner declaration
- **Gas Efficiency**: complete settlement in a single transaction
- **User Experience**: instant settlement without additional actions required
- **No Fund Lock**: prevents contract balance accumulation from unclaimed rewards

### Payout Calculation Example (Fully Automated)
- Total Bets: 3 ETH on A, 1 ETH on B 
- If A Wins (all payouts executed instantly and automatically):
  - Platform Fee: 0.05 ETH (1 ETH × 5%) → `feeRecipient` receives instantly ✅
  - Creator Reward: 0.0095 ETH ((1 - 0.05) × 1%) → contract creator receives instantly ✅
  - Winner Pool: 0.9405 ETH → automatically distributed to A winners instantly ✅
  - Individual Payout: principal + (bet amount / winner pool × remaining pool) - all winners receive instantly

## Comment System Features

### Access Control
- Only users who have placed bets can comment
- Betting verification through `hasUserBet()` function

### Comment Functionality
- Maximum 500 characters per comment
- Like functionality for each comment
- Duplicate like prevention (one per user)
- No fees for commenting

### Comment Retrieval
- Pagination support (up to 100 at a time)
- Chronological ordering
- Like counts included

## Security Features

- **ReentrancyGuard**: prevents reentrancy attacks
- **Pausable**: emergency response capability
- **Ownable**: admin access control
- **AI Oracle Verification**: manipulation prevention through AI-based result determination
- **Safe Ether Transfers**: uses call function for secure transfers
- **Betting Verification**: checks betting status for comment access
- **Automated Settlement**: instant settlement upon winner declaration minimizes delay risks

## Contract Status Management

### Status Transitions
- **Active**: betting is open
- **Closed**: betting ended, awaiting winner declaration
- **Resolved**: winner has been declared
- **Distributed**: rewards distributed (automated)
- **Cancelled**: contract cancelled

### Fully Automated Status Management
- Winner declaration triggers automatic `Resolved` → `Distributed` transition
- Platform fees, creator rewards, and winner payouts instantly distributed
- Simple betting provides immediate pool reflection and automated settlement
- Prevents duplicate settlements
- Instant settlement experience

## Current Deployment

**Base Sepolia Testnet Contract Address:**
`0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db`

**Block Explorer:** [View on BaseScan](https://sepolia.basescan.org/address/0x2BfDF9A3b3C28385E198Ba4d85F32A4B8b69a3db)

## License

MIT