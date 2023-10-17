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
    //const azuroBet = "0xA3A1B460c68dc91c5B3f71f5487A76fac42858bf";
    const azuroBet = "0x313c2AC3d997c31732933D2Eb73A335144B9c938";
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
/*
  it('should add a copy betting player and make a bet and fail to copy that bet twice', async () => {
    // Define the parameters for adding the player
    const bettorAddress = "0xceba077b74a8ef228d6d7f888f97cb5b06e99a7a";
    const betIdToCopy = 9848;
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
    const newBalanceContract = await wxDAIContract.balanceOf(copyBetting.getAddress());
    expect(initialBalance - amountToApprove).to.equal(newBalance);
    expect(newBalanceContract).to.equal(amountToApprove);

    // Verify that the isBettorExists mapping is updated correctly
    const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
    expect(exists).to.equal(true);

    // Check the betAmounts mapping for the correct amount
    const betAmount = await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress);
    const betsLefts = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect(betAmount.toString()).to.equal(amount.toString());
    expect((betAmount*betsLefts).toString()).to.equal(await wxDAIContract.balanceOf(copyBetting));

    // Verify that the betsLeft mapping is correctly initialized with the provided bet number
    const betsLeft = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect(betsLeft.toString()).to.equal(betNumber.toString());
    // bet on behalfOf user
    const copyBet = await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);
    try {
        await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);
        // If the betOnBehalfOfUser call doesn't fail, this assertion will fail
        expect.fail('betOnBehalfOfUser should have failed but did not.');
      } catch (error) {
        // Expect an error to be thrown indicating the function call failed
        expect(error.message).to.contain('bet already copied');
    }
});

it('should add a bettor, place a bet on behalf, remove the bettor, and fail to place another bet', async () => {
    // Define the parameters for adding the player
    const bettorAddress = "0xceba077b74a8ef228d6d7f888f97cb5b06e99a7a";
    const betIdToCopy = 9848;
    const amount = BigInt(ethers.parseUnits("1", 18));
    const betNumber = 5;
    const amountToApprove = BigInt(ethers.parseUnits("5", 18));

    // Get the initial contract balance
    const initialContractBalance = await wxDAIContract.balanceOf(copyBetting.getAddress());

    // Get the initial balance of the user adding the bettor
    const initialUserBalance = await wxDAIContract.balanceOf(await user1.getAddress());

    // Add the bettor
    const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
    await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);
    await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer([bettorAddress], [amount], [betNumber]);

    // Place a bet on behalf of the bettor
    await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);

    const betAmount = await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress);
    const betsLefts = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect(betAmount.toString()).to.equal(amount.toString());
    expect((betAmount*betsLefts).toString()).to.equal(await wxDAIContract.balanceOf(copyBetting));

    // Remove the bettor
    await copyBettingRegistryContract.connect(impersonatedSigner).removeCopyBettingPlayer([bettorAddress]);

    // Verify that the bettor has been removed
    const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
    expect(exists).to.equal(false);

    // Attempt to place another bet on behalf of the bettor (expect it to fail)
    try {
        await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);
        // If the betOnBehalfOfUser call doesn't fail, this assertion will fail
        expect.fail('betOnBehalfOfUser should have failed but did not.');
    } catch (error) {
        // Expect an error to be thrown indicating the function call failed
        expect(error.message).to.contain('bettor is not registered');
    }

    // Verify that the contract balance and user balances remain unchanged
    const finalContractBalance = await wxDAIContract.balanceOf(copyBetting.getAddress());
    expect(finalContractBalance).to.equal(initialContractBalance);
    const finalUserBalance = await wxDAIContract.balanceOf(await user1.getAddress());
    expect(finalUserBalance).to.equal(initialUserBalance);
});

it('should add a player and fail to bet on behalf with a non-existing betId to copy', async () => {
    // Define the parameters for adding the player
    const bettorAddress = "0xceba077b74a8ef228d6d7f888f97cb5b06e99a7a";
    const amount = BigInt(ethers.parseUnits("1", 18));
    const betNumber = 5;
    const amountToApprove = BigInt(ethers.parseUnits("5", 18));

    // Add the bettor
    const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
    await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);
    await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer([bettorAddress], [amount], [betNumber]);

    // Attempt to place a bet on behalf with a non-existing betId
    const nonExistingBetId = 12345; // Replace with a non-existing betId
    try {
        await copyBetting.betOnBehalfOfUser(impersonatedSigner, nonExistingBetId, bettorAddress);
        // If the betOnBehalfOfUser call doesn't fail, this assertion will fail
        expect.fail('betOnBehalfOfUser should have failed but did not.');
    } catch (error) {
        // Expect an error to be thrown indicating the non-existing betId
        expect(error.message).to.contain('');
    }
    // Verify that the player is still in the registry
    const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
    expect(exists).to.equal(true);
});
*/
it('should add multiple betting players and make a bet and fail to copy that bet twice', async () => {
    // Define the parameters for adding the player
    const numBettors = 5;
    const bettorAddresses = [];
    const amounts = [];
    const betNumbers = [];

    for (let i = 0; i < numBettors; i++) {
        const address = ethers.Wallet.createRandom().address; // Generate a random Ethereum address
        const amount = BigInt(ethers.parseUnits("1", 18)); // Replace with the desired amount
        const betNumber = 1; // Replace with the desired bet number

        bettorAddresses.push(address);
        amounts.push(amount);
        betNumbers.push(betNumber);
    }
    const bettorAddress = "0xceba077b74a8ef228d6d7f888f97cb5b06e99a7a";
    amounts.push(BigInt(ethers.parseUnits("1", 18)));
    betNumbers.push(1);
    bettorAddresses.push(bettorAddress);

    const betIdToCopy = 9848;
    const amountToApprove = BigInt(ethers.parseUnits("6", 18))
    // approve
    const impersonatedSigner = await ethers.getImpersonatedSigner("0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d");
    const preBalance = await wxDAIContract.balanceOf(impersonatedSigner.getAddress());

    // approve
    const approveOperation = await wxDAIContract.connect(impersonatedSigner).approve(await copyBettingRegistryContract.getAddress(), amountToApprove);

    const newAllowance = await wxDAIContract.allowance(impersonatedSigner.getAddress(), copyBettingRegistryContract.getAddress());
    // Add a copy betting player
    await copyBettingRegistryContract.connect(impersonatedSigner).addCopyBettingPlayer(bettorAddresses, amounts, betNumbers);
    
    const newBalance = await wxDAIContract.balanceOf(impersonatedSigner.getAddress());
    const newBalanceContract = await wxDAIContract.balanceOf(copyBetting.getAddress());
    //expect(amountToApprove).to.equal(preBalance-newBalance);
    expect(newBalanceContract).to.equal(amountToApprove);

    // Verify that the isBettorExists mapping is updated correctly
    const exists = await copyBettingRegistryContract.isBettorExists(impersonatedSigner.getAddress(), bettorAddress);
    expect(exists).to.equal(true);

    // Check the betAmounts mapping for the correct amount
    const betAmount = await copyBettingRegistryContract.betAmounts(impersonatedSigner.getAddress(), bettorAddress);
    const betsLefts = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect((betAmount*betsLefts).toString()).to.equal("1000000000000000000");

    // Verify that the betsLeft mapping is correctly initialized with the provided bet number
    const betsLeft = await copyBettingRegistryContract.betsLeft(impersonatedSigner.getAddress(), bettorAddress);
    expect(betsLeft.toString()).to.equal("1");
    // bet on behalfOf user
    const copyBet = await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);

    try {
        await copyBetting.betOnBehalfOfUser(impersonatedSigner, betIdToCopy, bettorAddress);
        // If the betOnBehalfOfUser call doesn't fail, this assertion will fail
        expect.fail('betOnBehalfOfUser should have failed but did not.');
      } catch (error) {
        // Expect an error to be thrown indicating the function call failed
        expect(error.message).to.contain('no bets left');
    }
});
});