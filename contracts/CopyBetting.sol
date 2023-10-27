// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ILP.sol";
import "./IPrematchCore.sol";
import "./IAzuroBet.sol";
import "./ICoreBase.sol";
import "./IBet.sol";
import "./ICopyBettingRegistry.sol";
import "./ICopyBetting.sol";

// Interface for the New Prematch Core contract, which extends the CoreBase interface.
interface INewPrematchCore is ICoreBase {
    event NewBet(
        address indexed bettor,
        address indexed affiliate,
        uint256 indexed conditionId,
        uint256 tokenId,
        uint64 outcomeId,
        uint128 amount,
        uint64 odds,
        uint128[2] funds
    );

    function resolveCondition(uint256 conditionId, uint64 outcomeWin) external;
    function bets(uint256 key) external view returns (Bet memory);
    function conditions(uint256 key) external view returns (Condition memory);
}

// CopyBetting contract for copying bets on behalf of users.
contract CopyBetting is ICopyBetting {

    ICopyBettingRegistry public registry;
    address public registryAddress;
    ILP private _lp;
    INewPrematchCore public coreInstance;
    IAzuroBet public azuroBet;

    address public coreBase;
    address public lpAddress;
    uint128 public amountToCopybetWith;
    address public erc20Token;
    bool public initialized;

    // Mapping to keep track of copied bet IDs for each copier.
    mapping(address => mapping(uint256 => bool)) public copyBetIds;

    /**
     * @dev Initializes the CopyBetting contract with essential parameters.
     *
     * @param _coreBaseAddress The address of the CoreBase contract.
     * @param _lpAddress The address of the LP (Liquidity Provider) contract.
     * @param _azuroBet The address of the AzuroBet contract.
     * @param _registryAddress The address of the CopyBettingRegistry contract.
     * @param _erc20Token The address of the ERC20 token used for betting.
     */
    function initialize(address _coreBaseAddress, address _lpAddress, address _azuroBet, address _registryAddress, address _erc20Token) external {
        require(!initialized, "Already initialized");
        _initialize(_coreBaseAddress, _lpAddress, _azuroBet, _registryAddress, _erc20Token);
    }

    // Internal initialization function.
    function _initialize(address _coreBaseAddress, address _lpAddress, address _azuroBet, address _registryAddress, address _erc20Token) internal {
        coreInstance = INewPrematchCore(_coreBaseAddress);
        _lp = ILP(_lpAddress);
        coreBase = _coreBaseAddress;
        lpAddress = _lpAddress;
        azuroBet = IAzuroBet(_azuroBet);
        registry = ICopyBettingRegistry(_registryAddress);
        registryAddress = _registryAddress;
        erc20Token = _erc20Token;
        initialized = true;
    }

    /**
     * @dev Retrieves the condition and outcome for a given bet ID.
     *
     * @param betId The ID of the bet.
     * @return condition The condition associated with the bet.
     * @return outcome The outcome of the bet.
     */
    function getBetById(uint256 betId) public view returns (uint256, uint64) {
        // Call the bets function of the contract instance
        INewPrematchCore.Bet memory bet = coreInstance.bets(betId);
        require(!bet.isPaid, "Bet expired");
        uint256 condition = bet.conditionId;
        uint64 outcome = bet.outcome;
        require(condition > 0 && outcome > 0, "Invalid bet ID");
        return (condition, outcome);
    }

    /**
     * @dev Allows a copier to place a bet on behalf of a user and copy the bet.
     *
     * @param copier The address of the copier.
     * @param betId The ID of the bet to copy.
     * @param bettor The address of the bettor.
     * @return The sender's address and the ID of the copied bet.
     */
    function betOnBehalfOfUser(address copier, uint256 betId, address bettor) public returns (address, uint256) {
        require(copier != address(0) && bettor != address(0), "Invalid addresses");
        // Check validation on the Registry contract
        (uint128 amountToCopy) = registry.checkValidation(copier, betId, bettor);
        // Get the condition and outcome starting from the betId
        (uint256 condition, uint64 outcome) = getBetById(betId);
        // The same bet can't be copied more than once for that copier address
        require(!copyBetIds[copier][betId], "Bet already copied");
        // Build the bet object
        uint64 newMinOdds = 1;
        IBet.BetData memory betData = IBet.BetData(
          address(this),
          newMinOdds,
          abi.encode(condition, outcome)
        );
        uint64 expiresAt = uint64(block.timestamp + block.timestamp);
        // Approve the LP contract to spend tokens for betting
        IERC20(erc20Token).approve(lpAddress, amountToCopy);
        // Place a bet for the player
        uint256 idBet = _lp.betFor(copier, address(coreBase), amountToCopy, expiresAt, betData);
        // Update the registry
        registry.updateHookBetsLeft(copier, bettor);
        copyBetIds[copier][betId] = true;

        emit copyBet(copier, bettor, amountToCopy, idBet);
        return (msg.sender, idBet);
    }

    /**
     * @dev Withdraws tokens from the Copy Betting contract and transfers them to the copier.
     *
     * @param copier The address of the copier.
     * @param amount The amount of tokens to withdraw.
     */
    function withdrawCopierHook(address copier, uint256 amount) external {
        require(msg.sender == registryAddress, "Invalid sender");
        require(IERC20(erc20Token).balanceOf(address(this)) >= amount, "Not enough balance");
        require(IERC20(erc20Token).transfer(copier, amount), "Transfer failed");
    }
}
