export const XLAYER_CONFIG = {
  mainnet: {
    chainId: 196,
    name: "X Layer",
    rpcUrl: "https://rpc.xlayer.tech",
    explorerUrl: "https://www.oklink.com/xlayer",
    nativeCurrency: {
      name: "OKB",
      symbol: "OKB",
      decimals: 18,
    },
  },
  testnet: {
    chainId: 195,
    name: "X Layer Testnet",
    rpcUrl: "https://testrpc.xlayer.tech",
    explorerUrl: "https://www.oklink.com/xlayer-test",
    nativeCurrency: {
      name: "OKB",
      symbol: "OKB",
      decimals: 18,
    },
  },
} as const;

export const TOKEN_ADDRESSES = {
  // X Layer Mainnet tokens
  196: {
    USDC: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
    WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
    WETH: "0x5A77f1443D16ee5761d310e38b7308aaF2d232EE",
    USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
  },
  // Testnet tokens
  195: {
    USDC: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
    WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
    WETH: "0x5A77f1443D16ee5761d310e38b7308aaF2d232EE",
    USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
  },
} as const;

export const USDC_DECIMALS = 6;

export type ChainId = keyof typeof TOKEN_ADDRESSES;
