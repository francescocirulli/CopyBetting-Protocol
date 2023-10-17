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

    mapping(address => mapping(uint256 => bool)) public copyBetIds;

    function initialize(address _coreBaseAddress, address _lpAddress, address _azuroBet, address _registryAddress, address _erc20Token) external {
        require(!initialized);
        _initialize(_coreBaseAddress, _lpAddress, _azuroBet, _registryAddress, _erc20Token);
    }

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

    function getBetById(uint256 betId) public view returns (uint256, uint64) {
        // Call the bets function of the contract instance
        INewPrematchCore.Bet memory bet = coreInstance.bets(betId);
        require(!bet.isPaid, "bet expired");
        uint256 condition = bet.conditionId;
        uint64 outcome = bet.outcome;
        require(condition > 0 && outcome > 0, "invalid bet id");
        return (condition, outcome);
    }

    function betOnBehalfOfUser(address copier, uint256 betId, address bettor) public returns(address, uint256) {
        require(copier!=address(0) && bettor!=address(0), "invalid addresses");
        // check validation on the Registry contract
        (uint128 amountToCopy) = registry.checkValidation(copier,betId,bettor);
        // get the condition and outcome starting from the betId
        (uint256 condition, uint64 outcome) = getBetById(betId);
        // the same bet can't be copied more than once for that copier address
        require(!copyBetIds[copier][betId], "bet already copied");
        // build the bet object
        uint64 newMinOdds = 1;
        IBet.BetData memory betData = IBet.BetData(
          address(this),
          newMinOdds,
          abi.encode(condition, outcome)
        );
        uint64 expiresAt = uint64(block.timestamp+block.timestamp);
        // approve the lp contract to spend in order to bet
        IERC20(erc20Token).approve(lpAddress, amountToCopy);
        // bet for the player
        uint256 idBet = _lp.betFor(copier, address(coreBase), amountToCopy, expiresAt, betData);
        // update the registry
        registry.updateHookBetsLeft(copier, bettor);
        copyBetIds[copier][betId] = true;

        emit copyBet(copier, bettor, amountToCopy, idBet);
        return (msg.sender, idBet);
    }

    function withdrawCopierHook(address copier, uint256 amount) external{
        require(msg.sender == registryAddress, "invalid sender");
        require(IERC20(erc20Token).balanceOf(address(this))>= amount, "not enough balance");
        require(IERC20(erc20Token).transfer(copier, amount));
    }
}