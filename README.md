# CopyBetting Protocol (Azuro)

The CopyBetting protocol enables users to replicate, or copybet, bets made by other players on the Azuro protocol, regardless of the frontend operator. Copybetting involves duplicating the bets, particularly the match and outcome, made by another player.

## Components

The protocol consists of two primary components:

### CopyBettingRegistry

The `CopyBettingRegistry` contract provides users with the ability to:

1. Select one or more addresses to copybet.
2. Define the number of bets they wish to copybet.
3. Specify the amount to bet on each copybet automatically.

using the function addCopyBettingPlayer(address[] memory newBettors, uint128[] memory amounts, uint256[] memory betNumbers)

Users initiate this process by depositing an amount equivalent to the product of the number of bets (2) and the specified wager amount in an ERC20 token (3). For example, WXDAI on the Gnosis platform can be used.

### CopyBettingEngine

The `CopyBettingEngine` contract contains the logic for executing copybets. It exposes the following method:

#### `betOnBehalfOfUser(address copier, uint256 betId, address bettor)`

- `copier`: The wallet address that wishes to copy the bet.
- `betId`: Identifies the specific bet to be replicated.
- `bettor`: The address of the player whose bet is being copied.

The method automatically retrieves bet data, including the match and outcome, from the specified `betId` calling the Azuro PreMtachCore contract. It then uses the funds previously deposited by the user to place the bet. The copied bet is sent directly to the `copier's` address for redeeming. The `CopyBettingEngine` keeps track of the remaining number of plays a user can copybet, decrementing it with each copybet until it reaches zero. At this point, further copying is no longer allowed for that player.

## Usage

1. Utilize the `CopyBettingRegistry` contract to select the addresses you intend to copybet.
2. Specify the number of bets you wish to copybet and the amount to be wagered on each copybeted bet. A transfer of ERC20 to the CopyBettingEngine contract will be required

To replicate a bet:

1. Monitor play events on the Azuro protocol (and so covering all its associated frontend).
2. When a valid copier-bettor match is identified, call the `betOnBehalfOfUser(...)` method in the `CopyBettingEngine` with the appropriate parameters.
3. The copied bet will be placed using the deposited funds and sent to the copier's address for redeeming.

In production, the "replicate a bet" action will be automatically made by a third-party bot so that users should never interact with the `CopyBettingEngine`.
In this way, there is no friction for bettors' adoption since they can bet on any frontend operators and be copybetted. 
