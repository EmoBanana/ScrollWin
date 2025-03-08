import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import { useWallet } from "./walletContext";
import PredictionMarketABI from "./abi.json";
import "./home.css";

const CONTRACT_ADDRESSES = {
  534351: "0x96a8755E1736C172DfE28278C6522db5F2BB0A75",
  78600: "0x96a8755E1736C172DfE28278C6522db5F2BB0A75",
};

export default function Home() {
  const { provider, account, chainId } = useWallet();
  const [contract, setContract] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState("");
  const [betPrediction, setBetPrediction] = useState(true); // true = yes, false = no
  const [networkName, setNetworkName] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  // Initialize contract when provider and chainId are available
  useEffect(() => {
    const initializeContract = async () => {
      if (!provider || !chainId) return;

      try {
        // Set network name
        if (chainId === 534351) {
          setNetworkName("Scroll Sepolia");
        } else if (chainId === 78600) {
          setNetworkName("Vanar Vanguard");
        } else {
          setNetworkName("Unsupported Network");
        }

        const contractAddress = CONTRACT_ADDRESSES[chainId];
        if (!contractAddress) {
          setLoading(false);
          return;
        }

        const signer = provider.getSigner();
        const contractInstance = new ethers.Contract(
          contractAddress,
          PredictionMarketABI,
          signer
        );
        setContract(contractInstance);
      } catch (error) {
        console.error("Error initializing contract:", error);
      }
    };

    initializeContract();
  }, [provider, chainId]);

  const loadMarkets = useCallback(async () => {
    if (!contract || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const activeMarketIds = await contract.getActiveMarketIds();

      const marketDetails = await Promise.all(
        activeMarketIds.map(async (id) => {
          const marketInfo = await contract.getMarketInfo(id);
          const userBet = await contract.getUserBet(id, account);
          const [yesPercentage, noPercentage] = await contract.getMarketOdds(
            id
          );

          return {
            id: id.toString(),
            question: marketInfo.question,
            endTime: new Date(marketInfo.endTime.toNumber() * 1000),
            isResolved: marketInfo.isResolved,
            outcome: marketInfo.outcome,
            totalYesAmount: ethers.utils.formatEther(marketInfo.totalYesAmount),
            totalNoAmount: ethers.utils.formatEther(marketInfo.totalNoAmount),
            totalAmount: ethers.utils.formatEther(marketInfo.totalAmount),
            isOpen: marketInfo.isOpen,
            userBet: {
              hasPlacedBet: userBet.hasPlacedBet,
              prediction: userBet.prediction,
              amount: ethers.utils.formatEther(userBet.amount),
              hasClaimed: userBet.hasClaimed,
            },
            odds: {
              yes: yesPercentage.toNumber(),
              no: noPercentage.toNumber(),
            },
          };
        })
      );

      setMarkets(marketDetails);
    } catch (error) {
      console.error("Error loading markets:", error);
    } finally {
      setLoading(false);
    }
  }, [contract, account]);

  // Load markets when contract and account change or refresh is triggered
  useEffect(() => {
    loadMarkets();
  }, [contract, account, loadMarkets, refreshTrigger]);

  // Redirect to landing if no wallet connected
  useEffect(() => {
    if (!account && !loading) {
      navigate("/");
    }
  }, [account, navigate, loading]);

  // Function to format wallet address (truncate middle)
  function formatWalletAddress(address) {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  }

  async function placeBet(marketId) {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      alert("Please enter a valid bet amount");
      return;
    }

    try {
      setLoading(true);
      const amountInWei = ethers.utils.parseEther(betAmount);

      const tx = await contract.placeBet(marketId, betPrediction, {
        value: amountInWei,
      });

      await tx.wait();
      alert("Bet placed successfully!");

      // Reset form and reload markets
      setBetAmount("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error placing bet:", error);
      alert(`Error placing bet: ${error.message}`);
      setLoading(false);
    }
  }

  async function claimWinnings(marketId) {
    try {
      setLoading(true);
      const tx = await contract.claimWinnings(marketId);
      await tx.wait();
      alert("Winnings claimed successfully!");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error claiming winnings:", error);
      alert(`Error claiming winnings: ${error.message}`);
      setLoading(false);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  function timeLeft(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m`;
  }

  // Helper function to determine if user can claim winnings
  function canClaimWinnings(market) {
    return (
      market.isResolved &&
      market.userBet.hasPlacedBet &&
      market.userBet.prediction === market.outcome &&
      !market.userBet.hasClaimed
    );
  }

  return (
    <div className="prediction-container">
      <header className="prediction-header">
        <h1>Prediction Markets</h1>

        <div className="account-info">
          {chainId && (
            <div className="network-badge">
              <span>{networkName}</span>
            </div>
          )}

          {account && <span>{formatWalletAddress(account)}</span>}
        </div>
      </header>

      {account &&
        chainId &&
        !CONTRACT_ADDRESSES[chainId] &&
        !CONTRACT_ADDRESSES[parseInt(chainId, 16)] && (
          <div className="network-warning">
            <p>
              Please connect to a supported network (Scroll Sepolia or Vanar
              Chain Testnet)
            </p>
          </div>
        )}

      <div className="refresh-control">
        <button
          className="refresh-button"
          onClick={() => setRefreshTrigger((prev) => prev + 1)}
        >
          Refresh Markets
        </button>
      </div>

      {loading && account ? (
        <div className="loading-container">
          <p>Loading markets...</p>
        </div>
      ) : account && markets.length === 0 ? (
        <div className="empty-markets">
          <p>No active markets found.</p>
        </div>
      ) : account ? (
        <div className="markets-grid">
          {markets.map((market) => (
            <div key={market.id} className="market-card">
              <div className="market-header">
                <h2>{market.question}</h2>
                <div className="market-timing">
                  <span>Ends: {formatDate(market.endTime)}</span>
                  <span className="time-left">
                    {timeLeft(market.endTime)} left
                  </span>
                </div>
                <h2>{market.id}</h2>
              </div>

              <div className="market-stats">
                <div className="stat-box">
                  <div className="stat-value">{market.odds.yes}%</div>
                  <div className="stat-label">Yes</div>
                  <div className="stat-amount">{market.totalYesAmount} ETH</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{market.odds.no}%</div>
                  <div className="stat-label">No</div>
                  <div className="stat-amount">{market.totalNoAmount} ETH</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{market.totalAmount} ETH</div>
                  <div className="stat-label">Total Pool</div>
                </div>
              </div>

              {market.userBet.hasPlacedBet ? (
                <div className="user-bet-info">
                  <p>
                    Your bet:{" "}
                    <span className="bet-value">
                      {market.userBet.prediction ? "Yes" : "No"}
                    </span>
                  </p>
                  <p>
                    Amount:{" "}
                    <span className="bet-value">
                      {market.userBet.amount} ETH
                    </span>
                  </p>

                  {canClaimWinnings(market) && (
                    <button
                      className="claim-button"
                      onClick={() => claimWinnings(market.id)}
                    >
                      Claim Winnings
                    </button>
                  )}
                </div>
              ) : market.isOpen ? (
                <div className="betting-ui">
                  <div className="prediction-toggle">
                    <button
                      className={
                        betPrediction ? "toggle-button active" : "toggle-button"
                      }
                      onClick={() => setBetPrediction(true)}
                    >
                      Yes
                    </button>
                    <button
                      className={
                        !betPrediction
                          ? "toggle-button active"
                          : "toggle-button"
                      }
                      onClick={() => setBetPrediction(false)}
                    >
                      No
                    </button>
                  </div>

                  <div className="betting-input">
                    <input
                      type="number"
                      placeholder="Bet amount in ETH"
                      className="amount-input"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min="0.001"
                      step="0.001"
                    />
                    <button
                      className="bet-button"
                      onClick={() => placeBet(market.id)}
                      disabled={!betAmount}
                    >
                      Place Bet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="market-closed">
                  <p>Betting is closed for this market</p>
                </div>
              )}

              {market.isResolved && (
                <div
                  className={`outcome-banner ${
                    market.outcome ? "yes-outcome" : "no-outcome"
                  }`}
                >
                  <p>Outcome: {market.outcome ? "Yes" : "No"}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="connect-prompt">
          <p>Connect your wallet to view prediction markets</p>
        </div>
      )}
    </div>
  );
}
