import React, { createContext, useState, useEffect, useContext } from "react";
import { ethers } from "ethers";

// Create context
const WalletContext = createContext();

// Provider component
export const WalletProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize wallet on mount and when ethereum changes
  useEffect(() => {
    const initWallet = async () => {
      try {
        const isWalletConnected =
          window.localStorage.getItem("walletConnected");

        if (window.ethereum && isWalletConnected === "true") {
          const provider = new ethers.providers.Web3Provider(window.ethereum);

          // Request accounts to ensure connection persists
          const accounts = await provider.send("eth_accounts", []);

          if (accounts.length > 0) {
            const network = await provider.getNetwork();

            setProvider(provider);
            setAccount(accounts[0]);
            setChainId(network.chainId);
          } else {
            // No accounts found even though localStorage says connected
            window.localStorage.removeItem("walletConnected");
          }
        }
      } catch (err) {
        console.error("Failed to initialize wallet:", err);
        window.localStorage.removeItem("walletConnected");
      } finally {
        setInitialized(true);
      }
    };

    initWallet();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      console.log("Accounts changed", accounts);
      if (accounts.length === 0) {
        // User disconnected wallet
        setAccount(null);
        window.localStorage.removeItem("walletConnected");
      } else if (accounts[0] !== account) {
        // Account changed
        setAccount(accounts[0]);
        window.localStorage.setItem("walletConnected", "true");
      }
    };

    const handleChainChanged = (chainIdHex) => {
      console.log("Chain changed", chainIdHex);
      // Convert from hex to decimal
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [account]);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error(
          "No Ethereum wallet detected. Please install MetaMask or another compatible wallet."
        );
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      if (accounts.length > 0) {
        setProvider(provider);
        setAccount(accounts[0]);
        setChainId(network.chainId);

        // Set persistence
        window.localStorage.setItem("walletConnected", "true");
      } else {
        throw new Error("No accounts found after connection request");
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setAccount(null);
    setChainId(null);
    window.localStorage.removeItem("walletConnected");
  };

  return (
    <WalletContext.Provider
      value={{
        provider,
        account,
        chainId,
        isConnecting,
        error,
        initialized,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use the wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
