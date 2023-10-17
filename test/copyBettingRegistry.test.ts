import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, artifacts } from "hardhat";
const hre = require("hardhat");


import { CopyBettingRegistry, IERC20, CopyBetting } from "../typechain-types";
import { Contract, Signer } from 'ethers';
import { Account, etherUnits } from "viem";
import { IERC20Interface } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

describe('CopyBettingRegistry', function () {
  
  
  let copyBettingRegistryContract: CopyBettingRegistry;
  let copyBetting: CopyBetting;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let wxDAIContract: IERC20; // Declare the wxDAI contract variable
  
  const wxDAIAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
  const azuroBet = "0xA3A1B460c68dc91c5B3f71f5487A76fac42858bf";
  const lpAddress = "0x204e7371Ade792c5C006fb52711c50a7efC843ed";
  const coreAzuroAddress = "0x7f3F3f19c4e4015fd9Db2f22e653c766154091EF";
  
before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    // deploy copyBetting Registry contract
    const registryFactory = await ethers.getContractFactory("CopyBettingRegistry");
    copyBettingRegistryContract = (await registryFactory.deploy()) as CopyBettingRegistry;
    const copyBettingRegistry = await ethers.deployContract("CopyBettingRegistry");
    console.log(await copyBettingRegistryContract.getAddress(), "address copybettingregistry");
    
    // deploy copyBetting engine contract
    const copyBettingEngineFactory = await ethers.getContractFactory("CopyBetting");
    copyBetting = (await copyBettingEngineFactory.deploy()) as CopyBetting;
    const copyBettingContract = await ethers.deployContract("CopyBetting");
    console.log(await copyBetting.getAddress(), "copyBettingEngine adress")

    // initialize wXDAI token operation
    const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"],
    });
    const signer = await ethers.provider.getSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
    wxDAIContract = await hre.ethers.getContractAt(IERC20_SOURCE, wxDAIAddress, signer);
    wxDAIContract = wxDAIContract.connect(signer);
});

it('should initialize the Registry contract', async () => {
    // Perform contract initialization
    await copyBettingRegistryContract.initialize(copyBetting.getAddress(), wxDAIAddress, azuroBet);
    console.log(await copyBettingRegistryContract.getAddress(), "address copybettingregistry");

    // Check the initialized parameters
    const initializedOwner = await copyBettingRegistryContract.copyBettingEngineAddress();
    const initializedUser1 = await copyBettingRegistryContract.erc20Token();

    const isInitialized = await copyBettingRegistryContract.initialized();

    // Assert that the parameters are correctly initialized
    expect(isInitialized).to.equal(true);
    expect(initializedOwner).to.equal(await copyBetting.getAddress());
    expect(initializedUser1).to.equal(wxDAIAddress);
});

it('should initialize the CopyBetting contract', async () => {
  // Perform contract initialization
  await copyBetting.initialize(coreAzuroAddress, lpAddress, azuroBet, await copyBettingRegistryContract.getAddress(), wxDAIAddress);
  console.log(await copyBetting.getAddress(), "address copyBetting");

  // Check the initialized parameters
  const initializedOwner = await copyBetting.coreBase();
  const initializedUser1 = await copyBetting.erc20Token();

  const isInitialized = await copyBetting.initialized();

  // Assert that the parameters are correctly initialized
  expect(isInitialized).to.equal(true);
  expect(initializedOwner).to.equal(coreAzuroAddress);
  expect(initializedUser1).to.equal(wxDAIAddress);
});

it('should add a copy betting player', async () => {
    // Define the parameters for adding the player
    const bettorAddress = await user1.getAddress();
    const amount = BigInt(ethers.parseUnits("1", 18))
    const betNumber = 5;
    const amountToApprove = BigInt(ethers.parseUnits("5", 18))
    // approve
    const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
    // some extra checks
    const initialAllowance = await wxDAIContract.allowance(impersonatedSigner.getAddress(), copyBettingRegistryContract.getAddress());
    const initialBalance = await wxDAIContract.balanceOf(impersonatedSigner.getAddress());
    const initialBalanceContract = await wxDAIContract.balanceOf(copyBetting.getAddress());
    // approve
    const approveOperation = await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);
    
    const newAllowance = await wxDAIContract.allowance(impersonatedSigner.getAddress(), copyBettingRegistryContract.getAddress());
    // Add a copy betting player
    await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer([bettorAddress], [amount], [betNumber]);
    
    expect(newAllowance).to.equal(amountToApprove); // Expect it to be the approval amount
    expect(initialBalanceContract).to.equal(0);
    
    const newBalance = await wxDAIContract.balanceOf(impersonatedSigner.getAddress());
    const newBlanceContract = await wxDAIContract.balanceOf(copyBetting.getAddress());
    expect(initialBalance - amountToApprove).to.equal(newBalance);
    expect(newBlanceContract).to.equal(amountToApprove);

    // Verify that the isBettorExists mapping is updated correctly
    const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
    expect(exists).to.equal(true);

    // Check the betAmounts mapping for the correct amount
    const betAmount = await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress);
    expect(betAmount.toString()).to.equal(amount.toString());

    // Verify that the betsLeft mapping is correctly initialized with the provided bet number
    const betsLeft = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect(betsLeft.toString()).to.equal(betNumber.toString());
});

it('should remove a copy betting player', async () => {
  // Define the parameters for adding the player
  const bettorAddress = await user1.getAddress();
  const amount = BigInt(ethers.parseUnits("20", 18));
  const amountToApprove = BigInt(ethers.parseUnits("100", 18));
  const betNumber = 5;

  // approve
  const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
  const approveOperation = await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);
  
  // Add a copy betting player
  await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer([bettorAddress], [amount], [betNumber]);

  const balanceCopyBettingPre = await wxDAIContract.balanceOf(await copyBetting.getAddress());
  console.log(balanceCopyBettingPre, "balance pre");
  const withdrawAmount = (await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress)) * (await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress));
  console.log(withdrawAmount, "withdraw amount")
  // Remove the copy betting player
  await copyBettingRegistryContract.connect(impersonatedSigner).removeCopyBettingPlayer([bettorAddress]);
  // Verify that the isBettorExists mapping is updated correctly
  const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
  expect(exists).to.equal(false);
  // Check balance
  const balanceCopyBettingPost = await wxDAIContract.balanceOf(await copyBetting.getAddress());
  console.log(balanceCopyBettingPost, "balance post");
  expect(balanceCopyBettingPost).to.equal(balanceCopyBettingPre-withdrawAmount);

  // Check the betAmounts mapping to ensure the amount is set to zero
  const betAmount = await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress);
  expect(betAmount).to.equal(0);

  // Verify that the betsLeft mapping is set to zero
  const betsLeft = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
  expect(betsLeft).to.equal(0);
});

it('should add and remove multiple copy betting players', async () => {
  // Define the parameters for adding the players
  const bettor1Address = await user1.getAddress();
  const bettor2Address = await user2.getAddress();
  const amount = BigInt(ethers.parseUnits("20", 18));
  const amountToApprove = BigInt(ethers.parseUnits("200", 18));
  const betNumber = 5;

  // approve
  const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
  const approveOperation = await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);
  // check before adding new players
  const exists1Pre = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor1Address);
  const exists2Pre = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor2Address);
  expect(exists1Pre).to.equal(false);
  expect(exists2Pre).to.equal(false);

  const balanceCopyBetting = await wxDAIContract.balanceOf(await copyBetting.getAddress());

  // Add multiple copy betting players
  const tx = await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer(
    [bettor1Address, bettor2Address],
    [amount, amount],
    [betNumber, betNumber]
  );

  // Get the balances before removal
  const balanceCopyBettingPre = await wxDAIContract.balanceOf(await copyBetting.getAddress());

  // Verify that the isBettorExists mapping is updated correctly
  const exists1 = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor1Address);
  const exists2 = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor2Address);
  expect(exists1).to.equal(true);
  expect(exists2).to.equal(true);

  // Calculate the total withdrawn amount
  const withdrawAmount1 = (await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettor1Address)) * (await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettor1Address));
  const withdrawAmount2 = (await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettor2Address)) * (await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettor2Address));
  const totalWithdrawnAmount = withdrawAmount1 + withdrawAmount2;

  // Remove multiple copy betting players
  await copyBettingRegistryContract.connect(impersonatedSigner).removeCopyBettingPlayer(
    [bettor1Address, bettor2Address]
  );

  // Verify that the isBettorExists mapping is updated correctly
  const exists1After = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor1Address);
  const exists2After = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettor2Address);
  expect(exists1After).to.equal(false);
  expect(exists2After).to.equal(false);

  // Get the balances after removal
  const balanceCopyBettingPost = await wxDAIContract.balanceOf(await copyBetting.getAddress());

  // Verify that the contract's balance is reduced by the total withdrawn amount
  expect(balanceCopyBettingPost).to.equal(balanceCopyBettingPre - totalWithdrawnAmount);
  expect(balanceCopyBetting).to.equal(0);
});

it('should fail when removing a non-existent copy betting player', async () => {
  // Define an address that was not added previously
  const nonExistentBettorAddress = ethers.Wallet.createRandom().connect(ethers.provider);
  const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");

  // Attempt to remove a non-existent copy betting player
  try {
    await copyBettingRegistryContract.connect(impersonatedSigner).removeCopyBettingPlayer([nonExistentBettorAddress]);
    // If the removeCopyBettingPlayer call doesn't fail, this assertion will fail
    expect.fail('removeCopyBettingPlayer should have failed but did not.');
  } catch (error) {
    // Expect an error to be thrown indicating the function call failed
    expect(error.message).to.contain('');
  }
});

it('should fail when removing a non-existent copy betting player', async () => {
  // Define an address that was not added previously
  const nonExistentBettorAddress = ethers.Wallet.createRandom().connect(ethers.provider);
  // Attempt to remove a non-existent copy betting player
  try {
    await copyBettingRegistryContract.removeCopyBettingPlayer([nonExistentBettorAddress]);
    // If the removeCopyBettingPlayer call doesn't fail, this assertion will fail
    expect.fail('removeCopyBettingPlayer should have failed but did not.');
  } catch (error) {
    // Expect an error to be thrown indicating the function call failed
    expect(error.message).to.contain('');
  }
});

});