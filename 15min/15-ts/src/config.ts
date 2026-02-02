import * as dotenv from "dotenv";

dotenv.config();

export interface Settings {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  privateKey: string;
  signatureType: number;
  funder: string;
  marketSlug: string;
  marketId: string;
  yesTokenId: string;
  noTokenId: string;
  wsUrl: string;
  useWss: boolean;
  targetPairCost: number;
  balanceSlack: number;
  orderSize: number;
  orderType: string;
  yesBuyThreshold: number;
  noBuyThreshold: number;
  verbose: boolean;
  dryRun: boolean;
  cooldownSeconds: number;
  simBalance: number;
}

function getEnv(key: string, def = ""): string {
  return process.env[key] ?? def;
}

function getEnvNum(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function getEnvBool(key: string, def: boolean): boolean {
  const v = process.env[key]?.toLowerCase();
  if (v === undefined || v === "") return def;
  return v === "true" || v === "1";
}

export function loadSettings(): Settings {
  return {
    apiKey: getEnv("POLYMARKET_API_KEY"),
    apiSecret: getEnv("POLYMARKET_API_SECRET"),
    apiPassphrase: getEnv("POLYMARKET_API_PASSPHRASE"),
    privateKey: getEnv("POLYMARKET_PRIVATE_KEY"),
    signatureType: parseInt(getEnv("POLYMARKET_SIGNATURE_TYPE", "1"), 10) || 1,
    funder: getEnv("POLYMARKET_FUNDER"),
    marketSlug: getEnv("POLYMARKET_MARKET_SLUG"),
    marketId: getEnv("POLYMARKET_MARKET_ID"),
    yesTokenId: getEnv("POLYMARKET_YES_TOKEN_ID"),
    noTokenId: getEnv("POLYMARKET_NO_TOKEN_ID"),
    wsUrl: getEnv("POLYMARKET_WS_URL", "wss://ws-subscriptions-clob.polymarket.com"),
    useWss: getEnvBool("USE_WSS", false),
    targetPairCost: getEnvNum("TARGET_PAIR_COST", 0.99),
    balanceSlack: getEnvNum("BALANCE_SLACK", 0.15),
    orderSize: getEnvNum("ORDER_SIZE", 50),
    orderType: (getEnv("ORDER_TYPE", "FOK") || "FOK").toUpperCase(),
    yesBuyThreshold: getEnvNum("YES_BUY_THRESHOLD", 0.45),
    noBuyThreshold: getEnvNum("NO_BUY_THRESHOLD", 0.45),
    verbose: getEnvBool("VERBOSE", false),
    dryRun: getEnvBool("DRY_RUN", false),
    cooldownSeconds: getEnvNum("COOLDOWN_SECONDS", 10),
    simBalance: getEnvNum("SIM_BALANCE", 0),
  };
}
