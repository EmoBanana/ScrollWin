// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";  // Import Foundry's Test utility
import "../src/market.sol";  // Import the main contract

contract PredictionMarketTest is Test {
    PredictionMarket public predictionMarket;

    address public owner = address(0x123);  // Owner of the contract
    address public user1 = address(0x456);  // First test user
    address public user2 = address(0x789);  // Second test user

    function setUp() public {
        // Initialize the PredictionMarket contract
        vm.prank(owner);  // Simulate the owner deploying the contract
        predictionMarket = new PredictionMarket();

        // Provide initial funds to users for testing
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // Test creating a market
    function testCreateMarket() public {
        string memory question = "Will ETH exceed $5,000 by June 2025?";
        uint256 duration = 7 days;

        // Create a new market (owner action)
        vm.prank(owner);
        predictionMarket.createMarket(question, duration);

        // Get market info
        PredictionMarket.MarketInfo memory marketInfo = predictionMarket.getMarketInfo(0);

        // Check if the market was created successfully
        assertEq(marketInfo.question, question, "Market question should match");
        assertTrue(marketInfo.isOpen, "Market should be open");
    }

    // Test placing a bet
    function testPlaceBet() public {
        string memory question = "Will ETH exceed $5,000 by June 2025?";
        uint256 duration = 7 days;

        // Create a new market (owner action)
        vm.prank(owner);
        predictionMarket.createMarket(question, duration);

        // User 1 places a bet on "Yes" (true)
        vm.prank(user1);
        predictionMarket.placeBet{value: 0.01 ether}(0, true);

        // Get user's bet info
        PredictionMarket.UserBet memory userBet = predictionMarket.getUserBet(0, user1);

        // Check the user's bet
        assertTrue(userBet.hasPlacedBet, "User should have placed a bet");
        assertEq(userBet.prediction, true, "User's prediction should be Yes");
        assertEq(userBet.amount, 0.01 ether, "Bet amount should be 0.01 ETH");
    }

    // Test resolving the market
    function testResolveMarket() public {
        string memory question = "Will ETH exceed $5,000 by June 2025?";
        uint256 duration = 7 days;

        // Create a new market (owner action)
        vm.prank(owner);
        predictionMarket.createMarket(question, duration);

        // Owner resolves the market (Yes wins)
        vm.prank(owner);
        predictionMarket.resolveMarket(0, true);

        // Get market info
        PredictionMarket.MarketInfo memory marketInfo = predictionMarket.getMarketInfo(0);

        // Check if the market is resolved
        assertTrue(marketInfo.isResolved, "Market should be resolved");
        assertTrue(marketInfo.outcome, "Market outcome should be Yes");
    }

    // Test claiming winnings
    function testClaimWinnings() public {
        string memory question = "Will ETH exceed $5,000 by June 2025?";
        uint256 duration = 7 days;

        // Create and resolve a market
        vm.prank(owner);
        predictionMarket.createMarket(question, duration);

        // User 1 places a bet on "Yes"
        vm.prank(user1);
        predictionMarket.placeBet{value: 0.01 ether}(0, true);

        // User 2 places a bet on "No"
        vm.prank(user2);
        predictionMarket.placeBet{value: 0.02 ether}(0, false);

        // Resolve the market in favor of "Yes"
        vm.prank(owner);
        predictionMarket.resolveMarket(0, true);

        // User 1 claims winnings
        vm.prank(user1);
        predictionMarket.claimWinnings(0);

        // Get user's bet info
        PredictionMarket.UserBet memory userBet = predictionMarket.getUserBet(0, user1);

        // Check if the winnings are claimed
        assertTrue(userBet.hasClaimed, "User should have claimed winnings");
    }

    // Test updating the platform fee
    function testUpdatePlatformFee() public {
        // Only the owner can update the fee
        vm.prank(owner);
        predictionMarket.updatePlatformFee(30); // Set fee to 3%

        uint256 updatedFee = predictionMarket.platformFee();
        assertEq(updatedFee, 30, "Platform fee should be updated to 3%");
    }
}
