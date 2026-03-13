"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install a Web3 wallet (MetaMask, OKX Wallet, etc.)");
      return;
    }

    try {
      const ethereum = (window as any).ethereum;

      // Request accounts
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0]);

      // Get chain ID
      const chainIdHex = await ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chainIdHex, 16));

      // If not on X Layer, prompt to switch
      if (parseInt(chainIdHex, 16) !== 196) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xc4" }],
          });
          setChainId(196);
        } catch (switchError: any) {
          // Chain not added, add it
          if (switchError.code === 4902) {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xc4",
                  chainName: "X Layer",
                  nativeCurrency: {
                    name: "OKB",
                    symbol: "OKB",
                    decimals: 18,
                  },
                  rpcUrls: ["https://rpc.xlayer.tech"],
                  blockExplorerUrls: ["https://www.oklink.com/xlayer"],
                },
              ],
            });
            setChainId(196);
          }
        }
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] || null);
    };

    const handleChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  if (address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const isXLayer = chainId === 196;

    return (
      <div className="flex items-center gap-2">
        {!isXLayer && (
          <span className="text-xs text-yellow-400">Wrong network</span>
        )}
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isXLayer ? "bg-green-400" : "bg-yellow-400"
          }`}
        />
        <span className="text-sm text-gray-300 font-mono">{shortAddr}</span>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-semibold transition-colors"
    >
      Connect Wallet
    </button>
  );
}
