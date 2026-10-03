const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CommitXProtocol", function () {
  let protocol;
  let owner, attestor, treasury, alice, bob, charlie, dave, eve;
  let domain;

  const STAKE = ethers.parseEther("0.1"); // 0.1 ETH
  const FEE = (STAKE * 125n) / 100000n; // 0.125% joining fee, taken out of the stake
  const NET = STAKE - FEE; // stake that counts toward settlement
  const TOTAL_PERIODS = 10;
  const THRESHOLD = 50; // 50%
  const VERIFICATION_DURATION = 3600; // 1 hour

  // EIP-712 Types definition matching contract
  const settlementTypes = {
    Settlement: [
      { name: "challengeId", type: "uint256" },
      { name: "settlementNonce", type: "uint256" },
      { name: "participants", type: "address[]" },
      { name: "completedPeriods", type: "uint256[]" },
    ],
  };

  const invitationTypes = {
    Invitation: [
      { name: "challengeId", type: "uint256" },
      { name: "participant", type: "address" },
    ],
  };

  beforeEach(async function () {
    [owner, attestor, treasury, alice, bob, charlie, dave, eve] = await ethers.getSigners();

    const CommitXProtocol = await ethers.getContractFactory("CommitXProtocol");
    protocol = await CommitXProtocol.deploy(attestor.address, treasury.address, 1);
    await protocol.waitForDeployment();

    const contractAddress = await protocol.getAddress();
    const network = await ethers.provider.getNetwork();

    domain = {
      name: "CommitX",
      version: "1",
      chainId: network.chainId,
      verifyingContract: contractAddress,
    };
  });

  describe("1. Deployment & Roles", function () {
    it("Should set correct attestor and treasury", async function () {
      expect(await protocol.protocolAttestor()).to.equal(attestor.address);
      expect(await protocol.treasury()).to.equal(treasury.address);
      expect(await protocol.owner()).to.equal(owner.address);
    });

    it("Should allow owner to update attestor and treasury", async function () {
      await protocol.setProtocolAttestor(eve.address);
      expect(await protocol.protocolAttestor()).to.equal(eve.address);

      await protocol.setTreasury(eve.address);
      expect(await protocol.treasury()).to.equal(eve.address);
    });

    it("Should reject non-owner updating roles", async function () {
      await expect(
        protocol.connect(alice).setProtocolAttestor(alice.address)
      ).to.be.revertedWithCustomError(protocol, "OwnableUnauthorizedAccount");
    });
  });

  describe("2. Challenge Creation", function () {
    it("Should create a public challenge without auto-joining", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const endTime = startTime + 10 * 86400;

      const tx = await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        10,
        false, // isPrivate = false
        "ipfs://QmChallengeMeta1"
      );

      await expect(tx)
        .to.emit(protocol, "ChallengeCreated")
        .withArgs(
          1,
          alice.address,
          STAKE,
          TOTAL_PERIODS,
          THRESHOLD,
          startTime,
          endTime,
          10,
          false,
          "ipfs://QmChallengeMeta1"
        );

      const challenge = await protocol.getChallenge(1);
      expect(challenge.creator).to.equal(alice.address);
      expect(challenge.stakeAmount).to.equal(STAKE);
      expect(challenge.participantCount).to.equal(0);
      expect(challenge.status).to.equal(0); // OPEN
      expect(challenge.isPrivate).to.be.false;
    });

    it("Should create a challenge and auto-join when exact stake is sent", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const endTime = startTime + 10 * 86400;

      const tx = await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        10,
        false,
        "ipfs://QmChallengeMeta2",
        { value: STAKE }
      );

      await expect(tx)
        .to.emit(protocol, "ParticipantJoined")
        .withArgs(1, alice.address, STAKE);

      const challenge = await protocol.getChallenge(1);
      expect(challenge.participantCount).to.equal(1);
      expect(await protocol.isParticipant(1, alice.address)).to.be.true;
    });

    it("Should revert if invalid parameters are provided", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const endTime = startTime + 1000;

      // 0 stake
      await expect(
        protocol.createChallenge(0, 10, 50, startTime, endTime, 3600, 10, false, "")
      ).to.be.revertedWith("Stake must be greater than 0");

      // 0 periods
      await expect(
        protocol.createChallenge(STAKE, 0, 50, startTime, endTime, 3600, 10, false, "")
      ).to.be.revertedWith("Total periods must be > 0");

      // threshold > 100
      await expect(
        protocol.createChallenge(STAKE, 10, 101, startTime, endTime, 3600, 10, false, "")
      ).to.be.revertedWith("Threshold must be 1-100");

      // start time in past
      await expect(
        protocol.createChallenge(STAKE, 10, 50, now - 10, endTime, 3600, 10, false, "")
      ).to.be.revertedWith("Start time must be in future");

      // max participants < 2
      await expect(
        protocol.createChallenge(STAKE, 10, 50, startTime, endTime, 3600, 1, false, "")
      ).to.be.revertedWith("Max participants must be at least 2");
    });
  });

  describe("3. Challenge Participation", function () {
    let challengeId, startTime, endTime;

    beforeEach(async function () {
      const now = await time.latest();
      startTime = now + 1000;
      endTime = startTime + 10 * 86400;

      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        3, // max 3
        false,
        "ipfs://QmChallengeMeta",
        { value: STAKE }
      );
      challengeId = 1;
    });

    it("Should allow participants to join with exact stake", async function () {
      await expect(
        protocol.connect(bob).joinChallenge(challengeId, { value: STAKE })
      )
        .to.emit(protocol, "ParticipantJoined")
        .withArgs(challengeId, bob.address, STAKE);

      expect(await protocol.isParticipant(challengeId, bob.address)).to.be.true;
      const challenge = await protocol.getChallenge(challengeId);
      expect(challenge.participantCount).to.equal(2);
    });

    it("Should reject joining with incorrect stake amount", async function () {
      await expect(
        protocol.connect(bob).joinChallenge(challengeId, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Incorrect stake amount");
    });

    it("Should reject duplicate join", async function () {
      await expect(
        protocol.connect(alice).joinChallenge(challengeId, { value: STAKE })
      ).to.be.revertedWith("Already joined");
    });

    it("Should reject joining when challenge is full", async function () {
      await protocol.connect(bob).joinChallenge(challengeId, { value: STAKE });
      await protocol.connect(charlie).joinChallenge(challengeId, { value: STAKE });

      // Alice, Bob, Charlie enrolled => 3 / 3 capacity reached
      await expect(
        protocol.connect(dave).joinChallenge(challengeId, { value: STAKE })
      ).to.be.revertedWith("Challenge full");
    });

    it("Should reject joining after start time", async function () {
      await time.increaseTo(startTime + 1);
      await expect(
        protocol.connect(bob).joinChallenge(challengeId, { value: STAKE })
      ).to.be.revertedWith("Challenge already started");
    });
  });

  describe("4. Under-filled Challenges (no cancellation)", function () {
    let startTime, endTime;

    beforeEach(async function () {
      const now = await time.latest();
      startTime = now + 1000;
      endTime = startTime + 10 * 86400;
      await protocol.connect(alice).createChallenge(
        STAKE, TOTAL_PERIODS, THRESHOLD, startTime, endTime, VERIFICATION_DURATION, 5, false, "ipfs://meta",
        { value: STAKE }
      );
    });

    it("Should have no cancel function", async function () {
      expect(protocol.cancelChallenge).to.equal(undefined);
    });

    it("Should refund a lone participant their stake minus the non-refundable fee", async function () {
      await time.increaseTo(startTime + 10);

      const before = await ethers.provider.getBalance(alice.address);
      const tx = await protocol.connect(alice).claimUnderfilledRefund(1);
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      await expect(tx).to.emit(protocol, "UnderfilledRefund").withArgs(1, alice.address, NET);

      const after = await ethers.provider.getBalance(alice.address);
      expect(after + gas - before).to.equal(NET);
      expect(await protocol.treasuryBalance()).to.equal(FEE); // fee kept
      expect(await protocol.getCurrentStatus(1)).to.equal(4); // CANCELLED (closed)
      expect(await ethers.provider.getBalance(await protocol.getAddress())).to.equal(FEE);

      await expect(protocol.connect(alice).claimUnderfilledRefund(1)).to.be.revertedWith("Already refunded");
    });

    it("Should reject refund before the start time", async function () {
      await expect(protocol.connect(alice).claimUnderfilledRefund(1)).to.be.revertedWith("Challenge has not started");
    });

    it("Should reject refund from a non-participant", async function () {
      await time.increaseTo(startTime + 10);
      await expect(protocol.connect(bob).claimUnderfilledRefund(1)).to.be.revertedWith("Not a participant");
    });

    it("Should reject refund once 2+ people joined", async function () {
      await protocol.connect(bob).joinChallenge(1, { value: STAKE });
      await time.increaseTo(startTime + 10);
      await expect(protocol.connect(alice).claimUnderfilledRefund(1)).to.be.revertedWith(
        "Challenge has enough participants"
      );
    });

    it("Should refuse to settle an under-filled challenge", async function () {
      await time.increaseTo(endTime + 10);
      const data = { challengeId: 1n, settlementNonce: 1n, participants: [alice.address], completedPeriods: [0n] };
      const sig = await attestor.signTypedData(domain, settlementTypes, data);
      await expect(protocol.finalizeChallenge(1, 1, [alice.address], [0], sig)).to.be.revertedWith(
        "Not enough participants to settle"
      );
    });
  });

  describe("5. EIP-712 Settlement Attestation & Canonical Sorting", function () {
    let challengeId, startTime, endTime;
    let sortedUsers;

    beforeEach(async function () {
      const now = await time.latest();
      startTime = now + 1000;
      endTime = startTime + TOTAL_PERIODS * 86400;

      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        10,
        false,
        "ipfs://meta",
        { value: STAKE }
      );
      challengeId = 1;

      await protocol.connect(bob).joinChallenge(challengeId, { value: STAKE });
      await protocol.connect(charlie).joinChallenge(challengeId, { value: STAKE });
      await protocol.connect(dave).joinChallenge(challengeId, { value: STAKE });

      sortedUsers = [alice, bob, charlie, dave].sort((a, b) =>
        a.address.toLowerCase().localeCompare(b.address.toLowerCase())
      );
    });

    it("Should reject finalization before challenge endTime", async function () {
      const addresses = sortedUsers.map((u) => u.address);
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      ).to.be.revertedWith("Challenge still ongoing");
    });

    it("Should reject non-canonical (unsorted) participant addresses", async function () {
      await time.increaseTo(endTime + 10);

      const unsorted = [...sortedUsers].reverse();
      const addresses = unsorted.map((u) => u.address);
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      ).to.be.revertedWith("Non-canonical or duplicate participant address");
    });

    it("Should reject duplicate participant addresses in settlement", async function () {
      await time.increaseTo(endTime + 10);

      const addresses = [sortedUsers[0].address, sortedUsers[0].address, sortedUsers[2].address, sortedUsers[3].address];
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      ).to.be.revertedWith("Non-canonical or duplicate participant address");
    });

    it("Should reject unauthorized attestor signature", async function () {
      await time.increaseTo(endTime + 10);

      const addresses = sortedUsers.map((u) => u.address);
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const forgedSignature = await eve.signTypedData(domain, settlementTypes, settlementData);

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, forgedSignature)
      ).to.be.revertedWith("Invalid protocol attestor signature");
    });

    it("Should reject replay of already finalized settlement", async function () {
      await time.increaseTo(endTime + 10);

      const addresses = sortedUsers.map((u) => u.address);
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);

      await protocol.finalizeChallenge(1, 1, addresses, completed, signature);

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      ).to.be.revertedWith("Challenge already finalized");
    });
  });

  describe("6. Mathematical Settlement & Invariant Conservation", function () {
    let challengeId, endTime;
    let sortedUsers;

    beforeEach(async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      endTime = startTime + TOTAL_PERIODS * 86400;

      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        10,
        false,
        "ipfs://meta",
        { value: STAKE }
      );
      challengeId = 1;

      await protocol.connect(bob).joinChallenge(challengeId, { value: STAKE });
      await protocol.connect(charlie).joinChallenge(challengeId, { value: STAKE });
      await protocol.connect(dave).joinChallenge(challengeId, { value: STAKE });

      sortedUsers = [alice, bob, charlie, dave].sort((a, b) =>
        a.address.toLowerCase().localeCompare(b.address.toLowerCase())
      );
    });

    it("Should settle correctly with qualifiers and satisfy wei conservation invariant", async function () {
      await time.increaseTo(endTime + 10);

      const addresses = sortedUsers.map((u) => u.address);
      const completed = [10, 9, 7, 2];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);
      const initialTreasury = await protocol.treasuryBalance();

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      ).to.emit(protocol, "ChallengeFinalized");

      const claimable0 = await protocol.claimable(1, addresses[0]);
      const claimable1 = await protocol.claimable(1, addresses[1]);
      const claimable2 = await protocol.claimable(1, addresses[2]);
      const claimable3 = await protocol.claimable(1, addresses[3]);

      expect(claimable0).to.be.gt(ethers.parseEther("0.1"));
      expect(claimable3).to.equal((NET * 2n) / 10n);

      const finalTreasury = await protocol.treasuryBalance();
      const treasuryGain = finalTreasury - initialTreasury;

      // CONSERVATION INVARIANT TEST (WEI PRECISION):
      // Net stakes are fully distributed; the 4 joining fees were credited at join time
      const totalClaimable = claimable0 + claimable1 + claimable2 + claimable3;
      expect(totalClaimable + treasuryGain).to.equal(NET * 4n);
      expect(totalClaimable + treasuryGain + FEE * 4n).to.equal(STAKE * 4n);

      // Pull-based withdrawal execution
      for (const user of sortedUsers) {
        const balBefore = await ethers.provider.getBalance(user.address);
        const toClaim = await protocol.claimable(1, user.address);
        const tx = await protocol.connect(user).withdraw(1);
        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const balAfter = await ethers.provider.getBalance(user.address);

        expect(balAfter + gasCost - balBefore).to.equal(toClaim);
        expect(await protocol.claimable(1, user.address)).to.equal(0n);
      }
    });

    it("Should enforce Zero-Qualifier Rule: 100% of penalty pool to treasury when nobody qualifies", async function () {
      await time.increaseTo(endTime + 10);

      const addresses = sortedUsers.map((u) => u.address);
      const completed = [4, 3, 2, 1];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);
      const initialTreasury = await protocol.treasuryBalance();

      await expect(
        protocol.finalizeChallenge(1, 1, addresses, completed, signature)
      )
        .to.emit(protocol, "ChallengeFinalized")
        .withArgs(1, 1, NET * 3n, 0n, 0, NET * 3n);

      expect(await protocol.claimable(1, addresses[0])).to.equal((NET * 4n) / 10n);
      expect(await protocol.claimable(1, addresses[1])).to.equal((NET * 3n) / 10n);
      expect(await protocol.claimable(1, addresses[2])).to.equal((NET * 2n) / 10n);
      expect(await protocol.claimable(1, addresses[3])).to.equal((NET * 1n) / 10n);

      const finalTreasury = await protocol.treasuryBalance();
      expect(finalTreasury - initialTreasury).to.equal(NET * 3n);

      const totalClaimable =
        (await protocol.claimable(1, addresses[0])) +
        (await protocol.claimable(1, addresses[1])) +
        (await protocol.claimable(1, addresses[2])) +
        (await protocol.claimable(1, addresses[3]));
      expect(totalClaimable + (finalTreasury - initialTreasury)).to.equal(NET * 4n);
    });
  });

  describe("7. Treasury Withdrawals", function () {
    it("Should allow only treasury address to withdraw treasury balance", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const endTime = startTime + 10 * 86400;

      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        2,
        false,
        "ipfs://meta",
        { value: STAKE }
      );
      await protocol.connect(bob).joinChallenge(1, { value: STAKE });

      await time.increaseTo(endTime + 10);

      const sorted = [alice, bob].sort((a, b) =>
        a.address.toLowerCase().localeCompare(b.address.toLowerCase())
      );
      const addresses = sorted.map((u) => u.address);
      const completed = [0, 0];

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: [0n, 0n],
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);
      await protocol.finalizeChallenge(1, 1, addresses, completed, signature);

      const treasuryBalance = await protocol.treasuryBalance();
      expect(treasuryBalance).to.equal(STAKE * 2n);

      await expect(
        protocol.connect(alice).withdrawTreasury(treasuryBalance)
      ).to.be.revertedWith("Only treasury can withdraw");

      const balBefore = await ethers.provider.getBalance(treasury.address);
      const tx = await protocol.connect(treasury).withdrawTreasury(treasuryBalance);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(treasury.address);

      expect(balAfter + gasCost - balBefore).to.equal(treasuryBalance);
      expect(await protocol.treasuryBalance()).to.equal(0n);
    });
  });

  describe("8. Public vs Private Challenges & Access Control", function () {
    let startTime, endTime;

    beforeEach(async function () {
      const now = await time.latest();
      startTime = now + 1000;
      endTime = startTime + 10 * 86400;
    });

    it("Should allow anyone to join a public challenge", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        false, // public
        "ipfs://public",
        { value: STAKE }
      );

      // Any random user can join
      await expect(
        protocol.connect(bob).joinChallenge(1, { value: STAKE })
      ).to.emit(protocol, "ParticipantJoined");
    });

    it("Should reject unauthorized wallet from joining a private challenge", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true, // PRIVATE
        "ipfs://private",
        { value: STAKE }
      );

      // Bob is not whitelisted
      await expect(
        protocol.connect(bob).joinChallenge(1, { value: STAKE })
      ).to.be.revertedWith("Not authorized to join private challenge");
    });

    it("Should allow creator to whitelist addresses for private challenge", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true, // PRIVATE
        "ipfs://private",
        { value: STAKE }
      );

      // Alice whitelists Bob and Charlie
      await expect(
        protocol.connect(alice).whitelistParticipants(1, [bob.address, charlie.address])
      )
        .to.emit(protocol, "ParticipantWhitelisted")
        .withArgs(1, bob.address);

      expect(await protocol.isWhitelisted(1, bob.address)).to.be.true;
      expect(await protocol.isWhitelisted(1, charlie.address)).to.be.true;

      // Bob can now join
      await expect(
        protocol.connect(bob).joinChallenge(1, { value: STAKE })
      ).to.emit(protocol, "ParticipantJoined");

      // Dave is not whitelisted, still rejected
      await expect(
        protocol.connect(dave).joinChallenge(1, { value: STAKE })
      ).to.be.revertedWith("Not authorized to join private challenge");
    });

    it("Should allow creator to revoke whitelist", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true,
        "ipfs://private",
        { value: STAKE }
      );

      await protocol.connect(alice).whitelistParticipants(1, [bob.address]);
      expect(await protocol.isWhitelisted(1, bob.address)).to.be.true;

      // Revoke Bob
      await expect(protocol.connect(alice).revokeWhitelist(1, bob.address))
        .to.emit(protocol, "ParticipantUnwhitelisted")
        .withArgs(1, bob.address);

      expect(await protocol.isWhitelisted(1, bob.address)).to.be.false;

      // Bob cannot join anymore
      await expect(
        protocol.connect(bob).joinChallenge(1, { value: STAKE })
      ).to.be.revertedWith("Not authorized to join private challenge");
    });

    it("Should reject non-creator from whitelisting or revoking", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true,
        "ipfs://private"
      );

      // Bob tries to whitelist Dave
      await expect(
        protocol.connect(bob).whitelistParticipants(1, [dave.address])
      ).to.be.revertedWith("Only creator can whitelist");

      // Bob tries to revoke
      await expect(
        protocol.connect(bob).revokeWhitelist(1, dave.address)
      ).to.be.revertedWith("Only creator can revoke whitelist");
    });

    it("Should allow joining private challenge via EIP-712 invitation signature", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true, // private
        "ipfs://private",
        { value: STAKE }
      );

      // Create EIP-712 invitation signed by creator (alice)
      const invitationData = {
        challengeId: 1n,
        participant: bob.address,
      };

      const inviteSignature = await alice.signTypedData(domain, invitationTypes, invitationData);

      // Bob joins using the authorization signature
      await expect(
        protocol.connect(bob).joinChallengeWithAuthorization(1, inviteSignature, { value: STAKE })
      )
        .to.emit(protocol, "ParticipantJoined")
        .withArgs(1, bob.address, STAKE);

      expect(await protocol.isParticipant(1, bob.address)).to.be.true;
    });

    it("Should reject invalid or forged invitation signature", async function () {
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        true,
        "ipfs://private",
        { value: STAKE }
      );

      // Forged by Eve (not creator or attestor)
      const invitationData = {
        challengeId: 1n,
        participant: bob.address,
      };

      const forgedSig = await eve.signTypedData(domain, invitationTypes, invitationData);

      await expect(
        protocol.connect(bob).joinChallengeWithAuthorization(1, forgedSig, { value: STAKE })
      ).to.be.revertedWith("Invalid invitation signature");
    });
  });

  describe("9. Fixed Start Time & Dynamic Participant Count", function () {
    it("Should start at configured time with 2+ participants without waiting for max capacity", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const endTime = startTime + 10 * 86400;

      // Challenge with max 20 participants
      await protocol.connect(alice).createChallenge(
        STAKE,
        TOTAL_PERIODS,
        THRESHOLD,
        startTime,
        endTime,
        VERIFICATION_DURATION,
        20,
        false,
        "ipfs://meta",
        { value: STAKE }
      );

      // Only 2 more join (3 total: Alice, Bob, Charlie out of 20 max)
      await protocol.connect(bob).joinChallenge(1, { value: STAKE });
      await protocol.connect(charlie).joinChallenge(1, { value: STAKE });

      // Before start time: OPEN
      expect(await protocol.getCurrentStatus(1)).to.equal(0); // OPEN

      // Advance time past startTime
      await time.increaseTo(startTime + 10);

      // Transitions to ACTIVE automatically with 3 participants!
      expect(await protocol.getCurrentStatus(1)).to.equal(1); // ACTIVE

      // Joining after start is rejected even though capacity is 3/20
      await expect(
        protocol.connect(dave).joinChallenge(1, { value: STAKE })
      ).to.be.revertedWith("Challenge already started");
    });
  });

  describe("10. Submission Frequency & Generated Periods Settlement", function () {
    it("Should correctly settle a challenge configured with 15 periods (e.g. every 2 days for 30 days)", async function () {
      const now = await time.latest();
      const startTime = now + 1000;
      const FREQ_PERIODS = 15; // 15 periods generated
      const endTime = startTime + 30 * 86400;

      await protocol.connect(alice).createChallenge(
        STAKE,
        FREQ_PERIODS,
        50, // 50% threshold => need at least 8 periods (8*100 >= 50*15 => 800 >= 750)
        startTime,
        endTime,
        VERIFICATION_DURATION,
        5,
        false,
        "ipfs://frequency15",
        { value: STAKE }
      );

      await protocol.connect(bob).joinChallenge(1, { value: STAKE });
      await protocol.connect(charlie).joinChallenge(1, { value: STAKE });

      const sorted = [alice, bob, charlie].sort((a, b) =>
        a.address.toLowerCase().localeCompare(b.address.toLowerCase())
      );
      const addresses = sorted.map((u) => u.address);

      // Periods completed:
      // User 0: 15 / 15 (100% -> qualifies)
      // User 1: 10 / 15 (66.7% -> qualifies)
      // User 2: 4 / 15 (26.7% -> does NOT qualify)
      const completed = [15, 10, 4];

      await time.increaseTo(endTime + 10);

      const settlementData = {
        challengeId: 1n,
        settlementNonce: 1n,
        participants: addresses,
        completedPeriods: completed.map(BigInt),
      };

      const signature = await attestor.signTypedData(domain, settlementTypes, settlementData);
      const initialTreasury = await protocol.treasuryBalance();

      await protocol.finalizeChallenge(1, 1, addresses, completed, signature);

      const c0 = await protocol.claimable(1, addresses[0]);
      const c1 = await protocol.claimable(1, addresses[1]);
      const c2 = await protocol.claimable(1, addresses[2]);

      // User 2 only gets retained stake: (0.1 * 4) / 15
      const expectedRetained2 = (NET * 4n) / 15n;
      expect(c2).to.equal(expectedRetained2);

      // User 0 gets retained + proportional reward
      expect(c0).to.be.gt(STAKE);

      // Accounting Invariant holds to the exact wei:
      const finalTreasury = await protocol.treasuryBalance();
      const treasuryGain = finalTreasury - initialTreasury;
      const totalClaimable = c0 + c1 + c2;
      expect(totalClaimable + treasuryGain).to.equal(NET * 3n);
    });
  });
  describe("11. Joining Fee & Admin Claims", function () {
    let startTime;

    beforeEach(async function () {
      startTime = (await time.latest()) + 1000;
      await protocol.connect(alice).createChallenge(
        STAKE, TOTAL_PERIODS, THRESHOLD, startTime, startTime + 10 * 86400, VERIFICATION_DURATION, 10, false, "ipfs://fee",
        { value: STAKE }
      );
    });

    it("Should take exactly 0.125% of the stake on every join", async function () {
      expect(await protocol.feeFor(STAKE)).to.equal(FEE);
      expect(FEE).to.equal(ethers.parseEther("0.000125"));
      expect(await protocol.netStake(1)).to.equal(NET);

      await expect(protocol.connect(bob).joinChallenge(1, { value: STAKE }))
        .to.emit(protocol, "FeeCollected")
        .withArgs(1, bob.address, FEE);

      expect(await protocol.treasuryBalance()).to.equal(FEE * 2n);
      expect(await protocol.totalFeesCollected()).to.equal(FEE * 2n);
      const stats = await protocol.getProtocolStats();
      expect(stats._totalFeesCollected).to.equal(FEE * 2n);
      expect(stats._totalChallenges).to.equal(1n);
    });

    it("Should still require joiners to send exactly the advertised stake", async function () {
      await expect(protocol.connect(bob).joinChallenge(1, { value: NET })).to.be.revertedWith("Incorrect stake amount");
    });

    it("Should let only the admin (treasury) claim accrued fees, any time", async function () {
      await protocol.connect(bob).joinChallenge(1, { value: STAKE });
      const fees = await protocol.treasuryBalance();

      await expect(protocol.connect(alice).withdrawTreasury(fees)).to.be.revertedWith("Only treasury can withdraw");

      const before = await ethers.provider.getBalance(treasury.address);
      const tx = await protocol.connect(treasury).withdrawTreasury(fees); // mid-challenge
      const r = await tx.wait();
      const after = await ethers.provider.getBalance(treasury.address);
      expect(after + r.gasUsed * r.gasPrice - before).to.equal(fees);

      // Remaining contract balance still covers every participant's net stake
      expect(await ethers.provider.getBalance(await protocol.getAddress())).to.equal(NET * 2n);
    });

    it("Should start challenge IDs at the configured offset", async function () {
      const V2 = await ethers.getContractFactory("CommitXProtocol");
      const v2 = await V2.deploy(attestor.address, treasury.address, 1001);
      const t = (await time.latest()) + 1000;
      await v2.connect(alice).createChallenge(STAKE, 5, 50, t, t + 5 * 86400, 3600, 5, false, "ipfs://x");
      expect((await v2.getChallenge(1001)).creator).to.equal(alice.address);
      expect(await v2.nextChallengeId()).to.equal(1002n);
      expect((await v2.getProtocolStats())._totalChallenges).to.equal(1n);
      await expect(V2.deploy(attestor.address, treasury.address, 0)).to.be.revertedWith("First challenge id must be > 0");
    });
  });
  describe("12. Admin Account Locks", function () {
    let endTime, sorted;

    beforeEach(async function () {
      const startTime = (await time.latest()) + 1000;
      endTime = startTime + TOTAL_PERIODS * 86400;
      await protocol.connect(alice).createChallenge(
        STAKE, TOTAL_PERIODS, THRESHOLD, startTime, endTime, VERIFICATION_DURATION, 5, false, "ipfs://lock",
        { value: STAKE }
      );
      await protocol.connect(bob).joinChallenge(1, { value: STAKE });
      await time.increaseTo(endTime + 10);
      sorted = [alice, bob].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
      const addresses = sorted.map((u) => u.address);
      const data = { challengeId: 1n, settlementNonce: 1n, participants: addresses, completedPeriods: [10n, 10n] };
      const sig = await attestor.signTypedData(domain, settlementTypes, data);
      await protocol.finalizeChallenge(1, 1, addresses, [10, 10], sig);
    });

    it("Should let only the admin lock and unlock accounts", async function () {
      await expect(protocol.connect(alice).setAccountLock(bob.address, true, "x")).to.be.revertedWithCustomError(
        protocol,
        "OwnableUnauthorizedAccount"
      );
      await expect(protocol.setAccountLock(bob.address, true, "Approved invalid proof"))
        .to.emit(protocol, "AccountLockChanged")
        .withArgs(bob.address, true, "Approved invalid proof");
      expect(await protocol.isLocked(bob.address)).to.equal(true);
    });

    it("Should block withdrawals while locked and keep the balance intact", async function () {
      const owed = await protocol.claimable(1, bob.address);
      await protocol.setAccountLock(bob.address, true, "complaint upheld");
      await expect(protocol.connect(bob).withdraw(1)).to.be.revertedWith("Account locked by admin");
      expect(await protocol.claimable(1, bob.address)).to.equal(owed);

      // Others are unaffected
      await expect(protocol.connect(alice).withdraw(1)).to.not.be.reverted;

      await protocol.setAccountLock(bob.address, false, "resolved");
      await expect(protocol.connect(bob).withdraw(1)).to.not.be.reverted;
      expect(await protocol.claimable(1, bob.address)).to.equal(0n);
    });

    it("Should block under-filled refunds while locked", async function () {
      const t = (await time.latest()) + 1000;
      await protocol.connect(charlie).createChallenge(STAKE, 5, 50, t, t + 5 * 86400, 3600, 5, false, "ipfs://u", { value: STAKE });
      await time.increaseTo(t + 10);
      await protocol.setAccountLock(charlie.address, true, "x");
      await expect(protocol.connect(charlie).claimUnderfilledRefund(2)).to.be.revertedWith("Account locked by admin");
      await protocol.setAccountLock(charlie.address, false, "ok");
      await expect(protocol.connect(charlie).claimUnderfilledRefund(2)).to.not.be.reverted;
    });
  });
});
