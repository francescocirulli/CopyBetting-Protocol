// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ICopyBettingRegistry.sol";
import "./CopyBetting.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract CopyBettingRegistry is ICopyBettingRegistry {
  ICopyBetting public copyBettingEngine;

  mapping(address => address[]) public copyBettingPlayers;
  mapping(address => mapping(address => bool)) public isBettorExists;
  mapping(address => mapping(address => uint128)) public betAmounts;
  mapping(address => mapping(address => uint256)) public betsLeft;

  bool public initialized;
  address public copyBettingEngineAddress;
  address public erc20Token;
  address azuroBet;

  function initialize(
    address _copyBettingEngine,
    address _erc20Token,
    address _azuroBet
  ) external {
    require(!initialized);
    _initialize(_copyBettingEngine, _erc20Token, _azuroBet);
  }

  function _initialize(
    address _copyBettingEngine,
    address _erc20Token,
    address _azuroBet
  ) internal {
    copyBettingEngine = ICopyBetting(_copyBettingEngine);
    copyBettingEngineAddress = _copyBettingEngine;
    erc20Token = _erc20Token;
    azuroBet = _azuroBet;
    initialized = true;
  }

  function addCopyBettingPlayer(
    address[] memory newBettors,
    uint128[] memory amounts,
    uint256[] memory betNumbers
  ) public {
    require(
      newBettors.length > 0,
      "At least one bettor address must be provided"
    );
    require(
      newBettors.length == amounts.length &&
        amounts.length == betNumbers.length,
      "Arrays must have the same length"
    );

    for (uint256 i = 0; i < newBettors.length; i++) {
      address bettor = newBettors[i];
      uint128 amount = amounts[i];
      uint256 betNumber = betNumbers[i];
      require(amount != 0 && betNumber != 0, "invalid amount");
      require(bettor != address(0), "invalid bettor");

      if (!isBettorExists[msg.sender][bettor]) {
        // Add the bettor to the current bettors list.
        copyBettingPlayers[msg.sender].push(bettor);
        // Set the flag to indicate that this bettor exists.
        isBettorExists[msg.sender][bettor] = true;
        // Set the amount associated with this bettor.
        betAmounts[msg.sender][bettor] = amount;
        betsLeft[msg.sender][bettor] = betNumber;
        // The copybetting engine receives amount of each bet to copy with * how many bets to copy
        require(
          IERC20(erc20Token).transferFrom(
            msg.sender,
            copyBettingEngineAddress,
            uint256(amount) * betNumber
          )
        , "transfer failed");
      }
    }
    emit NewBettorsAdded(msg.sender, newBettors, amounts);
  }

  function removeCopyBettingPlayer(address[] memory bettorsToRemove) public {
    require(
      bettorsToRemove.length > 0,
      "At least one bettor address to remove must be provided"
    );

    for (uint256 i = 0; i < bettorsToRemove.length; i++) {
      address bettor = bettorsToRemove[i];
      require(bettor != address(0),"invalid bettor");

      if (isBettorExists[msg.sender][bettor]) {
        // Find the index of the bettor to remove.
        uint256 indexToRemove = findIndex(
          copyBettingPlayers[msg.sender],
          bettor
        );
        // Ensure that the index exists.
        require(
          indexToRemove < copyBettingPlayers[msg.sender].length,
          "Bettor not found in the list"
        );
        // Swap the bettor with the last element and then pop the last element.
        copyBettingPlayers[msg.sender][indexToRemove] = copyBettingPlayers[
          msg.sender
        ][copyBettingPlayers[msg.sender].length - 1];
        copyBettingPlayers[msg.sender].pop();
        // Set the flag to indicate that this bettor no longer exists.
        isBettorExists[msg.sender][bettor] = false;
        // Store betAmounts and betsLeft
        uint256 actualAmount = uint256(betAmounts[msg.sender][bettor]);
        uint256 actualbetsLeft = betsLeft[msg.sender][bettor];
        // Remove the amount and set the flag to indicate that this bettor no longer exists.
        betAmounts[msg.sender][bettor] = 0;
        betsLeft[msg.sender][bettor] = 0;
        withdrawCopier(msg.sender, actualAmount, actualbetsLeft);
      }
    }
  }

  function withdrawCopier(
    address copier,
    uint256 actualAmount,
    uint256 actualbetsLeft
  ) internal {
    require(actualAmount != 0 && actualbetsLeft != 0);
    uint256 amount = actualAmount * actualbetsLeft;
    copyBettingEngine.withdrawCopierHook(copier, amount);
  }

  function updateHookBetsLeft(address copier, address bettor) external {
    require((msg.sender == copyBettingEngineAddress), "not authorized");
    betsLeft[copier][bettor] -= 1;
    // if betsLeft is 0, emove the amount and set the flag to indicate that this bettor no longer exists.
    if(betsLeft[copier][bettor] == 0) {
      isBettorExists[copier][bettor] = false;
      betAmounts[copier][bettor] = 0;
    }
  }

  function checkValidation(
    address copier,
    uint256 betId,
    address bettor
  ) external view returns (uint128) {
    // check is a valid copier <> bettor
    require(isBettorExists[copier][bettor], "bettor is not registered");
    require(betsLeft[copier][bettor] > 0, "no bets left");
    require(
      isBettorForCopier(copier, IERC721(azuroBet).ownerOf(betId)),
      "Bettor not authorized."
    ); // get amount to bet by the registry
    uint128 amountToCopy = betAmounts[copier][bettor];
    return (amountToCopy);
  }

  function isBettorForCopier(
    address copier,
    address bettor
  ) internal view returns (bool) {
    address[] storage bettors = copyBettingPlayers[copier];
    for (uint256 i = 0; i < bettors.length; i++) {
      if (bettors[i] == bettor) {
        return true; // The bettor is in the array
      }
    }
    return false; // The bettor is not in the array
  }

  // Helper function to find the index of an element in an array.
  function findIndex(
    address[] storage arr,
    address element
  ) internal view returns (uint256) {
    for (uint256 i = 0; i < arr.length; i++) {
      if (arr[i] == element) {
        return i;
      }
    }
    return type(uint256).max;
  }
}
