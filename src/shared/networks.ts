export const DEFAULT_ADDRESS = "0x99a76d66e121d6b3ed11bb5a43d6a710278c9164";
export const DEFAULT_CHAIN_ID = 1;
export const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export type Network = {
  chainId: number;
  name: string;
  rpcEnv: string;
  rpcUrls: readonly string[];
  quickintel: string;
  dextools: string;
  blockaid: string;
  uniswap: string;
  honeypotPath: string;
  tokensniffer: string;
};

export const NETWORKS: readonly Network[] = [
  {
    chainId: 1,
    name: "Ethereum",
    rpcEnv: "RPC_URL_1",
    rpcUrls: ["https://ethereum.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"],
    quickintel: "eth",
    dextools: "ether",
    blockaid: "ethereum",
    uniswap: "ethereum",
    honeypotPath: "ethereum",
    tokensniffer: "eth",
  },
  {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcEnv: "RPC_URL_56",
    rpcUrls: ["https://bsc.publicnode.com", "https://bsc-dataseed.binance.org"],
    quickintel: "bsc",
    dextools: "bsc",
    blockaid: "bsc",
    uniswap: "bnb",
    honeypotPath: "bsc",
    tokensniffer: "bsc",
  },
  {
    chainId: 137,
    name: "Polygon",
    rpcEnv: "RPC_URL_137",
    rpcUrls: ["https://polygon-bor.publicnode.com", "https://polygon-rpc.com"],
    quickintel: "polygon",
    dextools: "polygon",
    blockaid: "polygon",
    uniswap: "polygon",
    honeypotPath: "polygon",
    tokensniffer: "poly",
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    rpcEnv: "RPC_URL_42161",
    rpcUrls: ["https://arbitrum-one.publicnode.com", "https://arb1.arbitrum.io/rpc"],
    quickintel: "arbitrum",
    dextools: "arbitrum",
    blockaid: "arbitrum",
    uniswap: "arbitrum",
    honeypotPath: "arbitrum",
    tokensniffer: "arbi",
  },
  {
    chainId: 8453,
    name: "Base",
    rpcEnv: "RPC_URL_8453",
    rpcUrls: ["https://base.publicnode.com", "https://mainnet.base.org"],
    quickintel: "base",
    dextools: "base",
    blockaid: "base",
    uniswap: "base",
    honeypotPath: "base",
    tokensniffer: "base",
  },
  {
    chainId: 10,
    name: "Optimism",
    rpcEnv: "RPC_URL_10",
    rpcUrls: ["https://optimism.publicnode.com", "https://mainnet.optimism.io"],
    quickintel: "optimism",
    dextools: "optimism",
    blockaid: "optimism",
    uniswap: "optimism",
    honeypotPath: "optimism",
    tokensniffer: "opt",
  },
  {
    chainId: 43114,
    name: "Avalanche",
    rpcEnv: "RPC_URL_43114",
    rpcUrls: ["https://avalanche-c-chain.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
    quickintel: "avalanche",
    dextools: "avalanche",
    blockaid: "avalanche",
    uniswap: "avalanche",
    honeypotPath: "avalanche",
    tokensniffer: "avax",
  },
];

export function getNetwork(chainId: number): Network | undefined {
  return NETWORKS.find((network) => network.chainId === chainId);
}

export function isAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value.trim());
}
