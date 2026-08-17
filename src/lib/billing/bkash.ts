// bKash Tokenized Checkout (PGW) client.
//
// NOT YET VERIFIED against a real merchant sandbox — field names below are
// the ones corroborated across public integration guides, but bKash has
// multiple API generations (older "Checkout URL" vs newer "Tokenized
// Checkout") with different base hosts, and this project has no sandbox
// credentials to test against yet. Before going live, confirm against the
// actual docs bKash gave you with the merchant account:
//   - BKASH_BASE_URL below (sandbox vs production host)
//   - the exact `mode`/`payerReference` fields on createPayment, if your
//     account's API version requires them
//   - whether your account uses Execute Payment or Query Payment as the
//     server-side confirmation step after the callback redirect
import "server-only";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout
//      https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout (production)
function baseUrl(): string {
  return requireEnv("BKASH_BASE_URL");
}

let cachedToken: { idToken: string; expiresAt: number } | null = null;

async function grantToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.idToken;
  }

  const res = await fetch(`${baseUrl()}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: requireEnv("BKASH_USERNAME"),
      password: requireEnv("BKASH_PASSWORD"),
    },
    body: JSON.stringify({
      app_key: requireEnv("BKASH_APP_KEY"),
      app_secret: requireEnv("BKASH_APP_SECRET"),
    }),
  });

  if (!res.ok) throw new Error(`bKash grant token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.id_token) throw new Error(`bKash grant token response missing id_token: ${JSON.stringify(data)}`);

  // expires_in is in seconds per bKash docs; fall back to a conservative 50min if absent.
  const ttlMs = (data.expires_in ?? 3000) * 1000;
  cachedToken = { idToken: data.id_token, expiresAt: Date.now() + ttlMs };
  return data.id_token;
}

async function authedHeaders(): Promise<HeadersInit> {
  return {
    "Content-Type": "application/json",
    Authorization: await grantToken(),
    "X-APP-Key": requireEnv("BKASH_APP_KEY"),
  };
}

export type CreateBkashPaymentResult = {
  paymentID: string;
  bkashURL: string;
};

export async function createBkashPayment(params: {
  amountBdt: string; // decimal string, e.g. "60.00" — bKash expects a string, not a number
  merchantInvoiceNumber: string; // our Payment.id
  callbackURL: string;
}): Promise<CreateBkashPaymentResult> {
  const res = await fetch(`${baseUrl()}/create`, {
    method: "POST",
    headers: await authedHeaders(),
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.merchantInvoiceNumber,
      callbackURL: params.callbackURL,
      amount: params.amountBdt,
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.merchantInvoiceNumber,
    }),
  });

  if (!res.ok) throw new Error(`bKash create payment failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.paymentID || !data.bkashURL) {
    throw new Error(`bKash create payment response missing paymentID/bkashURL: ${JSON.stringify(data)}`);
  }
  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
}

export type BkashExecuteResult = {
  paymentID: string;
  trxID: string | null;
  transactionStatus: string; // "Completed" on success
  amount: string;
};

// Server-side confirmation step. Callers MUST treat this — not the redirect
// query params — as the source of truth for whether payment actually
// succeeded, since redirect params are attacker-controllable.
export async function executeBkashPayment(paymentID: string): Promise<BkashExecuteResult> {
  const res = await fetch(`${baseUrl()}/execute/${paymentID}`, {
    method: "POST",
    headers: await authedHeaders(),
  });

  if (!res.ok) throw new Error(`bKash execute payment failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    paymentID: data.paymentID,
    trxID: data.trxID ?? null,
    transactionStatus: data.transactionStatus,
    amount: data.amount,
  };
}

export async function queryBkashPayment(paymentID: string): Promise<BkashExecuteResult> {
  const res = await fetch(`${baseUrl()}/payment/status/${paymentID}`, {
    method: "GET",
    headers: await authedHeaders(),
  });

  if (!res.ok) throw new Error(`bKash query payment failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    paymentID: data.paymentID,
    trxID: data.trxID ?? null,
    transactionStatus: data.transactionStatus,
    amount: data.amount,
  };
}
