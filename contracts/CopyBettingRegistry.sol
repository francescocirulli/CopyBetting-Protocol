// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Importing required interfaces and contracts
import "./ICopyBettingRegistry.sol";
import "./CopyBetting.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// The main contract for managing Copy Betting registrations and interactions.
contract CopyBettingRegistry is ICopyBettingRegistry {
    ICopyBetting public copyBettingEngine;

    // Data storage mappings to manage Copy Betting information.
    mapping(address => address[]) public copyBettingPlayers;
    mapping(address => mapping(address => bool)) public isBettorExists;
    mapping(address => mapping(address => uint128)) public betAmounts;
    mapping(address => mapping(address => uint256)) public betsLeft;

    bool public initialized;
    address public copyBettingEngineAddress;
    address public erc20Token;
    address azuroBet;

    /**
     * @dev Initializes the CopyBettingRegistry contract with essential parameters.
     *
     * @param _copyBettingEngine The address of the Copy Betting Engine contract.
     * @param _erc20Token The address of the ERC20 token used for betting.
     * @param _azuroBet The address of the AzuroBet contract.
     */
    function initialize(
        address _copyBettingEngine,
        address _erc20Token,
        address _azuroBet
    ) external {
        require(!initialized, "Already initialized");
        _initialize(_copyBettingEngine, _erc20Token, _azuroBet);
    }

    // Internal initialization function.
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

    /**
     * @dev Adds new Copy Betting players and their associated betting details.
     *
     * @param newBettors An array of new bettor addresses.
     * @param amounts An array of corresponding bet amounts.
     * @param betNumbers An array of the number of bets to copy.
     */
    function addCopyBettingPlayer(
        address[] memory newBettors,
        uint128[] memory amounts,
        uint256[] memory betNumbers
    ) public {
        require(newBettors.length > 0, "At least one bettor address must be provided");
        require(
            newBettors.length == amounts.length &&
            amounts.length == betNumbers.length,
            "Arrays must have the same length"
        );

        for (uint256 i = 0; i < newBettors.length; i++) {
            address bettor = newBettors[i];
            uint128 amount = amounts[i];
            uint256 betNumber = betNumbers[i];
            require(amount != 0 && betNumber != 0, "Invalid amount");
            require(bettor != address(0), "Invalid bettor");

            if (!isBettorExists[msg.sender][bettor]) {
                // Add the bettor to the current bettors list.
                copyBettingPlayers[msg.sender].push(bettor);
                // Set the flag to indicate that this bettor exists.
                isBettorExists[msg.sender][bettor] = true;
                // Set the amount associated with this bettor.
                betAmounts[msg.sender][bettor] = amount;
                betsLeft[msg.sender][bettor] = betNumber;
                // Transfer the required amount of tokens to the Copy Betting Engine.
                require(
                    IERC20(erc20Token).transferFrom(
                        msg.sender,
                        copyBettingEngineAddress,
                        uint256(amount) * betNumber
                    ),
                    "Transfer failed"
                );
            }
        }
        emit NewBettorsAdded(msg.sender, newBettors, amounts);
    }

    /**
     * @dev Removes Copy Betting players and refunds their remaining tokens.
     *
     * @param bettorsToRemove An array of bettor addresses to remove.
     */
    function removeCopyBettingPlayer(address[] memory bettorsToRemove) public {
        require(
            bettorsToRemove.length > 0,
            "At least one bettor address to remove must be provided"
        );

        for (uint256 i = 0; i < bettorsToRemove.length; i++) {
            address bettor = bettorsToRemove[i];
            require(bettor != address(0), "Invalid bettor");

            if (isBettorExists[msg.sender][bettor]) {
                // Find the index of the bettor to remove.
                uint256 indexToRemove = findIndex(copyBettingPlayers[msg.sender], bettor);
                // Ensure that the index exists.
                require(
                    indexToRemove < copyBettingPlayers[msg.sender].length,
                    "Bettor not found in the list"
                );
                // Swap the bettor with the last element and then pop the last element.
                copyBettingPlayers[msg.sender][indexToRemove] = copyBettingPlayers[msg.sender][copyBettingPlayers[msg.sender].length - 1];
                copyBettingPlayers[msg.sender].pop();
                // Set the flag to indicate that this bettor no longer exists.
                isBettorExists[msg.sender][bettor] = false;
                // Store betAmounts and betsLeft
                uint256 actualAmount = uint256(betAmounts[msg.sender][bettor]);
                uint256 actualBetsLeft = betsLeft[msg.sender][bettor];
                // Remove the amount and set the flag to indicate that this bettor no longer exists.
                betAmounts[msg.sender][bettor] = 0;
                betsLeft[msg.sender][bettor] = 0;
                // Refund the bettor's remaining tokens.
                withdrawCopier(msg.sender, actualAmount, actualBetsLeft);
            }
        }
    }

    /**
     * @dev Withdraws tokens from the Copy Betting Engine and transfers them to the bettor.
     *
     * @param copier The address of the copier.
     * @param actualAmount The actual amount of tokens to withdraw.
     * @param actualBetsLeft The number of remaining bets for the copier.
     */
    function withdrawCopier(address copier, uint256 actualAmount, uint256 actualBetsLeft) internal {
        require(actualAmount != 0 && actualBetsLeft != 0, "inavlid amount param");
        uint256 amount = actualAmount * actualBetsLeft;
        // Call the Copy Betting Engine's withdrawal function.
        copyBettingEngine.withdrawCopierHook(copier, amount);
    }

    /**
     * @dev Updates the number of remaining bets for a copier and handles removal if no bets are left.
     *
     * @param copier The address of the copier.
     * @param bettor The address of the bettor.
     */
    function updateHookBetsLeft(address copier, address bettor) external {
        require((msg.sender == copyBettingEngineAddress), "Not authorized");
        betsLeft[copier][bettor] -= 1;
        // If betsLeft is 0, remove the amount and set the flag to indicate that this bettor no longer exists.
        if (betsLeft[copier][bettor] == 0) {
            isBettorExists[copier][bettor] = false;
            betAmounts[copier][bettor] = 0;
        }
    }

    /**
     * @dev Checks the validation of a bettor for a copier.
     *
     * @param copier The address of the copier.
     * @param betId The ID of the bet.
     * @param bettor The address of the bettor.
     * @return The amount to be copied by the registry.
     */
    function checkValidation(address copier, uint256 betId, address bettor) external view returns (uint128) {
        // Check if the bettor is registered for the copier.
        require(isBettorExists[copier][bettor], "Bettor is not registered");
        require(betsLeft[copier][bettor] > 0, "No bets left");
        require(
            isBettorForCopier(copier, IERC721(azuroBet).ownerOf(betId)),
            "Bettor not authorized."
        );
        // Get the amount to bet by the registry.
        uint128 amountToCopy = betAmounts[copier][bettor];
        return amountToCopy;
    }

    /**
     * @dev Checks if a bettor is registered for a copier.
     *
     * @param copier The address of the copier.
     * @param bettor The address of the bettor.
     * @return True if the bettor is registered for the copier, otherwise false.
     */
    function isBettorForCopier(address copier, address bettor) internal view returns (bool) {
        address[] storage bettors = copyBettingPlayers[copier];
        for (uint256 i = 0; i < bettors.length; i++) {
            if (bettors[i] == bettor) {
                return true; // The bettor is in the array
            }
        }
        return false; // The bettor is not in the array
    }

    /**
     * @dev Helper function to find the index of an element in an array.
     *
     * @param arr The array in which to find the element.
     * @param element The element to find.
     * @return The index of the element in the array or type(uint256).max if not found.
     */
    function findIndex(address[] storage arr, address element) internal view returns (uint256) {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == element) {
                return i;
            }
        }
        return type(uint256).max;
    }
}
