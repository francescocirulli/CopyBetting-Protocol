// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
interface ICopyBetting {

    event copyBet (
        address indexed copier,
        address bettor,
        uint256 amount,
        uint256 betId
    );
    event payOutCopyBet (
        address copier,
        uint256 betId
    );

    function getBetById(uint256 betId) external view returns (uint256, uint64);
    function betOnBehalfOfUser(address copier, uint256 betId, address bettor) external returns(address, uint256);
    function withdrawCopierHook(address copier, uint256 amount) external;
}