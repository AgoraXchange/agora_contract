// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ABBetting is ReentrancyGuard, Pausable, Ownable {
    enum ContractStatus { Active, Closed, Resolved, Distributed, Cancelled }
    enum Choice { None, A, B }
    
    struct Contract {
        address creator;
        string topic;
        string description;
        string partyA;
        string partyB;
        uint256 bettingEndTime;
        uint256 revealEndTime;
        ContractStatus status;
        Choice winner;
        uint256 totalPoolA;
        uint256 totalPoolB;
        uint256 partyRewardPercentage;
        uint256 minBetAmount;
        uint256 maxBetAmount;
        uint256 totalBettors;
        uint256 totalComments;
    }
    
    struct Bet {
        address bettor;
        Choice choice;
        uint256 amount;
        bool claimed;
        bool revealed;
        uint256 timestamp;
    }
    
    struct Commitment {
        bytes32 commitHash;
        uint256 amount;
        uint256 timestamp;
        bool revealed;
        bool cancelled;
    }
    
    struct UserBets {
        uint256[] betIds;
    }
    
    struct Comment {
        address commenter;
        string content;
        uint256 timestamp;
        uint256 likes;
    }
    
    struct PlatformStats {
        uint256 totalContracts;
        uint256 totalBets;
        uint256 totalVolume;
        uint256 totalFeesCollected;
    }
    
    // 플랫폼 설정
    address public oracle;
    uint256 public platformFeePercentage = 5; // 5% 플랫폼 수수료
    uint256 public constant PARTY_REWARD_PERCENTAGE =1; // 1% 고정 당사자 보상
    uint256 public defaultMinBet = 0.01 ether;
    uint256 public defaultMaxBet = 100 ether;
    address public feeRecipient;
    
    // 통계
    PlatformStats public platformStats;
    
    // 계약 관련 매핑
    mapping(uint256 => Contract) public contracts;
    mapping(uint256 => Bet[]) public contractBets;
    mapping(uint256 => mapping(address => UserBets)) private userBetsPerContract;
    mapping(uint256 => mapping(address => Commitment)) public commitments;
    mapping(uint256 => Comment[]) public contractComments;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public commentLikes;
    
    uint256 public contractCounter;
    uint256 public constant REVEAL_DURATION = 1 hours;
    uint256 public constant MAX_BETS_PER_PAGE = 100;
    uint256 public constant CANCELLATION_DEADLINE = 30 minutes; // 베팅 취소 가능 시간
    
    // 이벤트
    event ContractCreated(uint256 indexed contractId, address indexed creator, string topic, string description, string partyA, string partyB, uint256 bettingEndTime);
    event BetCommitted(uint256 indexed contractId, address indexed bettor, bytes32 commitHash, uint256 amount);
    event BetRevealed(uint256 indexed contractId, address indexed bettor, Choice choice, uint256 amount);
    event BetCancelled(uint256 indexed contractId, address indexed bettor, uint256 amount);
    event WinnerDeclared(uint256 indexed contractId, Choice winner);
    event RewardsDistributed(uint256 indexed contractId, uint256 partyReward, uint256 platformFee, uint256 totalDistributed);
    event RewardClaimed(uint256 indexed contractId, address indexed bettor, uint256 amount);
    event ContractCancelled(uint256 indexed contractId);
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event DefaultBetLimitsUpdated(uint256 newMinBet, uint256 newMaxBet);
    event CommentAdded(uint256 indexed contractId, address indexed commenter, string content);
    event CommentLiked(uint256 indexed contractId, uint256 indexed commentId, address indexed liker);
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call this function");
        _;
    }
    
    constructor(address _oracle) Ownable(msg.sender) {
        oracle = _oracle;
        feeRecipient = msg.sender;
    }
    
    // 계약 생성 함수 (개선된 버전)
    function createContract(
        string memory _topic,
        string memory _description,
        string memory _partyA,
        string memory _partyB,
        uint256 _bettingDurationInMinutes,
        uint256 _minBetAmount,
        uint256 _maxBetAmount
    ) external whenNotPaused returns (uint256) {
        require(bytes(_topic).length > 0, "Topic cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(bytes(_partyA).length > 0 && bytes(_partyB).length > 0, "Party names cannot be empty");
        require(_bettingDurationInMinutes > 0, "Duration must be positive");
        require(_minBetAmount > 0, "Min bet must be positive");
        require(_maxBetAmount >= _minBetAmount, "Max bet must be >= min bet");
        
        uint256 contractId = contractCounter++;
        uint256 bettingEndTime = block.timestamp + (_bettingDurationInMinutes * 1 minutes);
        uint256 revealEndTime = bettingEndTime + REVEAL_DURATION;
        
        contracts[contractId] = Contract({
            creator: msg.sender,
            topic: _topic,
            description: _description,
            partyA: _partyA,
            partyB: _partyB,
            bettingEndTime: bettingEndTime,
            revealEndTime: revealEndTime,
            status: ContractStatus.Active,
            winner: Choice.None,
            totalPoolA: 0,
            totalPoolB: 0,
            partyRewardPercentage: PARTY_REWARD_PERCENTAGE,
            minBetAmount: _minBetAmount > 0 ? _minBetAmount : defaultMinBet,
            maxBetAmount: _maxBetAmount > 0 ? _maxBetAmount : defaultMaxBet,
            totalBettors: 0,
            totalComments: 0
        });
        
        platformStats.totalContracts++;
        
        emit ContractCreated(contractId, msg.sender, _topic, _description, _partyA, _partyB, bettingEndTime);
        return contractId;
    }
    
    // 베팅 커밋 함수 (개선된 버전)
    function commitBet(uint256 _contractId, bytes32 _commitHash) external payable nonReentrant whenNotPaused {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Active, "Contract not active");
        require(block.timestamp < cont.bettingEndTime, "Betting period ended");
        require(msg.value >= cont.minBetAmount, "Bet below minimum");
        require(msg.value <= cont.maxBetAmount, "Bet above maximum");
        require(commitments[_contractId][msg.sender].amount == 0, "Already committed");
        
        commitments[_contractId][msg.sender] = Commitment({
            commitHash: _commitHash,
            amount: msg.value,
            timestamp: block.timestamp,
            revealed: false,
            cancelled: false
        });
        
        platformStats.totalBets++;
        platformStats.totalVolume += msg.value;
        
        emit BetCommitted(_contractId, msg.sender, _commitHash, msg.value);
    }
    
    // 베팅 취소 함수 (새로운 기능)
    function cancelBet(uint256 _contractId) external nonReentrant {
        Contract storage cont = contracts[_contractId];
        Commitment storage commit = commitments[_contractId][msg.sender];
        
        require(commit.amount > 0, "No commitment found");
        require(!commit.revealed, "Already revealed");
        require(!commit.cancelled, "Already cancelled");
        require(block.timestamp < cont.bettingEndTime - CANCELLATION_DEADLINE, "Cancellation deadline passed");
        
        uint256 refundAmount = commit.amount;
        commit.cancelled = true;
        commit.amount = 0;
        
        platformStats.totalBets--;
        platformStats.totalVolume -= refundAmount;
        
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");
        
        emit BetCancelled(_contractId, msg.sender, refundAmount);
    }
    
    // 베팅 공개 함수
    function revealBet(uint256 _contractId, Choice _choice, uint256 _nonce) external nonReentrant {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Active, "Contract not active");
        require(block.timestamp >= cont.bettingEndTime, "Betting period not ended");
        require(block.timestamp < cont.revealEndTime, "Reveal period ended");
        require(_choice == Choice.A || _choice == Choice.B, "Invalid choice");
        
        Commitment storage commit = commitments[_contractId][msg.sender];
        require(commit.amount > 0, "No commitment found");
        require(!commit.revealed, "Already revealed");
        require(!commit.cancelled, "Bet was cancelled");
        
        bytes32 revealHash = keccak256(abi.encodePacked(_contractId, msg.sender, _choice, _nonce, commit.amount));
        require(revealHash == commit.commitHash, "Invalid reveal");
        
        uint256 betId = contractBets[_contractId].length;
        contractBets[_contractId].push(Bet({
            bettor: msg.sender,
            choice: _choice,
            amount: commit.amount,
            claimed: false,
            revealed: true,
            timestamp: block.timestamp
        }));
        
        userBetsPerContract[_contractId][msg.sender].betIds.push(betId);
        
        if (_choice == Choice.A) {
            cont.totalPoolA += commit.amount;
        } else {
            cont.totalPoolB += commit.amount;
        }
        
        if (userBetsPerContract[_contractId][msg.sender].betIds.length == 1) {
            cont.totalBettors++;
        }
        
        commit.revealed = true;
        
        emit BetRevealed(_contractId, msg.sender, _choice, commit.amount);
    }
    
    // 베팅 종료
    function closeBetting(uint256 _contractId) external {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Active, "Contract not active");
        require(block.timestamp >= cont.revealEndTime, "Reveal period not ended");
        
        cont.status = ContractStatus.Closed;
    }
    
    // 계약 취소 (승자가 없거나 베팅이 없는 경우)
    function cancelContract(uint256 _contractId) external {
        Contract storage cont = contracts[_contractId];
        require(msg.sender == cont.creator || msg.sender == owner(), "Not authorized");
        require(cont.status == ContractStatus.Active || cont.status == ContractStatus.Closed, "Cannot cancel");
        require(cont.totalPoolA + cont.totalPoolB == 0 || block.timestamp > cont.revealEndTime + 7 days, "Cannot cancel yet");
        
        cont.status = ContractStatus.Cancelled;
        emit ContractCancelled(_contractId);
    }
    
    // AI 에이전트(오라클)가 승자 선언 (자동 정산 포함)
    function declareWinner(uint256 _contractId, Choice _winner) external onlyOracle nonReentrant {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Closed, "Betting not closed");
        require(_winner == Choice.A || _winner == Choice.B, "Invalid winner");
        
        cont.winner = _winner;
        cont.status = ContractStatus.Resolved;
        
        emit WinnerDeclared(_contractId, _winner);
        
        // 자동으로 배당금 분배 실행
        _distributeRewardsInternal(_contractId);
    }
    
    // 배당금 분배 함수 (외부 호출용 - 이미 자동 분배되었는지 확인)
    function distributeRewards(uint256 _contractId) external nonReentrant {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Resolved, "Winner not declared");
        
        _distributeRewardsInternal(_contractId);
    }
    
    // 내부 배당금 분배 함수 (자동 정산 포함)
    function _distributeRewardsInternal(uint256 _contractId) internal {
        Contract storage cont = contracts[_contractId];
        
        // 이미 분배되었으면 return
        if (cont.status == ContractStatus.Distributed) {
            return;
        }
        
        uint256 winnerPool = cont.winner == Choice.A ? cont.totalPoolA : cont.totalPoolB;
        uint256 loserPool = cont.winner == Choice.A ? cont.totalPoolB : cont.totalPoolA;
        
        if (winnerPool == 0) {
            cont.status = ContractStatus.Distributed;
            return;
        }
        
        // 플랫폼 수수료 계산
        uint256 platformFee = (loserPool * platformFeePercentage) / 100;
        uint256 poolAfterPlatformFee = loserPool - platformFee;
        
        // 당사자 보상 계산
        uint256 partyReward = (poolAfterPlatformFee * cont.partyRewardPercentage) / 100;
        uint256 remainingPool = poolAfterPlatformFee - partyReward;
        
        // 수수료 및 보상 지급
        if (platformFee > 0) {
            (bool success1, ) = payable(feeRecipient).call{value: platformFee}("");
            require(success1, "Platform fee transfer failed");
            platformStats.totalFeesCollected += platformFee;
        }
        
        if (partyReward > 0) {
            (bool success2, ) = payable(cont.creator).call{value: partyReward}("");
            require(success2, "Party reward transfer failed");
        }
        
        // 모든 승자에게 자동 배당금 분배
        _distributeToWinners(_contractId, remainingPool, winnerPool);
        
        cont.status = ContractStatus.Distributed;
        emit RewardsDistributed(_contractId, partyReward, platformFee, remainingPool);
    }
    
    // 승자들에게 자동 배당금 분배
    function _distributeToWinners(uint256 _contractId, uint256 _remainingPool, uint256 _winnerPool) internal {
        Bet[] storage bets = contractBets[_contractId];
        Choice winner = contracts[_contractId].winner;
        
        // 승자들에게 배당금 계산 및 지급
        for (uint256 i = 0; i < bets.length; i++) {
            Bet storage bet = bets[i];
            
            if (bet.revealed && bet.choice == winner && !bet.claimed) {
                // 배당금 계산: 원금 + (베팅액/승자풀 × 남은풀)
                uint256 reward = bet.amount + (bet.amount * _remainingPool) / _winnerPool;
                
                // 자동 지급
                if (reward > 0) {
                    (bool success, ) = payable(bet.bettor).call{value: reward}("");
                    if (success) {
                        bet.claimed = true;
                        emit RewardClaimed(_contractId, bet.bettor, reward);
                    }
                    // 실패해도 전체 프로세스는 계속 진행 (가스 부족 등으로 일부 실패 가능)
                }
            }
        }
    }
    
    // 환불 및 자동 정산 실패 시 보상 청구
    function claimReward(uint256 _contractId) external nonReentrant {
        Contract storage cont = contracts[_contractId];
        require(cont.status == ContractStatus.Distributed || cont.status == ContractStatus.Cancelled, "Not ready for claims");
        
        uint256 totalReward = 0;
        Bet[] storage bets = contractBets[_contractId];
        uint256[] storage userBetIds = userBetsPerContract[_contractId][msg.sender].betIds;
        
        if (cont.status == ContractStatus.Cancelled) {
            // 계약 취소 시 전액 환불
            for (uint256 i = 0; i < userBetIds.length; i++) {
                Bet storage bet = bets[userBetIds[i]];
                if (!bet.claimed && bet.bettor == msg.sender && bet.revealed) {
                    totalReward += bet.amount;
                    bet.claimed = true;
                }
            }
        } else {
            // 자동 정산에 실패한 승자들의 수동 청구
            uint256 winnerPool = cont.winner == Choice.A ? cont.totalPoolA : cont.totalPoolB;
            uint256 loserPool = cont.winner == Choice.A ? cont.totalPoolB : cont.totalPoolA;
            uint256 poolAfterFees = loserPool - (loserPool * platformFeePercentage) / 100;
            uint256 remainingPool = poolAfterFees - (poolAfterFees * cont.partyRewardPercentage) / 100;
            
            for (uint256 i = 0; i < userBetIds.length; i++) {
                Bet storage bet = bets[userBetIds[i]];
                if (!bet.claimed && bet.bettor == msg.sender && bet.revealed) {
                    if (bet.choice == cont.winner) {
                        // 승자이지만 자동 정산에 실패한 경우만 수동 청구 가능
                        uint256 reward = bet.amount + (bet.amount * remainingPool) / winnerPool;
                        totalReward += reward;
                        bet.claimed = true;
                    } else if (winnerPool == 0) {
                        // 승자가 없는 경우 원금 환불
                        totalReward += bet.amount;
                        bet.claimed = true;
                    }
                }
            }
        }
        
        require(totalReward > 0, "No rewards to claim or already paid automatically");
        (bool success, ) = payable(msg.sender).call{value: totalReward}("");
        require(success, "Transfer failed");
        
        emit RewardClaimed(_contractId, msg.sender, totalReward);
    }
    
    // 미공개 베팅 환불
    function refundUnrevealedBet(uint256 _contractId) external nonReentrant {
        Contract storage cont = contracts[_contractId];
        require(block.timestamp >= cont.revealEndTime || cont.status == ContractStatus.Cancelled, "Not eligible for refund");
        
        Commitment storage commit = commitments[_contractId][msg.sender];
        require(commit.amount > 0, "No commitment found");
        require(!commit.revealed && !commit.cancelled, "Already processed");
        
        uint256 refundAmount = commit.amount;
        commit.amount = 0;
        commit.cancelled = true;
        
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");
    }
    
    // 통계 조회 함수들
    function getContractStats(uint256 _contractId) external view returns (
        uint256 totalBets,
        uint256 totalVolume,
        uint256 totalBettorsA,
        uint256 totalBettorsB,
        uint256 averageBetA,
        uint256 averageBetB
    ) {
        Contract memory cont = contracts[_contractId];
        Bet[] storage bets = contractBets[_contractId];
        
        uint256 countA;
        uint256 countB;
        
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].revealed) {
                totalBets++;
                totalVolume += bets[i].amount;
                
                if (bets[i].choice == Choice.A) {
                    countA++;
                } else {
                    countB++;
                }
            }
        }
        
        totalBettorsA = countA;
        totalBettorsB = countB;
        averageBetA = countA > 0 ? cont.totalPoolA / countA : 0;
        averageBetB = countB > 0 ? cont.totalPoolB / countB : 0;
    }
    
    function getPlatformStats() external view returns (
        uint256 totalContracts,
        uint256 totalBets,
        uint256 totalVolume,
        uint256 totalFeesCollected
    ) {
        return (
            platformStats.totalContracts,
            platformStats.totalBets,
            platformStats.totalVolume,
            platformStats.totalFeesCollected
        );
    }
    
    // 관리자 함수들
    function setPlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 10, "Fee too high");
        platformFeePercentage = _newFeePercentage;
        emit PlatformFeeUpdated(_newFeePercentage);
    }
    
    function setDefaultBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0 && _maxBet >= _minBet, "Invalid limits");
        defaultMinBet = _minBet;
        defaultMaxBet = _maxBet;
        emit DefaultBetLimitsUpdated(_minBet, _maxBet);
    }
    
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid address");
        feeRecipient = _newRecipient;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // 계약 기본 정보 조회
    function getContractBasic(uint256 _contractId) external view returns (
        address creator,
        string memory topic,
        string memory partyA,
        string memory partyB,
        uint256 bettingEndTime,
        uint256 revealEndTime,
        ContractStatus status
    ) {
        Contract memory cont = contracts[_contractId];
        return (
            cont.creator,
            cont.topic,
            cont.partyA,
            cont.partyB,
            cont.bettingEndTime,
            cont.revealEndTime,
            cont.status
        );
    }
    
    // 계약 베팅 정보 조회
    function getContractBetting(uint256 _contractId) external view returns (
        Choice winner,
        uint256 totalPoolA,
        uint256 totalPoolB,
        uint256 partyRewardPercentage,
        uint256 minBetAmount,
        uint256 maxBetAmount,
        uint256 totalBettors
    ) {
        Contract memory cont = contracts[_contractId];
        return (
            cont.winner,
            cont.totalPoolA,
            cont.totalPoolB,
            cont.partyRewardPercentage,
            cont.minBetAmount,
            cont.maxBetAmount,
            cont.totalBettors
        );
    }
    
    // 계약 전체 정보 조회 (구조체 반환)
    function getContract(uint256 _contractId) external view returns (Contract memory) {
        return contracts[_contractId];
    }
    
    function getUserBetsPaginated(
        uint256 _contractId, 
        address _user, 
        uint256 _offset, 
        uint256 _limit
    ) external view returns (
        uint256[] memory amounts,
        Choice[] memory choices,
        bool[] memory claimed,
        uint256 totalBets
    ) {
        uint256[] storage betIds = userBetsPerContract[_contractId][_user].betIds;
        Bet[] storage bets = contractBets[_contractId];
        
        totalBets = betIds.length;
        
        if (_limit > MAX_BETS_PER_PAGE) {
            _limit = MAX_BETS_PER_PAGE;
        }
        
        uint256 end = _offset + _limit;
        if (end > totalBets) {
            end = totalBets;
        }
        uint256 length = end > _offset ? end - _offset : 0;
        
        amounts = new uint256[](length);
        choices = new Choice[](length);
        claimed = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            Bet storage bet = bets[betIds[_offset + i]];
            amounts[i] = bet.amount;
            choices[i] = bet.choice;
            claimed[i] = bet.claimed;
        }
    }
    
    function generateCommitHash(
        uint256 _contractId,
        address _bettor,
        Choice _choice,
        uint256 _nonce,
        uint256 _amount
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_contractId, _bettor, _choice, _nonce, _amount));
    }
    
    function setOracle(address _newOracle) external {
        require(msg.sender == oracle || msg.sender == owner(), "Not authorized");
        oracle = _newOracle;
    }
    
    // 댓글 추가 함수 (베팅한 사람만 가능)
    function addComment(uint256 _contractId, string memory _content) external nonReentrant {
        require(contracts[_contractId].creator != address(0), "Contract does not exist");
        require(bytes(_content).length > 0, "Comment cannot be empty");
        require(bytes(_content).length <= 500, "Comment too long");
        require(hasUserBet(_contractId, msg.sender), "Must bet first to comment");
        
        contractComments[_contractId].push(Comment({
            commenter: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            likes: 0
        }));
        
        contracts[_contractId].totalComments++;
        
        emit CommentAdded(_contractId, msg.sender, _content);
    }
    
    // 사용자가 베팅했는지 확인하는 헬퍼 함수
    function hasUserBet(uint256 _contractId, address _user) public view returns (bool) {
        UserBets storage userBets = userBetsPerContract[_contractId][_user];
        return userBets.betIds.length > 0;
    }
    
    // 댓글 좋아요 함수
    function likeComment(uint256 _contractId, uint256 _commentId) external {
        require(contracts[_contractId].creator != address(0), "Contract does not exist");
        require(_commentId < contractComments[_contractId].length, "Comment does not exist");
        require(!commentLikes[_contractId][_commentId][msg.sender], "Already liked");
        
        commentLikes[_contractId][_commentId][msg.sender] = true;
        contractComments[_contractId][_commentId].likes++;
        
        emit CommentLiked(_contractId, _commentId, msg.sender);
    }
    
    // 댓글 조회 함수
    function getComments(uint256 _contractId, uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (
            Comment[] memory comments,
            uint256 totalComments
        ) 
    {
        Comment[] storage allComments = contractComments[_contractId];
        totalComments = allComments.length;
        
        if (_limit > 100) {
            _limit = 100; // 최대 100개까지만
        }
        
        uint256 end = _offset + _limit;
        if (end > totalComments) {
            end = totalComments;
        }
        
        uint256 length = end > _offset ? end - _offset : 0;
        comments = new Comment[](length);
        
        for (uint256 i = 0; i < length; i++) {
            comments[i] = allComments[_offset + i];
        }
    }
    
    // 베팅 가능 여부 확인
    function canBet(uint256 _contractId) external view returns (bool) {
        Contract memory cont = contracts[_contractId];
        return cont.status == ContractStatus.Active && 
               block.timestamp < cont.bettingEndTime;
    }
}