import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import { useWallet } from "./walletContext";
import PredictionMarketABI from "./abi.json";
import "./admin.css";

const CONTRACT_ADDRESSES = {
  534351: "0x96a8755E1736C172DfE28278C6522db5F2BB0A75",
  78600: "0x96a8755E1736C172DfE28278C6522db5F2BB0A75",
};

export default function Admin() {
  const { provider, account, chainId } = useWallet();
  const [isOwner, setIsOwner] = useState(false);
  const [question, setQuestion] = useState("");
  const [duration, setDuration] = useState("");
  const [marketId, setMarketId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const navigate = useNavigate();

  // Initialize contract and check if owner
  useEffect(() => {
    const initializeContract = async () => {
      if (!provider || !account) {
        // Don't redirect yet, just wait for wallet connection
        return;
      }

      try {
        // Make sure we have a valid chainId
        const numericChainId =
          typeof chainId === "string" ? parseInt(chainId, 16) : chainId;

        const contractAddress = CONTRACT_ADDRESSES[numericChainId];
        if (!contractAddress) {
          console.log("No contract address for chainId:", numericChainId);
          setLoading(false);
          setCheckingOwner(false);
          return;
        }

        const signer = provider.getSigner();
        const contractInstance = new ethers.Contract(
          contractAddress,
          PredictionMarketABI,
          signer
        );

        setContract(contractInstance);

        // Check if connected account is owner
        const ownerAddress = await contractInstance.owner();
        const isOwnerAccount =
          ownerAddress.toLowerCase() === account.toLowerCase();
        console.log("Owner check:", {
          ownerAddress,
          account,
          isOwner: isOwnerAccount,
        });

        setIsOwner(isOwnerAccount);
        setCheckingOwner(false);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing contract:", error);
        setCheckingOwner(false);
        setLoading(false);
      }
    };

    initializeContract();
  }, [provider, account, chainId]);

  // Only redirect if we've completed the owner check and the user isn't the owner
  useEffect(() => {
    if (!checkingOwner && !loading) {
      // If we don't have an account at all, go to landing page
      if (!account) {
        navigate("/");
      }
      // If we have an account but not owner, go to home page
      else if (!isOwner) {
        navigate("/home");
      }
    }
  }, [checkingOwner, loading, isOwner, account, navigate]);

  const createMarket = async () => {
    if (!question || !duration) {
      alert("Please enter a valid question and duration.");
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.createMarket(question, duration);
      await tx.wait();
      alert("Market created successfully!");
      setQuestion("");
      setDuration("");
    } catch (error) {
      console.error("Error creating market:", error);
      alert("Failed to create market.");
    } finally {
      setLoading(false);
    }
  };

  const resolveMarket = async () => {
    if (!marketId || outcome === "") {
      alert("Please enter a valid market ID and outcome.");
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.resolveMarket(marketId, outcome === "yes");
      await tx.wait();

      // Distribute winnings after resolving
      await contract.distributeWinnings(marketId);
      alert("Market resolved and winnings distributed successfully!");
      setMarketId("");
      setOutcome("");
    } catch (error) {
      console.error("Error resolving market:", error);
      alert("Failed to resolve market.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking ownership
  if (checkingOwner) {
    return <div>Checking admin permissions...</div>;
  }

  // We don't need this check anymore as the useEffect will redirect
  // if (!isOwner) {
  //   return <div>Access denied. You must be the contract owner to access this page.</div>;
  // }

  return (
    <div className="admin-container">
      <h1>Admin Page</h1>

      <div className="create-market-section">
        <h2>Create Market</h2>
        <input
          type="text"
          placeholder="Enter market question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <input
          type="number"
          placeholder="Enter market duration (seconds)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <button onClick={createMarket} disabled={loading}>
          {loading ? "Creating..." : "Create Market"}
        </button>
      </div>

      <div className="resolve-market-section">
        <h2>Resolve Market</h2>
        <input
          type="text"
          placeholder="Enter market ID"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        />
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Select outcome</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        <button onClick={resolveMarket} disabled={loading}>
          {loading ? "Resolving..." : "Resolve Market"}
        </button>
      </div>

      <button onClick={() => navigate("/home")} style={{ marginTop: "20px" }}>
        Back to Home
      </button>
    </div>
  );
}
