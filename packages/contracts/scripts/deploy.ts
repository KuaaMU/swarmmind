import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AgentRegistry deployed to:", registryAddress);

  // 2. Deploy AgentWalletFactory
  const AgentWalletFactory = await ethers.getContractFactory("AgentWalletFactory");
  const factory = await AgentWalletFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("AgentWalletFactory deployed to:", factoryAddress);

  // 3. Deploy PaymentSettlement
  const usdcAddress = process.env.USDC_ADDRESS || "0x74b7F16337b8972027F6196A17a631aC6dE26d22";
  const PaymentSettlement = await ethers.getContractFactory("PaymentSettlement");
  const settlement = await PaymentSettlement.deploy(usdcAddress, registryAddress);
  await settlement.waitForDeployment();
  const settlementAddress = await settlement.getAddress();
  console.log("PaymentSettlement deployed to:", settlementAddress);

  // 4. Transfer registry ownership to PaymentSettlement so it can record payments
  const tx = await registry.setPaymentSettlement(settlementAddress);
  await tx.wait();
  console.log("Registry ownership transferred to PaymentSettlement");

  console.log("\n--- Deployment Summary ---");
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`WALLET_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PAYMENT_SETTLEMENT_ADDRESS=${settlementAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
