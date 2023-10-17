// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ICopyBettingRegistry {

    event NewBettorsAdded(
        address indexed copier,
        address[] playersToCopy,
        uint128[] baseAmount 
    );

    function addCopyBettingPlayer(address[] memory newBettors, uint128[] memory amounts, uint256[] memory betNumber) external;

    function removeCopyBettingPlayer(address[] memory bettorsToRemove) external;

    function isBettorExists(address owner, address bettor) external view returns (bool);

    function betAmounts(address owner, address bettor) external view returns (uint128);

    function betsLeft(address owner, address bettor) external view returns (uint256);

    function updateHookBetsLeft(address copier, address bettor) external;

    function checkValidation(address copier, uint256 betId, address bettor) external view returns(uint128);
}