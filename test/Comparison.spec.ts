import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("Comparison", async () => {
  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const Avatar = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await Avatar.deploy();
    const TestContract = await hre.ethers.getContractFactory("TestContract");
    const testContract = await TestContract.deploy();
    const testContractClone = await TestContract.deploy();
    return { Avatar, avatar, testContract, testContractClone };
  });

  const setupRolesWithOwnerAndInvoker = deployments.createFixture(async () => {
    const base = await baseSetup();

    const [owner, invoker] = waffle.provider.getWallets();

    const Permissions = await hre.ethers.getContractFactory("Permissions");
    const permissions = await Permissions.deploy();
    const Modifier = await hre.ethers.getContractFactory("Roles", {
      libraries: {
        Permissions: permissions.address,
      },
    });

    const modifier = await Modifier.deploy(
      owner.address,
      base.avatar.address,
      base.avatar.address
    );

    await modifier.enableModule(invoker.address);

    return {
      ...base,
      Modifier,
      modifier,
      owner,
      invoker,
    };
  });

  const COMP_EQUAL = 0;
  const COMP_GREATER = 1;
  const COMP_LESS = 2;
  const COMP_ONE_OF = 3;

  it("enforces compType for scopeFunction", async () => {
    const { modifier, testContract, owner } =
      await setupRolesWithOwnerAndInvoker();

    const ROLE_ID = 0;
    const SELECTOR = testContract.interface.getSighash(
      testContract.interface.getFunction("doNothing")
    );

    await expect(
      modifier
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          [false, true, false],
          [false, false, false],
          [COMP_EQUAL, COMP_ONE_OF, COMP_EQUAL],
          ["0x", "0x", "0x"]
        )
    ).to.be.revertedWith("UnsuitableOneOfComparison");

    await expect(
      modifier
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          [false, true, false],
          [false, true, false],
          [COMP_EQUAL, COMP_GREATER, COMP_GREATER],
          ["0x", "0x", "0x"]
        )
    ).to.be.revertedWith("UnsuitableRelativeComparison");

    await expect(
      modifier
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          [false, true, true],
          [false, true, false],
          [COMP_EQUAL, COMP_EQUAL, COMP_GREATER],
          ["0x", "0x", "0x"]
        )
    ).to.not.be.reverted;

    await expect(
      modifier
        .connect(owner)
        .scopeFunction(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          [false, true, true],
          [false, true, false],
          [COMP_EQUAL, COMP_EQUAL, COMP_LESS],
          ["0x", "0x", "0x"]
        )
    ).to.not.be.reverted;
  });
  it("enforces compType for scopeParam", async () => {
    const { modifier, testContract, owner } =
      await setupRolesWithOwnerAndInvoker();

    const ROLE_ID = 0;
    const SELECTOR = testContract.interface.getSighash(
      testContract.interface.getFunction("doNothing")
    );
    const IS_DYNAMIC = true;

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          IS_DYNAMIC,
          COMP_ONE_OF,
          "0x"
        )
    ).to.be.revertedWith("UnsuitableOneOfComparison");

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          IS_DYNAMIC,
          COMP_GREATER,
          "0x"
        )
    ).to.be.revertedWith("UnsuitableRelativeComparison");

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          IS_DYNAMIC,
          COMP_EQUAL,
          "0x"
        )
    ).to.not.be.reverted;

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          !IS_DYNAMIC,
          COMP_ONE_OF,
          "0x"
        )
    ).to.be.revertedWith("UnsuitableOneOfComparison");

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          !IS_DYNAMIC,
          COMP_GREATER,
          "0x"
        )
    ).to.not.be.reverted;

    await expect(
      modifier
        .connect(owner)
        .scopeParameter(
          ROLE_ID,
          testContract.address,
          SELECTOR,
          0,
          !IS_DYNAMIC,
          COMP_EQUAL,
          "0x"
        )
    ).to.not.be.reverted;
  });

  // for the next PR
  it("passes an eq comparison", async () => {});
  it("passes an eq comparison for dynamic");
  it("re-scopes an eq compType");

  it("should pass a oneOf comparison");
  it("should pass a oneOf comparison for dynamic");
  it("re-scopes a oneOf comparison to simple compType");
  it("re-scopes simple compType to oneOf");

  it("should pass a gt/lt comparison");
  it("should update a gt/lt comparison");
  it("should coerce compType eq for dynamic");

  it("mixed misc comparisons");
});
