import { ethers } from "ethers";
import { AgentWallet } from "../wallet/agent-wallet";

const PAYMENT_SETTLEMENT_ABI = [
  "function settlePayment(address to, uint256 amount, string serviceType) returns (bytes32)",
  "function batchSettle(address[] recipients, uint256[] amounts, string[] serviceTypes)",
  "event PaymentSettled(bytes32 indexed paymentId, address indexed from, address indexed to, uint256 amount, string serviceType)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export interface DirectPaymentConfig {
  readonly wallet: AgentWallet;
  readonly settlementAddress: string;
  readonly usdcAddress: string;
}

/**
 * Direct on-chain USDC payment via PaymentSettlement contract.
 * Fallback when x402 facilitator is unavailable.
 */
export class DirectPayment {
  private readonly wallet: AgentWallet;
  private readonly settlement: ethers.Contract;
  private readonly usdc: ethers.Contract;
  private readonly usdcAddress: string;
  private readonly settlementAddress: string;

  constructor(config: DirectPaymentConfig) {
    this.wallet = config.wallet;
    this.usdcAddress = config.usdcAddress;
    this.settlementAddress = config.settlementAddress;

    this.settlement = new ethers.Contract(
      config.settlementAddress,
      PAYMENT_SETTLEMENT_ABI,
      this.wallet.getSigner()
    );

    this.usdc = new ethers.Contract(
      config.usdcAddress,
      ERC20_ABI,
      this.wallet.getSigner()
    );
  }

  /**
   * Ensure the settlement contract has sufficient USDC allowance
   */
  async ensureApproval(amount: bigint): Promise<void> {
    const currentAllowance: bigint = await this.usdc.allowance(
      this.wallet.address,
      this.settlementAddress
    );

    if (currentAllowance < amount) {
      const tx = await this.usdc.approve(
        this.settlementAddress,
        ethers.MaxUint256
      );
      await tx.wait();
      console.log("USDC approval granted to PaymentSettlement");
    }
  }

  /**
   * Settle a single payment to another agent
   * @param to Recipient agent address
   * @param amountUsdc Amount in USDC (e.g., "0.001" for $0.001)
   * @param serviceType Type of service being paid for
   * @returns Transaction receipt with payment ID
   */
  async pay(
    to: string,
    amountUsdc: string,
    serviceType: string
  ): Promise<{ txHash: string; paymentId: string }> {
    const amount = ethers.parseUnits(amountUsdc, 6);

    await this.ensureApproval(amount);

    const tx = await this.settlement.settlePayment(to, amount, serviceType);
    const receipt = await tx.wait();

    // Extract payment ID from event
    const event = receipt.logs.find(
      (log: ethers.Log) => log.topics[0] === ethers.id(
        "PaymentSettled(bytes32,address,address,uint256,string)"
      )
    );

    const paymentId = event ? event.topics[1] : "unknown";

    return { txHash: receipt.hash, paymentId };
  }

  /**
   * Settle multiple payments in a single transaction
   */
  async batchPay(
    payments: ReadonlyArray<{
      readonly to: string;
      readonly amountUsdc: string;
      readonly serviceType: string;
    }>
  ): Promise<string> {
    const totalAmount = payments.reduce(
      (sum, p) => sum + ethers.parseUnits(p.amountUsdc, 6),
      0n
    );

    await this.ensureApproval(totalAmount);

    const recipients = payments.map((p) => p.to);
    const amounts = payments.map((p) => ethers.parseUnits(p.amountUsdc, 6));
    const serviceTypes = payments.map((p) => p.serviceType);

    const tx = await this.settlement.batchSettle(recipients, amounts, serviceTypes);
    const receipt = await tx.wait();

    return receipt.hash;
  }
}
