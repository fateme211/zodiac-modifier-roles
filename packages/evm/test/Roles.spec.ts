import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { AddressOne } from "@gnosis.pm/safe-contracts";

import {
  buildContractCall,
  buildMultiSendSafeTx,
  ParameterType,
  ExecutionOptions,
  Operator,
  deployRolesMod,
  PermissionCheckerStatus,
} from "./utils";
import { defaultAbiCoder } from "ethers/lib/utils";

const ROLE_KEY =
  "0x000000000000000000000000000000000000000000000000000000000000000f";
const ROLE_KEY1 =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const ROLE_KEY2 =
  "0x0000000000000000000000000000000000000000000000000000000000000002";

describe("Roles", async () => {
  async function baseSetup() {
    const Avatar = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await Avatar.deploy();
    const TestContract = await hre.ethers.getContractFactory("TestContract");
    const testContract = await TestContract.deploy();
    return { Avatar, avatar, testContract };
  }

  async function setupTestWithTestAvatar() {
    const base = await baseSetup();

    const modifier = await deployRolesMod(
      hre,
      base.avatar.address,
      base.avatar.address,
      base.avatar.address
    );

    return { ...base, modifier };
  }

  async function setupRolesWithOwnerAndInvoker() {
    const base = await baseSetup();

    const [owner, invoker] = await hre.ethers.getSigners();
    const modifier = await deployRolesMod(
      hre,
      owner.address,
      base.avatar.address,
      base.avatar.address
    );

    await modifier.enableModule(invoker.address);

    return {
      ...base,
      modifier,
      owner,
      invoker,
    };
  }

  async function txSetup() {
    const baseAvatar = await setupTestWithTestAvatar();
    const encodedParam_1 = ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [user1.address]
    );
    const encodedParam_2 = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      [99]
    );
    const encodedParam_3 = defaultAbiCoder.encode(
      ["string"],
      ["This is a dynamic array"]
    );
    const encodedParam_4 = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      [4]
    );
    const encodedParam_5 = defaultAbiCoder.encode(["string"], ["Test"]);
    const encodedParam_6 = ethers.utils.defaultAbiCoder.encode(
      ["bool"],
      [true]
    );
    const encodedParam_7 = ethers.utils.defaultAbiCoder.encode(["uint8"], [3]);
    const encodedParam_8 = defaultAbiCoder.encode(["string"], ["weeeeeeee"]);
    const encodedParam_9 = defaultAbiCoder.encode(
      ["string"],
      [
        "This is an input that is larger than 32 bytes and must be scanned for correctness",
      ]
    );
    const tx_1 = buildContractCall(
      baseAvatar.testContract,
      "mint",
      [user1.address, 99],
      0
    );
    const tx_2 = buildContractCall(
      baseAvatar.testContract,
      "mint",
      [user1.address, 99],
      0
    );
    const tx_3 = await buildContractCall(
      baseAvatar.testContract,
      "testDynamic",
      [
        "This is a dynamic array",
        4,
        "Test",
        true,
        3,
        "weeeeeeee",
        "This is an input that is larger than 32 bytes and must be scanned for correctness",
      ],
      0
    );

    const parameterConfig_9 = [
      {
        parent: 0,
        paramType: ParameterType.AbiEncoded,
        operator: Operator.Matches,
        compValue: "0x",
      },
      {
        parent: 0,
        paramType: ParameterType.Dynamic,
        operator: Operator.EqualTo,
        compValue: encodedParam_3,
      },
      {
        parent: 0,
        paramType: ParameterType.Static,
        operator: Operator.EqualTo,
        compValue: encodedParam_4,
      },
      {
        parent: 0,
        paramType: ParameterType.Dynamic,
        operator: Operator.EqualTo,
        compValue: encodedParam_5,
      },
      {
        parent: 0,
        paramType: ParameterType.Static,
        operator: Operator.EqualTo,
        compValue: encodedParam_6,
      },
      {
        parent: 0,
        paramType: ParameterType.Static,
        operator: Operator.EqualTo,
        compValue: encodedParam_7,
      },
      {
        parent: 0,
        paramType: ParameterType.Dynamic,
        operator: Operator.EqualTo,
        compValue: encodedParam_8,
      },
      {
        parent: 0,
        paramType: ParameterType.Dynamic,
        operator: Operator.EqualTo,
        compValue: encodedParam_9,
      },
    ];

    return {
      ...baseAvatar,
      encodedParam_1,
      encodedParam_2,
      encodedParam_3,
      encodedParam_4,
      encodedParam_5,
      encodedParam_6,
      encodedParam_7,
      encodedParam_8,
      encodedParam_9,
      parameterConfig_9,
      tx_1,
      tx_2,
      tx_3,
    };
  }

  const [user1] = await hre.ethers.getSigners();

  describe("setUp()", async () => {
    it("should emit event because of successful set up", async () => {
      const modifier = await deployRolesMod(
        hre,
        user1.address,
        user1.address,
        user1.address
      );
      await modifier.deployed();
      await expect(modifier.deployTransaction)
        .to.emit(modifier, "RolesModSetup")
        .withArgs(user1.address, user1.address, user1.address, user1.address);
    });
  });

  describe("assignRoles()", () => {
    it("should throw on length mismatch", async () => {
      const { modifier, owner } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );
      await expect(
        modifier
          .connect(owner)
          .assignRoles(user1.address, [ROLE_KEY1, ROLE_KEY2], [true])
      ).to.be.revertedWithCustomError(modifier, "ArraysDifferentLength");
    });
    it("reverts if not authorized", async () => {
      const { modifier } = await loadFixture(txSetup);
      await expect(
        modifier.assignRoles(user1.address, [ROLE_KEY1], [true])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("assigns roles to a module", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.be.revertedWithCustomError(modifier, "NoMembership");

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);

      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.emit(testContract, "DoNothing");
    });

    it("revokes roles to a module", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      // blank allow all calls to testContract from role 0
      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      //authorize
      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);
      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY);

      // expect it to succeed, after assigning role
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.emit(testContract, "DoNothing");

      //revoke
      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [false]);

      // expect it to fail, after revoking
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.be.revertedWithCustomError(modifier, "NoMembership");
    });

    it("it enables the module if necessary", async () => {
      const { avatar, modifier } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      await expect(await modifier.isModuleEnabled(user1.address)).to.equal(
        true
      );

      // it doesn't revert when assigning additional roles
      const assignSecond = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1, ROLE_KEY2],
        [true, true]
      );
      await expect(avatar.exec(modifier.address, 0, assignSecond.data || "", 0))
        .to.not.be.reverted;
    });

    it("emits the AssignRoles event", async () => {
      const { avatar, modifier } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );

      await expect(avatar.exec(modifier.address, 0, assign.data || "", 0))
        .to.emit(modifier, "AssignRoles")
        .withArgs(user1.address, [ROLE_KEY1], [true]);
    });
  });

  describe("execTransactionFromModule()", () => {
    it("reverts if data is set and is not at least 4 bytes", async () => {
      const { modifier, testContract, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await modifier.assignRoles(invoker.address, [ROLE_KEY], [true]);
      await modifier.setDefaultRole(invoker.address, ROLE_KEY);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(testContract.address, 0, "0xab", 0)
      ).to.be.revertedWithCustomError(modifier, "FunctionSignatureTooShort");
    });

    it("reverts if called from module not assigned any role", async () => {
      const { modifier, testContract, owner } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          mint.data as string,
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, `NotAuthorized`)
        .withArgs(user1.address);
    });

    it("reverts if the call is not an allowed target", async () => {
      const { avatar, modifier, testContract } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const allowTargetAddress = await modifier.populateTransaction.allowTarget(
        ROLE_KEY1,
        testContract.address,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, allowTargetAddress.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      const someOtherAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      await expect(
        modifier.execTransactionFromModule(
          someOtherAddress,
          0,
          mint.data || "",
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.TargetAddressNotAllowed);
    });

    it("executes a call to an allowed target", async () => {
      const { avatar, modifier, testContract } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const allowTargetAddress = await modifier.populateTransaction.allowTarget(
        ROLE_KEY1,
        testContract.address,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, allowTargetAddress.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );

      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          mint.data || "",
          0
        )
      ).to.emit(testContract, "Mint");
    });

    it("reverts if value parameter is not allowed", async () => {
      const { avatar, modifier, testContract, encodedParam_1, encodedParam_2 } =
        await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const functionScoped = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, functionScoped.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.AbiEncoded,
            operator: Operator.Matches,
            compValue: "0x",
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        98
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          mint.data || "",
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.ParameterNotAllowed);
    });

    it("executes a call with allowed value parameter", async () => {
      const user1 = (await hre.ethers.getSigners())[0];

      const { avatar, modifier, testContract, encodedParam_1, encodedParam_2 } =
        await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const functionScoped = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, functionScoped.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.AbiEncoded,
            operator: Operator.Matches,
            compValue: "0x",
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          mint.data || "",
          0
        )
      ).to.emit(testContract, "Mint");
    });

    it("reverts dynamic parameter is not allowed", async () => {
      const {
        avatar,
        modifier,
        testContract,
        encodedParam_3,
        encodedParam_4,
        encodedParam_5,
        encodedParam_6,
        encodedParam_7,
        encodedParam_8,
        encodedParam_9,
      } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );

      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const functionScoped = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, functionScoped.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x273454bf",
        [
          {
            parent: 0,
            paramType: ParameterType.AbiEncoded,
            operator: Operator.Matches,
            compValue: "0x",
          },
          {
            parent: 0,
            paramType: ParameterType.Dynamic,
            operator: Operator.EqualTo,
            compValue: encodedParam_3,
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_4,
          },
          {
            parent: 0,
            paramType: ParameterType.Dynamic,
            operator: Operator.EqualTo,
            compValue: encodedParam_5,
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_6,
          },
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_7,
          },
          {
            parent: 0,
            paramType: ParameterType.Dynamic,
            operator: Operator.EqualTo,
            compValue: encodedParam_8,
          },
          {
            parent: 0,
            paramType: ParameterType.Dynamic,
            operator: Operator.EqualTo,
            compValue: encodedParam_9,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const dynamic = await testContract.populateTransaction.testDynamic(
        "This is a dynamic array that is not allowed",
        4,
        "Test",
        true,
        3,
        "weeeeeeee",
        "This is an input that is larger than 32 bytes and must be scanned for correctness"
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          dynamic.data || "",
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.ParameterNotAllowed);
    });

    it("executes a call with allowed dynamic parameter", async () => {
      const { avatar, modifier, testContract, parameterConfig_9 } =
        await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );

      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const functionScoped = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, functionScoped.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x273454bf",
        parameterConfig_9,
        ExecutionOptions.None
      );

      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const dynamic = await testContract.populateTransaction.testDynamic(
        "This is a dynamic array",
        4,
        "Test",
        true,
        3,
        "weeeeeeee",
        "This is an input that is larger than 32 bytes and must be scanned for correctness"
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          dynamic.data || "",
          0
        )
      ).to.emit(testContract, "TestDynamic");
    });

    it.skip("reverts a call with multisend tx", async () => {
      const {
        avatar,
        modifier,
        testContract,
        encodedParam_1,
        encodedParam_2,
        parameterConfig_9,
        tx_1,
        tx_2,
        tx_3,
      } = await loadFixture(txSetup);

      const MultiSend = await hre.ethers.getContractFactory("MultiSend");
      const multisend = await MultiSend.deploy();

      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      // const multiSendTarget = await modifier.populateTransaction.setMultisend(
      //   multisend.address
      // );
      // await avatar.exec(modifier.address, 0, multiSendTarget.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const scopeTarget = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, scopeTarget.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 1,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const paramScoped_2 = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x273454bf",
        parameterConfig_9,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped_2.data || "", 0);

      const tx_bad = buildContractCall(
        testContract,
        "mint",
        [user1.address, 98],
        0
      );

      const multiTx = buildMultiSendSafeTx(
        multisend,
        [tx_1, tx_2, tx_3, tx_bad, tx_2, tx_3],
        0
      );

      await expect(
        modifier.execTransactionFromModule(
          multisend.address,
          0,
          multiTx.data,
          1
        )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.ParameterNotAllowed);
    });

    it.skip("reverts if multisend tx data offset is not 32 bytes", async () => {
      const {
        avatar,
        modifier,
        testContract,
        encodedParam_1,
        encodedParam_2,
        tx_1,
      } = await loadFixture(txSetup);
      const MultiSend = await hre.ethers.getContractFactory("MultiSend");
      const multisend = await MultiSend.deploy();

      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      // const multiSendTarget = await modifier.populateTransaction.setMultisend(
      //   multisend.address
      // );
      // await avatar.exec(modifier.address, 0, multiSendTarget.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const functionScoped = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, functionScoped.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 1,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );

      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const multiTx = buildMultiSendSafeTx(multisend, [tx_1], 0);

      // setting offset to 0x21 bytes instead of 0x20
      multiTx.data = multiTx.data.substr(0, 73) + "1" + multiTx.data.substr(74);

      await expect(
        modifier.execTransactionFromModule(
          multisend.address,
          0,
          multiTx.data,
          1
        )
      ).to.be.revertedWith("UnacceptableMultiSendOffset()");
    });

    it.skip("executes a call with multisend tx", async () => {
      const {
        avatar,
        modifier,
        testContract,
        encodedParam_1,
        encodedParam_2,
        parameterConfig_9,
        tx_1,
        tx_2,
        tx_3,
      } = await loadFixture(txSetup);
      const MultiSend = await hre.ethers.getContractFactory("MultiSend");
      const multisend = await MultiSend.deploy();

      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      // const multiSendTarget = await modifier.populateTransaction.setMultisend(
      //   multisend.address
      // );
      // await avatar.exec(modifier.address, 0, multiSendTarget.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const scopeTarget = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, scopeTarget.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 1,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const paramScoped_2 = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x273454bf",
        parameterConfig_9,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped_2.data || "", 0);

      const multiTx = buildMultiSendSafeTx(
        multisend,
        [tx_1, tx_2, tx_3, tx_1, tx_2, tx_3],
        0
      );

      await expect(
        modifier.execTransactionFromModule(
          multisend.address,
          0,
          multiTx.data,
          1
        )
      ).to.emit(testContract, "TestDynamic");
    });
  });

  describe("execTransactionFromModuleReturnData()", () => {
    it("reverts if called from module not assigned any role", async () => {
      const { avatar, modifier, testContract } = await loadFixture(txSetup);
      const allowTargetAddress = await modifier.populateTransaction.allowTarget(
        ROLE_KEY1,
        testContract.address,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, allowTargetAddress.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier.execTransactionFromModuleReturnData(
          testContract.address,
          0,
          mint.data || "",
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, `NotAuthorized`)
        .withArgs(user1.address);
    });

    it("reverts if the call is not an allowed target", async () => {
      const { avatar, modifier, testContract } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const allowTargetAddress = await modifier.populateTransaction.allowTarget(
        ROLE_KEY1,
        testContract.address,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, allowTargetAddress.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );
      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      const someOtherAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      await expect(
        modifier.execTransactionFromModuleReturnData(
          someOtherAddress,
          0,
          mint.data || "",
          0
        )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.TargetAddressNotAllowed);
    });

    it("executes a call to an allowed target", async () => {
      const { avatar, modifier, testContract } = await loadFixture(txSetup);
      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY1],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      const allowTargetAddress = await modifier.populateTransaction.allowTarget(
        ROLE_KEY1,
        testContract.address,
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, allowTargetAddress.data || "", 0);

      const defaultRole = await modifier.populateTransaction.setDefaultRole(
        user1.address,
        ROLE_KEY1
      );

      await avatar.exec(modifier.address, 0, defaultRole.data || "", 0);

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier.execTransactionFromModule(
          testContract.address,
          0,
          mint.data || "",
          0
        )
      ).to.emit(testContract, "Mint");
    });
  });

  describe("execTransactionWithRole()", () => {
    it("reverts if inner tx reverted and shouldRevert true", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      const SHOULD_REVERT = true;
      const fnThatReverts =
        await testContract.populateTransaction.fnThatReverts();

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRole(
            testContract.address,
            0,
            fnThatReverts.data as string,
            0,
            ROLE_KEY,
            SHOULD_REVERT
          )
      ).to.be.revertedWithCustomError(modifier, "ModuleTransactionFailed");
    });
    it("does not revert if inner tx reverted and shouldRevert false", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      const SHOULD_REVERT = true;
      const fnThatReverts =
        await testContract.populateTransaction.fnThatReverts();

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRole(
            testContract.address,
            0,
            fnThatReverts.data as string,
            0,
            ROLE_KEY,
            !SHOULD_REVERT
          )
      ).to.not.be.reverted;
    });
  });

  describe("execTransactionWithRoleReturnData()", () => {
    it("reverts if called from module not assigned any role", async () => {
      const { modifier, testContract, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      const SHOULD_REVERT = true;

      const mint = await testContract.populateTransaction.mint(
        user1.address,
        99
      );

      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRoleReturnData(
            testContract.address,
            0,
            mint.data as string,
            0,
            ROLE_KEY,
            !SHOULD_REVERT
          )
      ).to.be.revertedWithCustomError(modifier, "NoMembership");
    });

    it("reverts if inner tx reverted and shouldRevert true", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      const SHOULD_REVERT = true;
      const fnThatReverts =
        await testContract.populateTransaction.fnThatReverts();

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRoleReturnData(
            testContract.address,
            0,
            fnThatReverts.data as string,
            0,
            ROLE_KEY,
            SHOULD_REVERT
          )
      ).to.be.revertedWithCustomError(modifier, "ModuleTransactionFailed");
    });

    it("does not revert if inner tx reverted and shouldRevert false", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      const SHOULD_REVERT = true;
      const fnThatReverts =
        await testContract.populateTransaction.fnThatReverts();

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRoleReturnData(
            testContract.address,
            0,
            fnThatReverts.data as string,
            0,
            ROLE_KEY,
            !SHOULD_REVERT
          )
      ).to.be.not.be.reverted;
    });

    it.skip("executes a call with multisend tx", async () => {
      const {
        avatar,
        modifier,
        testContract,
        encodedParam_1,
        encodedParam_2,
        parameterConfig_9,
        tx_1,
        tx_2,
        tx_3,
      } = await loadFixture(txSetup);

      const SHOULD_REVERT = true;

      const MultiSend = await hre.ethers.getContractFactory("MultiSend");
      const multisend = await MultiSend.deploy();

      const assign = await modifier.populateTransaction.assignRoles(
        user1.address,
        [ROLE_KEY],
        [true]
      );
      await avatar.exec(modifier.address, 0, assign.data || "", 0);

      // const multiSendTarget = await modifier.populateTransaction.setMultisend(
      //   multisend.address
      // );
      // await avatar.exec(modifier.address, 0, multiSendTarget.data || "", 0);

      const scopeTarget = await modifier.populateTransaction.scopeTarget(
        ROLE_KEY1,
        testContract.address
      );
      await avatar.exec(modifier.address, 0, scopeTarget.data || "", 0);

      const paramScoped = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x40c10f19",
        [
          {
            parent: 0,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_1,
          },
          {
            parent: 1,
            paramType: ParameterType.Static,
            operator: Operator.EqualTo,
            compValue: encodedParam_2,
          },
        ],
        ExecutionOptions.None
      );
      await avatar.exec(modifier.address, 0, paramScoped.data || "", 0);

      const paramScoped_2 = await modifier.populateTransaction.scopeFunction(
        ROLE_KEY1,
        testContract.address,
        "0x273454bf",
        parameterConfig_9,
        ExecutionOptions.None
      );

      await avatar.exec(modifier.address, 0, paramScoped_2.data || "", 0);

      const multiTx = buildMultiSendSafeTx(
        multisend,
        [tx_1, tx_2, tx_3, tx_1, tx_2, tx_3],
        0
      );

      await expect(
        modifier.execTransactionWithRoleReturnData(
          multisend.address,
          0,
          multiTx.data,
          1,
          ROLE_KEY,
          !SHOULD_REVERT
        )
      ).to.emit(testContract, "TestDynamic");
    });
  });

  describe("allowTarget()", () => {
    it("sets allowed address to true", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );
      const SHOULD_REVERT = true;
      // assign a role to invoker
      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY1], [true]);
      // expect to fail due to no permissions
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.be.revertedWithCustomError(modifier, "NoMembership");
      // allow testContract address for role
      await expect(
        modifier
          .connect(owner)
          .allowTarget(ROLE_KEY1, testContract.address, ExecutionOptions.None)
      ).to.not.be.reverted;
      // expect to fail with default role
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.be.revertedWithCustomError(modifier, "NoMembership");
      // should work with the configured role
      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRole(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0,
            ROLE_KEY1,
            !SHOULD_REVERT
          )
      ).to.emit(testContract, "DoNothing");
    });
    it("sets allowed address to false", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );
      const SHOULD_REVERT = true;
      // assign a role to invoker
      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);
      // allow testContract address for role
      await expect(
        modifier
          .connect(owner)
          .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None)
      );
      // this call should work
      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRole(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0,
            ROLE_KEY,
            !SHOULD_REVERT
          )
      ).to.emit(testContract, "DoNothing");
      // Revoke access
      await expect(
        modifier.connect(owner).revokeTarget(ROLE_KEY, testContract.address)
      ).to.not.be.reverted;
      // fails after revoke
      await expect(
        modifier
          .connect(invoker)
          .execTransactionWithRole(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0,
            ROLE_KEY,
            !SHOULD_REVERT
          )
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.TargetAddressNotAllowed);
    });
  });

  describe("allowTarget - canSend", () => {
    it("sets send allowed to true", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);
      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModuleReturnData(testContract.address, 1, "0x", 0)
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.SendNotAllowed);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.Send);

      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModuleReturnData(
            testContract.address,
            10000,
            "0x",
            0
          )
      ).to.not.be.reverted;
    });

    it("sets send allowed to false", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY], [true]);
      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY);

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.Send);

      // should work with sendAllowed true
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModuleReturnData(
            testContract.address,
            10000,
            "0x",
            0
          )
      ).to.not.be.reverted;

      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY, testContract.address, ExecutionOptions.None);

      // should work with sendAllowed false
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModuleReturnData(testContract.address, 1, "0x", 0)
      )
        .to.be.revertedWithCustomError(modifier, "ConditionViolation")
        .withArgs(PermissionCheckerStatus.SendNotAllowed);
    });
  });

  describe("setDefaultRole()", () => {
    it("reverts if not authorized", async () => {
      const { modifier } = await loadFixture(txSetup);
      await expect(
        modifier.setDefaultRole(AddressOne, ROLE_KEY1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("sets default role", async () => {
      const { modifier, testContract, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      // grant roles 1 and 2 to invoker
      await modifier
        .connect(owner)
        .assignRoles(invoker.address, [ROLE_KEY1, ROLE_KEY2], [true, true]);

      // make ROLE2 the default for invoker
      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY2);

      // allow all calls to testContract from ROLE1
      await modifier
        .connect(owner)
        .allowTarget(ROLE_KEY1, testContract.address, ExecutionOptions.None);

      // expect it to fail
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.be.reverted;

      // make ROLE1 the default to invoker
      await modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY1);

      // gmi
      await expect(
        modifier
          .connect(invoker)
          .execTransactionFromModule(
            testContract.address,
            0,
            testContract.interface.encodeFunctionData("doNothing"),
            0
          )
      ).to.emit(testContract, "DoNothing");
    });

    it("emits event with correct params", async () => {
      const { modifier, owner, invoker } = await loadFixture(
        setupRolesWithOwnerAndInvoker
      );

      await expect(
        modifier.connect(owner).setDefaultRole(invoker.address, ROLE_KEY2)
      )
        .to.emit(modifier, "SetDefaultRole")
        .withArgs(invoker.address, ROLE_KEY2);
    });
  });
});
