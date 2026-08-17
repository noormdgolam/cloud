// SSLCommerz Session API client — direct Visa/Mastercard checkout, priced
// in USD (their gateway still accepts BDT-issued local cards fine even when
// the transaction is USD-denominated; bKash already covers the
// BDT-denominated wallet rail separately).
//
// NOT YET VERIFIED against a real merchant sandbox — field names below are
// corroborated against SSLCommerz's own published API v4 docs
// (developer.sslcommerz.com/doc/v4/), but this project has no sandbox
// credentials to test against yet. Before going live, confirm:
//   - SSLCOMMERZ_BASE_URL (sandbox.sslcommerz.com vs securepay.sslcommerz.com)
//   - that the Validation API response's `status` values match
//     ("VALID"/"VALIDATED") and that amount/currency come back as documented
import "server-only";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// e.g. https://sandbox.sslcommerz.com
//      https://securepay.sslcommerz.com (production)
function baseUrl(): string {
  return requireEnv("SSLCOMMERZ_BASE_URL");
}

export type CreateSslcommerzSessionResult = {
  sessionkey: string;
  gatewayPageURL: string;
};

export async function createSslcommerzSession(params: {
  amountUsd: number;
  tranId: string; // our Payment.id
  productName: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customerName: string;
  customerEmail: string;
}): Promise<CreateSslcommerzSessionResult> {
  const body = new URLSearchParams({
    store_id: requireEnv("SSLCOMMERZ_STORE_ID"),
    store_passwd: requireEnv("SSLCOMMERZ_STORE_PASSWORD"),
    total_amount: params.amountUsd.toFixed(2),
    currency: "USD",
    tran_id: params.tranId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    ipn_url: params.ipnUrl,
    product_name: params.productName,
    product_category: "storage-subscription",
    product_profile: "general",
    cus_name: params.customerName,
    cus_email: params.customerEmail,
    // Required fields SSLCommerz has no real use for in a digital-goods
    // checkout — placeholder values are the documented workaround rather
    // than leaving them empty (empty values have been reported to fail
    // validation on some merchant configs).
    cus_add1: "N/A",
    cus_city: "N/A",
    cus_postcode: "N/A",
    cus_country: "Bangladesh",
    cus_phone: "N/A",
    shipping_method: "NO",
  });

  const res = await fetch(`${baseUrl()}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`SSLCommerz create session failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new Error(`SSLCommerz create session rejected: ${JSON.stringify(data)}`);
  }
  return { sessionkey: data.sessionkey, gatewayPageURL: data.GatewayPageURL };
}

export type SslcommerzValidation = {
  valid: boolean;
  tranId: string;
  amount: number;
  currencyType: string;
  bankTranId: string | null;
};

// The only source of truth for "did this payment actually succeed" — never
// the success_url redirect params or the IPN payload alone, both of which
// are attacker-controllable. Mirrors bKash's executeBkashPayment() being
// the real confirmation step rather than its callback's query params.
export async function validateSslcommerzPayment(valId: string): Promise<SslcommerzValidation> {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: requireEnv("SSLCOMMERZ_STORE_ID"),
    store_passwd: requireEnv("SSLCOMMERZ_STORE_PASSWORD"),
    format: "json",
  });

  const res = await fetch(`${baseUrl()}/validator/api/validationserverAPI.php?${params}`);
  if (!res.ok) throw new Error(`SSLCommerz validation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  return {
    valid: data.status === "VALID" || data.status === "VALIDATED",
    tranId: data.tran_id,
    amount: Number(data.amount),
    currencyType: data.currency_type,
    bankTranId: data.bank_tran_id ?? null,
  };
}
