// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CommitXProtocol
 * @notice Web3 Accountability and Financial Staking Protocol.
 *         Participants deposit ETH stakes into challenges, submit activity proofs,
 *         and undergo peer verification. At completion, a cryptographically signed
 *         EIP-712 settlement attestation determines deterministic payouts.
 * @dev Enforces strict wei integer math, zero-qualifier treasury allocation,
 *      canonical participant ordering, settlement nonces, and pull-based withdrawals.
 *
 *      v2: every join pays a 0.125% protocol fee taken out of the stake. Fees accrue
 *      to the treasury balance (claimable by the treasury/admin at any time) and are
 *      never refunded. Challenges cannot be cancelled: if fewer than 2 people joined by
 *      the start time, a lone participant reclaims their stake minus the fee.
 *
 *      v3: the admin (owner) can lock an account after an upheld complaint (e.g. a
 *      validator approving invalid proof or rejecting valid proof). A locked account
 *      cannot withdraw payouts or refunds until the admin unlocks it. Funds are never
 *      moved by a lock — they stay claimable for when the lock is lifted.
 */
contract CommitXProtocol is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    // --- ENUMS & STRUCTS ---

    enum ChallengeStatus {
        OPEN,
        ACTIVE,
        VERIFICATION,
        FINALIZED,
        CANCELLED
    }

    struct Challenge {
        uint256 id;
        address creator;
        uint256 stakeAmount;            // Stake required per participant in wei
        uint16 totalPeriods;            // e.g. 30 periods
        uint8 qualificationThreshold;   // e.g. 50 (for 50%)
        uint32 startTime;               // Unix timestamp
        uint32 endTime;                 // Unix timestamp
        uint32 verificationDuration;    // Seconds after endTime for peer verification
        uint16 maxParticipants;         // Participant capacity
        uint16 participantCount;        // Current enrolled participants
        uint256 settlementNonce;        // Incremented nonce for EIP-712 replay protection
        ChallengeStatus status;
        bool finalized;
        bool isPrivate;                 // Public vs Private challenge
        string metadataURI;             // IPFS / decentralized metadata URI
    }

    // --- EIP-712 TYPEHASHES ---

    bytes32 public constant SETTLEMENT_TYPEHASH = keccak256(
        "Settlement(uint256 challengeId,uint256 settlementNonce,address[] participants,uint256[] completedPeriods)"
    );

    bytes32 public constant INVITATION_TYPEHASH = keccak256(
        "Invitation(uint256 challengeId,address participant)"
    );

    // --- PROTOCOL FEE ---

    /// @notice Joining fee: 125 / 100000 = 0.125% of the stake, taken out of the stake.
    uint256 public constant FEE_NUMERATOR = 125;
    uint256 public constant FEE_DENOMINATOR = 100_000;

    // --- PROTOCOL ROLES & ADDRESSES ---

    address public protocolAttestor;    // Protocol key authorized to sign EIP-712 settlement digests
    address public treasury;            // Protocol treasury receiving penalty pool / dust allocations

    // --- GLOBAL PROTOCOL ACCOUNTING ---

    uint256 public immutable firstChallengeId; // IDs start here so a redeploy never collides with older contracts
    uint256 public nextChallengeId;
    uint256 public treasuryBalance;     // Treasury funds in wei: joining fees + zero-qualifier pools + dust
    uint256 public totalFeesCollected;  // All-time joining fees in wei
    uint256 public totalDeposited;      // All-time deposited ETH in wei
    uint256 public totalSettledAmount;  // Total settled challenge funds in wei
    uint256 public totalWithdrawnAmount;// Total withdrawn ETH in wei

    // --- STORAGE MAPPINGS ---

    // challengeId => Challenge
    mapping(uint256 => Challenge) public challenges;

    // challengeId => participantAddress => isEnrolled
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    // challengeId => index => participantAddress
    mapping(uint256 => mapping(uint256 => address)) public challengeParticipants;

    // challengeId => participantAddress => claimableAmount in wei
    mapping(uint256 => mapping(address => uint256)) public claimable;

    // challengeId => participantAddress => hasWithdrawn
    mapping(uint256 => mapping(address => bool)) public hasWithdrawn;

    // challengeId => participantAddress => isWhitelisted (for private challenges)
    mapping(uint256 => mapping(address => bool)) public isWhitelisted;

    // account => locked by admin (blocks withdrawals and refunds)
    mapping(address => bool) public isLocked;

    // --- EVENTS ---

    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed creator,
        uint256 stakeAmount,
        uint16 totalPeriods,
        uint8 qualificationThreshold,
        uint32 startTime,
        uint32 endTime,
        uint16 maxParticipants,
        bool isPrivate,
        string metadataURI
    );

    event ParticipantJoined(
        uint256 indexed challengeId,
        address indexed participant,
        uint256 stakeDeposited
    );

    event ParticipantWhitelisted(
        uint256 indexed challengeId,
        address indexed participant
    );

    event ParticipantUnwhitelisted(
        uint256 indexed challengeId,
        address indexed participant
    );

    event ChallengeFinalized(
        uint256 indexed challengeId,
        uint256 settlementNonce,
        uint256 totalPenaltyPool,
        uint256 totalRewardDistributed,
        uint256 qualifiersCount,
        uint256 treasuryCut
    );

    event AccountLockChanged(
        address indexed account,
        bool locked,
        string reason
    );

    event FeeCollected(
        uint256 indexed challengeId,
        address indexed participant,
        uint256 fee
    );

    event UnderfilledRefund(
        uint256 indexed challengeId,
        address indexed participant,
        uint256 amount
    );

    event FundsWithdrawn(
        uint256 indexed challengeId,
        address indexed participant,
        uint256 amount
    );

    event TreasuryWithdrawn(
        address indexed treasury,
        uint256 amount
    );

    event ProtocolAttestorUpdated(
        address indexed previousAttestor,
        address indexed newAttestor
    );

    event TreasuryUpdated(
        address indexed previousTreasury,
        address indexed newTreasury
    );

    // --- CONSTRUCTOR ---

    constructor(
        address _protocolAttestor,
        address _treasury,
        uint256 _firstChallengeId
    ) EIP712("CommitX", "1") Ownable(msg.sender) {
        require(_protocolAttestor != address(0), "Invalid attestor address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_firstChallengeId > 0, "First challenge id must be > 0");
        protocolAttestor = _protocolAttestor;
        treasury = _treasury;
        firstChallengeId = _firstChallengeId;
        nextChallengeId = _firstChallengeId;
    }

    // --- FEE HELPERS ---

    /// @notice Protocol fee charged on a stake of `stakeAmount` wei.
    function feeFor(uint256 stakeAmount) public pure returns (uint256) {
        return (stakeAmount * FEE_NUMERATOR) / FEE_DENOMINATOR;
    }

    /// @notice Stake that counts toward settlement after the joining fee.
    function netStake(uint256 challengeId) public view returns (uint256) {
        uint256 stake = challenges[challengeId].stakeAmount;
        return stake - feeFor(stake);
    }

    // --- CORE EXTERNAL FUNCTIONS ---

    /**
     * @notice Creates a new accountability challenge.
     * @dev Creator can optionally stake and join as the first participant by sending exact `stakeAmount`.
     */
    function createChallenge(
        uint256 stakeAmount,
        uint16 totalPeriods,
        uint8 qualificationThreshold,
        uint32 startTime,
        uint32 endTime,
        uint32 verificationDuration,
        uint16 maxParticipants,
        bool isPrivate,
        string calldata metadataURI
    ) external payable returns (uint256) {
        require(stakeAmount > 0, "Stake must be greater than 0");
        require(totalPeriods > 0, "Total periods must be > 0");
        require(qualificationThreshold > 0 && qualificationThreshold <= 100, "Threshold must be 1-100");
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");
        require(verificationDuration > 0, "Verification duration must be > 0");
        require(maxParticipants >= 2, "Max participants must be at least 2");

        uint256 challengeId = nextChallengeId++;

        Challenge storage c = challenges[challengeId];
        c.id = challengeId;
        c.creator = msg.sender;
        c.stakeAmount = stakeAmount;
        c.totalPeriods = totalPeriods;
        c.qualificationThreshold = qualificationThreshold;
        c.startTime = startTime;
        c.endTime = endTime;
        c.verificationDuration = verificationDuration;
        c.maxParticipants = maxParticipants;
        c.settlementNonce = 1;
        c.status = ChallengeStatus.OPEN;
        c.isPrivate = isPrivate;
        c.metadataURI = metadataURI;

        emit ChallengeCreated(
            challengeId,
            msg.sender,
            stakeAmount,
            totalPeriods,
            qualificationThreshold,
            startTime,
            endTime,
            maxParticipants,
            isPrivate,
            metadataURI
        );

        // If creator provided exact stake, enroll them automatically
        if (msg.value > 0) {
            require(msg.value == stakeAmount, "Must send exact stake to join");
            _join(challengeId, msg.sender);
        }

        return challengeId;
    }

    /**
     * @notice Whitelists participant addresses for a private challenge.
     * @dev Only callable by the challenge creator while challenge is OPEN.
     */
    function whitelistParticipants(uint256 challengeId, address[] calldata accounts) external {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(msg.sender == c.creator, "Only creator can whitelist");
        require(c.status == ChallengeStatus.OPEN, "Challenge not open");

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(account != address(0), "Invalid address");
            isWhitelisted[challengeId][account] = true;
            emit ParticipantWhitelisted(challengeId, account);
        }
    }

    /**
     * @notice Revokes a previously whitelisted address for a private challenge.
     * @dev Only callable by the challenge creator while challenge is OPEN.
     */
    function revokeWhitelist(uint256 challengeId, address account) external {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(msg.sender == c.creator, "Only creator can revoke whitelist");
        require(c.status == ChallengeStatus.OPEN, "Challenge not open");

        isWhitelisted[challengeId][account] = false;
        emit ParticipantUnwhitelisted(challengeId, account);
    }

    /**
     * @notice Enrolls the caller into an open challenge by depositing the required stake.
     */
    function joinChallenge(uint256 challengeId) external payable {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(c.status == ChallengeStatus.OPEN, "Challenge not open");
        require(block.timestamp < c.startTime, "Challenge already started");
        require(c.participantCount < c.maxParticipants, "Challenge full");
        require(!isParticipant[challengeId][msg.sender], "Already joined");
        if (c.isPrivate) {
            require(
                isWhitelisted[challengeId][msg.sender] || msg.sender == c.creator,
                "Not authorized to join private challenge"
            );
        }
        require(msg.value == c.stakeAmount, "Incorrect stake amount");

        _join(challengeId, msg.sender);
    }

    /**
     * @notice Enrolls the caller into a private challenge using a signed EIP-712 invitation.
     * @param challengeId ID of the private challenge.
     * @param signature EIP-712 invitation signature signed by creator or protocolAttestor.
     */
    function joinChallengeWithAuthorization(uint256 challengeId, bytes calldata signature) external payable {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(c.status == ChallengeStatus.OPEN, "Challenge not open");
        require(block.timestamp < c.startTime, "Challenge already started");
        require(c.participantCount < c.maxParticipants, "Challenge full");
        require(!isParticipant[challengeId][msg.sender], "Already joined");
        require(msg.value == c.stakeAmount, "Incorrect stake amount");

        // Verify authorization signature
        bytes32 structHash = keccak256(
            abi.encode(INVITATION_TYPEHASH, challengeId, msg.sender)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(
            signer == c.creator || signer == protocolAttestor,
            "Invalid invitation signature"
        );

        _join(challengeId, msg.sender);
    }

    /**
     * @dev Internal helper for joining a challenge.
     */
    function _join(uint256 challengeId, address participant) internal {
        Challenge storage c = challenges[challengeId];
        isParticipant[challengeId][participant] = true;
        challengeParticipants[challengeId][c.participantCount] = participant;
        c.participantCount++;
        totalDeposited += c.stakeAmount;

        // Joining fee is taken out of the stake and is non-refundable
        uint256 fee = feeFor(c.stakeAmount);
        if (fee > 0) {
            treasuryBalance += fee;
            totalFeesCollected += fee;
            emit FeeCollected(challengeId, participant, fee);
        }

        emit ParticipantJoined(challengeId, participant, c.stakeAmount);
    }

    /**
     * @notice A challenge that reached its start time with fewer than 2 participants cannot
     *         run (nobody could verify the lone participant). That participant reclaims their
     *         stake minus the non-refundable joining fee. There is no cancellation.
     */
    function claimUnderfilledRefund(uint256 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(block.timestamp >= c.startTime, "Challenge has not started");
        require(c.participantCount < 2, "Challenge has enough participants");
        require(isParticipant[challengeId][msg.sender], "Not a participant");
        require(!hasWithdrawn[challengeId][msg.sender], "Already refunded");
        require(!isLocked[msg.sender], "Account locked by admin");

        uint256 amount = netStake(challengeId);

        hasWithdrawn[challengeId][msg.sender] = true;
        c.status = ChallengeStatus.CANCELLED;
        totalWithdrawnAmount += amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit UnderfilledRefund(challengeId, msg.sender, amount);
    }

    /**
     * @notice Finalizes a challenge using an authorized EIP-712 settlement attestation.
     * @dev Validates canonical participant ordering, enrolled membership, completed periods,
     *      EIP-712 signature, and performs exact wei mathematical settlement.
     * @param challengeId ID of the challenge to finalize.
     * @param settlementNonce The expected settlement nonce matching challenge state.
     * @param participants Array of participant addresses in strictly ASCENDING order.
     * @param completedPeriods Array of verified completed periods corresponding to participants.
     * @param signature Cryptographic EIP-712 signature from the protocolAttestor.
     */
    function finalizeChallenge(
        uint256 challengeId,
        uint256 settlementNonce,
        address[] calldata participants,
        uint256[] calldata completedPeriods,
        bytes calldata signature
    ) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.id != 0, "Challenge does not exist");
        require(!c.finalized, "Challenge already finalized");
        require(c.status != ChallengeStatus.CANCELLED, "Challenge was cancelled");
        require(block.timestamp >= c.endTime, "Challenge still ongoing");
        require(settlementNonce == c.settlementNonce, "Invalid settlement nonce");
        require(participants.length == completedPeriods.length, "Array length mismatch");
        require(participants.length == c.participantCount, "Participant count mismatch");
        require(c.participantCount >= 2, "Not enough participants to settle");

        // Validate canonical ascending ordering, enrolled status, and period constraints
        address lastParticipant = address(0);
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            require(p > lastParticipant, "Non-canonical or duplicate participant address");
            require(isParticipant[challengeId][p], "Not an enrolled participant");
            require(completedPeriods[i] <= c.totalPeriods, "Completed periods exceeds total");
            lastParticipant = p;
        }

        // Validate EIP-712 settlement signature
        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_TYPEHASH,
                challengeId,
                settlementNonce,
                _hashAddresses(participants),
                _hashUint256s(completedPeriods)
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == protocolAttestor, "Invalid protocol attestor signature");

        // --- EXACT WEI FINANCIAL CALCULATION ---

        uint256 stake = netStake(challengeId);  // settlement runs on the post-fee stake
        uint256 totalPeriods = c.totalPeriods;
        uint256 threshold = c.qualificationThreshold;
        uint256 n = participants.length;

        uint256 totalPenaltyPool = 0;
        uint256 qualifyingWeightSum = 0;
        uint256 qualifiersCount = 0;

        uint256[] memory retainedAmounts = new uint256[](n);
        bool[] memory qualifies = new bool[](n);

        // Step 1: Compute retained stakes and penalty pool
        for (uint256 i = 0; i < n; i++) {
            uint256 cPeriods = completedPeriods[i];
            uint256 retained = (stake * cPeriods) / totalPeriods;
            uint256 penalty = stake - retained;

            retainedAmounts[i] = retained;
            totalPenaltyPool += penalty;

            // Step 2: Strict threshold comparison: completedPeriods * 100 >= threshold * totalPeriods
            if (cPeriods * 100 >= threshold * totalPeriods) {
                qualifies[i] = true;
                qualifyingWeightSum += cPeriods;
                qualifiersCount++;
            }
        }

        uint256 totalRewardDistributed = 0;
        uint256 treasuryCut = 0;

        // Step 3: Zero-Qualifier Rule vs Proportional Reward Distribution
        if (qualifiersCount == 0 || qualifyingWeightSum == 0) {
            // ZERO-QUALIFIER RULE:
            // Nobody receives performance rewards. Participants retain only completion-based stake.
            // 100% of penalty pool goes to Protocol Treasury!
            treasuryCut = totalPenaltyPool;
            treasuryBalance += treasuryCut;

            for (uint256 i = 0; i < n; i++) {
                claimable[challengeId][participants[i]] = retainedAmounts[i];
            }
        } else {
            // One or more participants qualified:
            // Distribute penalty pool proportionally based on completion weight
            for (uint256 i = 0; i < n; i++) {
                address p = participants[i];
                uint256 reward = 0;

                if (qualifies[i]) {
                    reward = (totalPenaltyPool * completedPeriods[i]) / qualifyingWeightSum;
                    totalRewardDistributed += reward;
                }

                claimable[challengeId][p] = retainedAmounts[i] + reward;
            }

            // Integer division dust goes to treasury
            treasuryCut = totalPenaltyPool - totalRewardDistributed;
            treasuryBalance += treasuryCut;
        }

        // Finalize challenge state
        c.finalized = true;
        c.status = ChallengeStatus.FINALIZED;
        c.settlementNonce++;
        totalSettledAmount += stake * n;

        emit ChallengeFinalized(
            challengeId,
            settlementNonce,
            totalPenaltyPool,
            totalRewardDistributed,
            qualifiersCount,
            treasuryCut
        );
    }

    /**
     * @notice Pull-based withdrawal of claimable funds by a participant.
     * @dev Checks-Effects-Interactions pattern with ReentrancyGuard.
     */
    function withdraw(uint256 challengeId) external nonReentrant {
        require(!isLocked[msg.sender], "Account locked by admin");
        uint256 amount = claimable[challengeId][msg.sender];
        require(amount > 0, "No funds claimable");

        claimable[challengeId][msg.sender] = 0;
        hasWithdrawn[challengeId][msg.sender] = true;
        totalWithdrawnAmount += amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit FundsWithdrawn(challengeId, msg.sender, amount);
    }

    /**
     * @notice Pull-based withdrawal of protocol treasury balance.
     * @dev Only callable by the configured treasury address.
     */
    function withdrawTreasury(uint256 amount) external nonReentrant {
        require(msg.sender == treasury, "Only treasury can withdraw");
        require(amount > 0, "Amount must be > 0");
        require(amount <= treasuryBalance, "Amount exceeds treasury balance");

        treasuryBalance -= amount;
        totalWithdrawnAmount += amount;

        (bool success, ) = payable(treasury).call{value: amount}("");
        require(success, "Treasury transfer failed");

        emit TreasuryWithdrawn(treasury, amount);
    }

    // --- VIEW / READ FUNCTIONS ---

    /**
     * @notice Returns challenge configuration and status.
     */
    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    /**
     * @notice Returns an array of enrolled participant addresses for a challenge.
     */
    function getChallengeParticipants(uint256 challengeId) external view returns (address[] memory) {
        Challenge storage c = challenges[challengeId];
        address[] memory pList = new address[](c.participantCount);
        for (uint256 i = 0; i < c.participantCount; i++) {
            pList[i] = challengeParticipants[challengeId][i];
        }
        return pList;
    }

    /**
     * @notice Returns current dynamic lifecycle status of a challenge.
     */
    function getCurrentStatus(uint256 challengeId) external view returns (ChallengeStatus) {
        Challenge storage c = challenges[challengeId];
        if (c.finalized) return ChallengeStatus.FINALIZED;
        if (c.status == ChallengeStatus.CANCELLED) return ChallengeStatus.CANCELLED;

        if (block.timestamp < c.startTime) {
            return ChallengeStatus.OPEN;
        } else if (block.timestamp < c.endTime) {
            return ChallengeStatus.ACTIVE;
        } else {
            return ChallengeStatus.VERIFICATION;
        }
    }

    /**
     * @notice Returns protocol-wide high-level metrics for transparency.
     */
    function getProtocolStats() external view returns (
        uint256 _totalChallenges,
        uint256 _totalDeposited,
        uint256 _totalSettledAmount,
        uint256 _totalWithdrawnAmount,
        uint256 _treasuryBalance,
        uint256 _contractBalance,
        uint256 _totalFeesCollected
    ) {
        return (
            nextChallengeId - firstChallengeId,
            totalDeposited,
            totalSettledAmount,
            totalWithdrawnAmount,
            treasuryBalance,
            address(this).balance,
            totalFeesCollected
        );
    }

    // --- PROTOCOL ADMINISTRATION ---

    function setProtocolAttestor(address _newAttestor) external onlyOwner {
        require(_newAttestor != address(0), "Invalid attestor address");
        emit ProtocolAttestorUpdated(protocolAttestor, _newAttestor);
        protocolAttestor = _newAttestor;
    }

    /**
     * @notice Locks or unlocks an account's withdrawals. Admin-only, used after a complaint
     *         against the account is upheld. Balances are untouched while locked.
     */
    function setAccountLock(address account, bool locked, string calldata reason) external onlyOwner {
        require(account != address(0), "Invalid account");
        isLocked[account] = locked;
        emit AccountLockChanged(account, locked, reason);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    // --- INTERNAL EIP-712 ARRAY HASHERS ---

    /**
     * @dev Deterministically hashes an address array according to EIP-712 specification.
     *      Each address is encoded as a 32-byte word (bytes32(uint256(uint160(address)))).
     */
    function _hashAddresses(address[] calldata addrs) internal pure returns (bytes32) {
        bytes32[] memory encoded = new bytes32[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            encoded[i] = bytes32(uint256(uint160(addrs[i])));
        }
        return keccak256(abi.encodePacked(encoded));
    }

    /**
     * @dev Deterministically hashes a uint256 array according to EIP-712 specification.
     *      Each uint256 is naturally a 32-byte word.
     */
    function _hashUint256s(uint256[] calldata uints) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(uints));
    }
}
