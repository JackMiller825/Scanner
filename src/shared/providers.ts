import { getNetwork } from "./networks.ts";

export type ProviderRole = "scanner" | "surface_reference";
export type ProviderMode = "api" | "link_out";

export type ProviderDefinition = {
  id: string;
  name: string;
  independent: boolean;
  role: ProviderRole;
  mode: ProviderMode;
  credentialEnv: readonly string[];
  docsUrl: string;
  termsUrl?: string;
  attribution: string;
  summary: string;
  limitations: string;
  link: (address: string, chainId: number) => string;
};

function networkOf(chainId: number) {
  return getNetwork(chainId);
}

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "goplus",
    name: "GoPlus Token Security",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["GOPLUS_APP_KEY", "GOPLUS_APP_SECRET"],
    docsUrl: "https://docs.gopluslabs.io/reference/tokensecurityusingget_1",
    termsUrl: "https://gopluslabs.io/",
    attribution: "Token security data from the GoPlus Security API.",
    summary: "Official token security API. A key is optional at the published free rate limit.",
    limitations: "Authorization is optional in the token-security operation. The published free limit is 30 calls per minute. An app key and secret are used only when both are set.",
    link: (address, chainId) => `https://gopluslabs.io/token-security/${chainId}/${address}`,
  },
  {
    id: "quickintel",
    name: "Quick Intel",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["QUICKINTEL_API_KEY"],
    docsUrl: "https://docs.quickintel.io/developer-integration/api-integration/api-endpoints/getquickiauditfull",
    termsUrl: "https://developer.quickintel.io/products",
    attribution: "Audit data from the Quick Intel Security API.",
    summary: "Official full-audit API. A subscribed API key is required.",
    limitations: "Every request needs the X-QKNTL-KEY header. The chain id for Ethereum is eth.",
    link: (address, chainId) => {
      const chain = networkOf(chainId)?.quickintel ?? "eth";
      return `https://app.quickintel.io/scanner?type=token&chain=${chain}&contractAddress=${address}`;
    },
  },
  {
    id: "honeypot",
    name: "Honeypot.is",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["HONEYPOT_API_KEY"],
    docsUrl: "https://docs.honeypot.is/ishoneypot",
    termsUrl: "https://docs.honeypot.is/",
    attribution: "Honeypot simulation data from the Honeypot.is API.",
    summary: "Official IsHoneypot API. Documentation currently says an API key is not required.",
    limitations: "Docs say the key system is not active yet and ask callers to read the terms. An optional key is sent only when HONEYPOT_API_KEY is set.",
    link: (address, chainId) => {
      const path = networkOf(chainId)?.honeypotPath ?? "ethereum";
      return `https://honeypot.is/${path}?address=${address}`;
    },
  },
  {
    id: "blockaid",
    name: "Blockaid",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["BLOCKAID_API_KEY"],
    docsUrl: "https://docs.blockaid.io/docs/introduction",
    termsUrl: "https://www.blockaid.io/legal/terms-of-use",
    attribution: "Token scan data from the Blockaid Token API.",
    summary: "Official token scan API. An API key is required.",
    limitations: "POST /v0/token/scan expects X-API-Key. Uniswap's in-app warning uses Blockaid and is not counted again.",
    link: () => "https://docs.blockaid.io/docs/introduction",
  },
  {
    id: "tokensniffer",
    name: "Token Sniffer",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["TOKENSNIFFER_API_KEY"],
    docsUrl: "https://tokensniffer.readme.io/reference/get-token-results",
    termsUrl: "https://tokensniffer.readme.io/reference/pricing",
    attribution: "Smell Test data from the Token Sniffer API.",
    summary: "Official Get Token API. A paid API key is required, and requests must stay on the server.",
    limitations: "The current Get Token page authenticates with X-API-Key. Metrics and tests are requested when the plan allows them.",
    link: (address, chainId) => {
      const slug = networkOf(chainId)?.tokensniffer ?? "eth";
      return `https://tokensniffer.com/token/${slug}/${address}`;
    },
  },
  {
    id: "defi",
    name: "De.Fi Scanner",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["DEFI_API_KEY"],
    docsUrl: "https://docs.de.fi/api/api",
    termsUrl: "https://docs.de.fi/security-toolkit/scanner",
    attribution: "Scanner data from the De.Fi GraphQL API.",
    summary: "Official scannerProject query. An API key from De.Fi is required.",
    limitations: "Keys are requested from info@de.fi. scannerProject costs 25 credits. De.Fi's own chain ids differ from EVM chain ids, and the public docs do not publish a single argument name.",
    link: (address) => `https://de.fi/scanner/contract/${address}`,
  },
  {
    id: "dexanalyzer",
    name: "DexAnalyzer / SafeAnalyzer",
    independent: true,
    role: "scanner",
    mode: "link_out",
    credentialEnv: [],
    docsUrl: "https://www.dexanalyzer.io/docs/safeanalyzerbot",
    termsUrl: "https://www.dexanalyzer.io/api",
    attribution: "DexAnalyzer and SafeAnalyzer are opened manually. This console does not call them.",
    summary: "Not available via official API. The marketing page does not publish a usable endpoint contract.",
    limitations: "SafeAnalyzer is a Telegram bot at @SafeAnalyzerbot. Paste a report here if you run it yourself. A pasted result is user-submitted.",
    link: () => "https://www.dexanalyzer.io/analyzer/",
  },
  {
    id: "ethsafesniper",
    name: "ETHSafeSniper",
    independent: true,
    role: "scanner",
    mode: "link_out",
    credentialEnv: [],
    docsUrl: "https://t.me/ethsafesniper",
    attribution: "ETHSafeSniper is a Telegram channel. This console does not read it.",
    summary: "Not available via official API. Manual / link-out only.",
    limitations: "Public channel: https://t.me/ethsafesniper. No documented analysis API was found. This card never repeats another scanner's result.",
    link: () => "https://t.me/ethsafesniper",
  },
  {
    id: "banana",
    name: "Banana ETH Deployer",
    independent: true,
    role: "scanner",
    mode: "link_out",
    credentialEnv: [],
    docsUrl: "https://t.me/bananadeployer",
    attribution: "BANANA ETH Deployer is a Telegram channel. This console does not read it.",
    summary: "Not available via official API. Manual / link-out only.",
    limitations: "Public channel: https://t.me/bananadeployer. No documented analysis API was found.",
    link: () => "https://t.me/bananadeployer",
  },
  {
    id: "dextools",
    name: "DEXTools",
    independent: true,
    role: "scanner",
    mode: "api",
    credentialEnv: ["DEXTOOLS_API_KEY", "DEXTOOLS_PLAN"],
    docsUrl: "https://developer.dextools.io/",
    termsUrl: "https://info.dextools.io/unleashing-the-power-of-data-dextools-api-v-2/",
    attribution: "Token score and audit data from the DEXTools API.",
    summary: "Official API v2. A plan and API key are required.",
    limitations: "The developer portal did not load during research on 15 October 2026. The connector uses the published v2 host, X-API-KEY header, and token score/audit paths. A DEXTScore is not treated as a safety verdict.",
    link: (address, chainId) => {
      const chain = networkOf(chainId)?.dextools ?? "ether";
      return `https://www.dextools.io/app/en/${chain}/token/${address}`;
    },
  },
  {
    id: "uniswap",
    name: "Uniswap warning reference",
    independent: false,
    role: "surface_reference",
    mode: "link_out",
    credentialEnv: [],
    docsUrl: "https://support.uniswap.org/hc/en-us/articles/40074236290445-What-are-token-warnings",
    termsUrl: "https://blog.uniswap.org/new-token-warnings",
    attribution: "Uniswap states that its token warnings are powered by Blockaid.",
    summary: "Surface reference only. Uniswap is not an independent scanner.",
    limitations: "No separate Uniswap token-security API was found. This card is excluded from independent counts and is never filled with the Blockaid API result.",
    link: (address, chainId) => {
      const chain = networkOf(chainId)?.uniswap ?? "ethereum";
      return `https://app.uniswap.org/explore/tokens/${chain}/${address}`;
    },
  },
];

export function providerById(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
