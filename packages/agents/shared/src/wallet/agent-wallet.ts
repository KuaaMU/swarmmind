import { ethers } from "ethers";
import { XLAYER_CONFIG } from "../config/xlayer.config";

export interface AgentWalletConfig {
  readonly privateKey: string;
  readonly chainId: number;
  readonly rpcUrl?: string;
}

export class AgentWallet {
  readonly wallet: ethers.Wallet;
  readonly provider: ethers.JsonRpcProvider;
  readonly address: string;

  private constructor(wallet: ethers.Wallet, provider: ethers.JsonRpcProvider) {
    this.wallet = wallet;
    this.provider = provider;
    this.address = wallet.address;
  }

  static create(config: AgentWalletConfig): AgentWallet {
    const networkConfig = config.chainId === 196
      ? XLAYER_CONFIG.mainnet
      : XLAYER_CONFIG.testnet;

    const rpcUrl = config.rpcUrl || networkConfig.rpcUrl;
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: config.chainId,
      name: networkConfig.name,
    });

    const wallet = new ethers.Wallet(config.privateKey, provider);
    return new AgentWallet(wallet, provider);
  }

  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.address);
    return ethers.formatEther(balance);
  }

  async getUsdcBalance(usdcAddress: string): Promise<string> {
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new ethers.Contract(usdcAddress, erc20Abi, this.provider);
    const balance = await usdc.balanceOf(this.address);
    return ethers.formatUnits(balance, 6);
  }

  async approveUsdc(
    usdcAddress: string,
    spender: string,
    amount: bigint
  ): Promise<ethers.TransactionReceipt | null> {
    const erc20Abi = ["function approve(address,uint256) returns (bool)"];
    const usdc = new ethers.Contract(usdcAddress, erc20Abi, this.wallet);
    const tx = await usdc.approve(spender, amount);
    return tx.wait();
  }

  async transferUsdc(
    usdcAddress: string,
    to: string,
    amount: bigint
  ): Promise<ethers.TransactionReceipt | null> {
    const erc20Abi = ["function transfer(address,uint256) returns (bool)"];
    const usdc = new ethers.Contract(usdcAddress, erc20Abi, this.wallet);
    const tx = await usdc.transfer(to, amount);
    return tx.wait();
  }

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  getSigner(): ethers.Wallet {
    return this.wallet;
  }
}
