# Scanner integrations

Research date: 15 October 2026.

This console calls only documented provider APIs, and only from the server. A provider without a usable public contract is **Not available via official API** and is shown as **Manual / link-out only**. User-pasted text is labeled **User-submitted**. Uniswap is a surface reference, not a second copy of Blockaid.

Secrets belong in `.env`. `.env.example` lists names only.

## GoPlus Token Security

- Method: Official API
- Documentation: https://docs.gopluslabs.io/reference/tokensecurityusingget_1
- Access token: https://docs.gopluslabs.io/reference/getaccesstokenusingpost
- Endpoint: `GET https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={address}`
- Credentials: `GOPLUS_APP_KEY` and `GOPLUS_APP_SECRET` are optional. The OpenAPI operation does not require `Authorization`, and the official SDK samples call with no access token. When both values are set, the server requests a bearer token with the documented SHA-1 signature.
- Status: Connected without a key. A 401 response becomes **Not configured**.
- Limits: The support page says the free limit is 30 calls per minute. One call is made per scan. Closed-source responses omit other fields; missing fields stay unknown.

## Quick Intel

- Method: Official API
- Documentation: https://docs.quickintel.io/developer-integration/api-integration/api-endpoints/getquickiauditfull
- Authentication: https://docs.quickintel.io/developer-integration/api-integration/api-authentication
- Endpoint: `POST https://api.quickintel.io/v1/getquickiauditfull` with `X-QKNTL-KEY`
- Credentials: `QUICKINTEL_API_KEY` (subscription required)
- Status: **Not configured** until the key is set
- Limits: Ethereum's chain id in this API is `eth`. The full audit includes honeypot and tax data and can be slower than the audit-only call.

## Honeypot.is

- Method: Official API
- Documentation: https://docs.honeypot.is/ishoneypot
- Terms note: https://docs.honeypot.is/ says to read the terms before use. The same docs say API authentication is not currently required.
- Endpoint: `GET https://api.honeypot.is/v2/IsHoneypot?address={address}&chainID={chainId}`
- Credentials: `HONEYPOT_API_KEY` is optional. It is sent as `X-API-KEY` only when set.
- Status: Connected without a key
- Limits: `summary.risk = unknown` is shown as **Unavailable**. A low or very-low risk is the provider's own "no suspicious result" wording, not a safety certificate. `holderAnalysis.holders` is a sample size, not the holder count.

## Blockaid

- Method: Official API
- Documentation: https://docs.blockaid.io/docs/introduction
- Token scan: `POST https://api.blockaid.io/v0/token/scan` with header `X-API-Key` and JSON `{ "address", "chain" }`
- Terms: https://www.blockaid.io/legal/terms-of-use
- Credentials: `BLOCKAID_API_KEY`
- Status: **Not configured** until the key is set
- Limits: `result_type` is Blockaid's verdict. This result is not copied onto the Uniswap card.

## Token Sniffer

- Method: Official API
- Documentation: https://tokensniffer.readme.io/reference/get-token-results
- Key docs: https://tokensniffer.readme.io/reference/api-key
- Pricing: https://tokensniffer.readme.io/reference/pricing
- Endpoint: `GET https://tokensniffer.com/api/v2/tokens/{chain_id}/{address}`
- Credentials: `TOKENSNIFFER_API_KEY`
- Status: **Not configured** until the key is set
- Limits: Token Sniffer says the key must stay server-side. The current Get Token page uses `X-API-Key`. If that is rejected, the server retries once with the documented `apikey` query and does not return the URL. A pending status is **Unavailable**. The score is not a safety certificate.

## De.Fi Scanner

- Method: Official GraphQL API
- Documentation: https://docs.de.fi/api/api
- Scanner description: https://docs.de.fi/security-toolkit/scanner
- Endpoint: `POST https://public-api.de.fi/graphql` with header `X-Api-Key`
- Credentials: `DEFI_API_KEY`, requested from `info@de.fi`
- Status: **Not configured** until the key is set
- Limits: `scannerProject` is documented at 25 credits and 20 calls per minute. The public page does not settle one argument name, so the connector tries `smartContractAddresses`, `contractAddresses`, and `contractAddress`. De.Fi's own chain ids are not EVM chain ids. A security score without an issue list stays **Unavailable**.

## DexAnalyzer / SafeAnalyzer

- Method: **Not available via official API**
- Documentation: https://www.dexanalyzer.io/docs/safeanalyzerbot
- API marketing page: https://www.dexanalyzer.io/api
- Status: **Manual / link-out only**
- Limits: The API page advertises a paid analyzer API and an attribution requirement, but it does not publish an endpoint, authentication scheme, or request schema. SafeAnalyzer's documented interface is the Telegram bot `@SafeAnalyzerbot` (`/safe 0x...`). This console does not call the bot or scrape the site. Open https://www.dexanalyzer.io/analyzer/ and paste the result if you want it recorded.

## ETHSafeSniper

- Method: **Not available via official API**
- Channel: https://t.me/ethsafesniper
- Status: **Manual / link-out only**
- Limits: ETHSafeSniper is a Telegram channel associated with DexAnalyzer. No documented analysis API was found. The Telegram Bot API does not provide this channel's posts to an unrelated app. This card is never filled with another scanner's findings.

## Banana ETH Deployer

- Method: **Not available via official API**
- Channel: https://t.me/bananadeployer
- Status: **Manual / link-out only**
- Limits: BANANA ETH Deployer is a Telegram channel. No documented analysis API was found. Paste a post only after you have read it yourself. The saved row is **User-submitted**.

## DEXTools

- Method: Official API v2, key required
- Portal: https://developer.dextools.io/
- Announcement: https://info.dextools.io/unleashing-the-power-of-data-dextools-api-v-2/
- Credentials: `DEXTOOLS_API_KEY`. `DEXTOOLS_PLAN` may be `trial`, `standard`, `advanced`, or `pro` (default `trial`).
- Endpoint used: `GET https://public-api.dextools.io/{plan}/v2/token/{chain}/{address}/score` and `/audit` with header `X-API-KEY`. Ethereum's chain slug is `ether`.
- Status: **Not configured** until the key is set
- Limits: The developer portal did not load during this research, so the path follows the published v2 contract rather than a live swagger render. A DEXTScore without recognized audit flags stays **Unavailable** and is not shown as a clear result.

## Uniswap warning reference

- Method: Surface reference. Not an independent scanner.
- Documentation: https://support.uniswap.org/hc/en-us/articles/40074236290445-What-are-token-warnings
- Announcement: https://blog.uniswap.org/new-token-warnings
- Status: **Manual / link-out only**
- Limits: Uniswap says token warnings on Uniswap Web and Wallet are powered by Blockaid, and that Uniswap Labs does not independently verify them. No separate Uniswap token-security API was found. The card links to the Uniswap token page and can store what you see there as a user-submitted surface note. It is excluded from the independent provider counts, and the Blockaid API result is not copied into it.
