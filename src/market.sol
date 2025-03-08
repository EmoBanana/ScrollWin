// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract PredictionMarket {
    struct Market {
        string question;        
        uint256 endTime;        
        bool isResolved;        
        bool outcome;            
        uint256 totalYesAmount; 
        uint256 totalNoAmount;  
        uint256 totalAmount;  
        mapping(address => Bet) bets; 
        address[] participants; 
    }

    struct Bet {
        bool hasPlacedBet;      
        bool prediction;
        uint256 amount;   
        bool hasClaimed; 
    }

    struct MarketInfo {
        string question;
        uint256 endTime;
        bool isResolved;
        bool outcome;
        uint256 totalYesAmount;
        uint256 totalNoAmount;
        uint256 totalAmount;
        bool isOpen;             
    }

    struct UserBet {
        bool hasPlacedBet;
        bool prediction;
        uint256 amount;
        bool hasClaimed;
    }

    address public owner;
    uint256 public platformFee; 
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    uint256[] public activeMarketIds;

    event MarketCreated(uint256 indexed marketId, string question, uint256 endTime);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, bool prediction, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier marketExists(uint256 marketId) {
        require(marketId < marketCount, "Market does not exist");
        _;
    }

    modifier marketNotResolved(uint256 marketId) {
        require(!markets[marketId].isResolved, "Market already resolved");
        _;
    }

    modifier marketOpen(uint256 marketId) {
        require(block.timestamp < markets[marketId].endTime, "Market betting period has ended");
        _;
    }

    constructor() {
        owner = msg.sender;
        platformFee = 20;
    }

    function createMarket(string memory _question, uint256 _duration) external onlyOwner {
        uint256 marketId = marketCount;
        Market storage market = markets[marketId];
        
        market.question = _question;
        market.endTime = block.timestamp + _duration;
        market.isResolved = false;
        
        activeMarketIds.push(marketId);
        
        emit MarketCreated(marketId, _question, market.endTime);
        marketCount++;
    }

    function placeBet(uint256 marketId, bool prediction) external payable 
        marketExists(marketId) 
        marketNotResolved(marketId)
        marketOpen(marketId)
    {
        require(msg.value > 0, "Bet amount must be greater than zero");
        Market storage market = markets[marketId];
        
        if (!market.bets[msg.sender].hasPlacedBet) {
            market.participants.push(msg.sender);
        } else {
            if (market.bets[msg.sender].prediction != prediction) {
                if (prediction) {
                    market.totalNoAmount -= market.bets[msg.sender].amount;
                    market.totalYesAmount += market.bets[msg.sender].amount;
                } else {
                    market.totalYesAmount -= market.bets[msg.sender].amount;
                    market.totalNoAmount += market.bets[msg.sender].amount;
                }
            }
        }

        market.bets[msg.sender].hasPlacedBet = true;
        market.bets[msg.sender].prediction = prediction;
        market.bets[msg.sender].amount += msg.value;
        market.bets[msg.sender].hasClaimed = false;
        
        if (prediction) {
            market.totalYesAmount += msg.value;
        } else {
            market.totalNoAmount += msg.value;
        }
        market.totalAmount += msg.value;
        
        emit BetPlaced(marketId, msg.sender, prediction, msg.value);
    }

    function resolveMarket(uint256 marketId, bool outcome) external 
        onlyOwner 
        marketExists(marketId) 
        marketNotResolved(marketId)
    {
        Market storage market = markets[marketId];
        market.isResolved = true;
        market.outcome = outcome;
        
        for (uint256 i = 0; i < activeMarketIds.length; i++) {
            if (activeMarketIds[i] == marketId) {
                activeMarketIds[i] = activeMarketIds[activeMarketIds.length - 1];
                activeMarketIds.pop();
                break;
            }
        }
        
        emit MarketResolved(marketId, outcome);
    }

    function claimWinnings(uint256 marketId) external 
        marketExists(marketId)
    {
        Market storage market = markets[marketId];
        require(market.isResolved, "Market not resolved yet");
        require(market.bets[msg.sender].hasPlacedBet, "No bet placed on this market");
        require(!market.bets[msg.sender].hasClaimed, "Winnings already claimed");
        require(market.bets[msg.sender].prediction == market.outcome, "You did not win this bet");
        
        uint256 betAmount = market.bets[msg.sender].amount;
        uint256 winningPool = market.outcome ? market.totalYesAmount : market.totalNoAmount;
        uint256 totalPool = market.totalAmount;
        
        uint256 feeAmount = (totalPool * platformFee) / 1000;
        uint256 poolAfterFee = totalPool - feeAmount;
        
        uint256 winnings = (betAmount * poolAfterFee) / winningPool;
        
        market.bets[msg.sender].hasClaimed = true;
        
        payable(msg.sender).transfer(winnings);
        
        emit WinningsClaimed(marketId, msg.sender, winnings);
    }

    function distributeWinnings(uint256 marketId) external 
        onlyOwner
        marketExists(marketId)
    {
        Market storage market = markets[marketId];
        require(market.isResolved, "Market not resolved yet");
        
        uint256 winningPool = market.outcome ? market.totalYesAmount : market.totalNoAmount;
        uint256 totalPool = market.totalAmount;
        
        uint256 feeAmount = (totalPool * platformFee) / 1000;
        uint256 poolAfterFee = totalPool - feeAmount;
        
        payable(owner).transfer(feeAmount);
        
        for (uint256 i = 0; i < market.participants.length; i++) {
            address participant = market.participants[i];
            Bet storage bet = market.bets[participant];
            
            if (bet.hasPlacedBet && bet.prediction == market.outcome && !bet.hasClaimed) {
                uint256 winnings = (bet.amount * poolAfterFee) / winningPool;
                bet.hasClaimed = true;
                payable(participant).transfer(winnings);
                emit WinningsClaimed(marketId, participant, winnings);
            }
        }
    }

    function updatePlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 100, "Fee too high"); // Max 10%
        platformFee = _platformFee;
    }

    function getMarketInfo(uint256 marketId) external view 
        marketExists(marketId)
        returns (MarketInfo memory)
    {
        Market storage market = markets[marketId];
        
        return MarketInfo({
            question: market.question,
            endTime: market.endTime,
            isResolved: market.isResolved,
            outcome: market.outcome,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount,
            totalAmount: market.totalAmount,
            isOpen: block.timestamp < market.endTime && !market.isResolved
        });
    }

    function getUserBet(uint256 marketId, address user) external view 
        marketExists(marketId)
        returns (UserBet memory)
    {
        Market storage market = markets[marketId];
        Bet storage bet = market.bets[user];
        
        return UserBet({
            hasPlacedBet: bet.hasPlacedBet,
            prediction: bet.prediction,
            amount: bet.amount,
            hasClaimed: bet.hasClaimed
        });
    }

    function getActiveMarketIds() external view returns (uint256[] memory) {
        return activeMarketIds;
    }

    function getMarketOdds(uint256 marketId) external view 
        marketExists(marketId)
        returns (uint256 yesPercentage, uint256 noPercentage)
    {
        Market storage market = markets[marketId];
        
        if (market.totalAmount == 0) {
            return (50, 50);
        }
        
        yesPercentage = (market.totalYesAmount * 100) / market.totalAmount;
        noPercentage = 100 - yesPercentage;
        
        return (yesPercentage, noPercentage);
    }
}