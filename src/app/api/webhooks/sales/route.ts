import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

/**
 * Webhook de vendas — PerfectPay + outras plataformas.
 * URL: https://banco-de-dados-ngv.vercel.app/api/webhooks/sales?token=TOKEN
 */

// PerfectPay sale_status_enum mapping
const PP_STATUS: Record<number, string> = {
  0: "none", 1: "pending", 2: "approved", 3: "in_process",
  4: "in_mediation", 5: "rejected", 6: "cancelled", 7: "refunded",
  8: "authorized", 9: "charged_back", 10: "completed",
  11: "checkout_error", 12: "precheckout", 13: "expired", 16: "in_review",
};

const PP_PAYMENT: Record<number, string> = {
  0: "none", 1: "visa", 2: "boleto", 3: "amex", 4: "elo",
  5: "hipercard", 6: "master", 7: "melicard", 8: "free_price",
};

const PP_PAYMENT_TYPE: Record<number, string> = {
  0: "none", 1: "credit_card", 2: "boleto", 3: "paypal",
  4: "recurrent", 5: "free_price", 6: "upsell",
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Auth: token via query param, header, or body
  const headerSecret = request.headers.get("x-webhook-secret");
  const bodyToken = typeof body.token === "string" ? body.token : null;
  const expectedSecret = process.env.SALES_WEBHOOK_SECRET;

  const isAuthorized =
    (queryToken && queryToken === expectedSecret) ||
    (headerSecret && headerSecret === expectedSecret) ||
    (bodyToken && bodyToken === expectedSecret) ||
    !expectedSecret; // If no secret configured, accept all (dev mode)

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Detect platform
    const isPerfectPay = body.sale_status_enum !== undefined || body.sale_amount !== undefined || (typeof body.code === "string" && String(body.code).startsWith("PPC"));

    let sale;

    if (isPerfectPay) {
      sale = parsePerfectPay(body);
    } else {
      sale = parseGeneric(body);
    }

    // Save to metrics_snapshots
    await db.insert(metricsSnapshots).values({
      date: new Date(),
      entityType: "sale",
      entityId: 0,
      source: "manual",
      revenue: sale.price ? String(sale.price) : null,
      extraData: {
        ...sale,
        rawPayload: body,
        receivedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sale received",
      product: sale.productName,
      status: sale.status,
      amount: sale.price,
    });
  } catch (err) {
    console.error("[Sales Webhook] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process sale" },
      { status: 500 }
    );
  }
}

function parsePerfectPay(body: Record<string, unknown>) {
  const product = body.product as Record<string, unknown> | undefined;
  const customer = body.customer as Record<string, unknown> | undefined;
  const metadata = body.metadata as Record<string, unknown> | undefined;

  const statusEnum = typeof body.sale_status_enum === "number" ? body.sale_status_enum : parseInt(String(body.sale_status_enum || "0"));
  const paymentEnum = typeof body.payment_method_enum === "number" ? body.payment_method_enum : parseInt(String(body.payment_method_enum || "0"));
  const paymentTypeEnum = typeof body.payment_type_enum === "number" ? body.payment_type_enum : parseInt(String(body.payment_type_enum || "0"));

  return {
    platform: "PerfectPay",
    transactionCode: String(body.code || ""),
    status: PP_STATUS[statusEnum] || String(statusEnum),
    statusDetail: String(body.sale_status_detail || ""),
    price: parseFloat(String(body.sale_amount || "0")),
    currency: body.currency_enum === 1 ? "BRL" : "USD",
    installments: Number(body.installments || 0),
    installmentAmount: parseFloat(String(body.installment_amount || "0")),
    paymentMethod: PP_PAYMENT[paymentEnum] || String(paymentEnum),
    paymentType: PP_PAYMENT_TYPE[paymentTypeEnum] || String(paymentTypeEnum),
    productName: product?.name ? String(product.name) : null,
    productCode: product?.code ? String(product.code) : null,
    customerName: customer?.full_name ? String(customer.full_name) : null,
    customerEmail: customer?.email ? String(customer.email) : null,
    customerCountry: customer?.country ? String(customer.country) : null,
    customerPhone: customer?.phone_number ? `${customer.phone_area_code || ""}${customer.phone_number}` : null,
    utmSource: metadata?.utm_source ? String(metadata.utm_source) : null,
    utmMedium: metadata?.utm_medium ? String(metadata.utm_medium) : null,
    utmCampaign: metadata?.utm_campaign ? String(metadata.utm_campaign) : null,
    utmTerm: metadata?.utm_term ? String(metadata.utm_term) : null,
    utmContent: metadata?.utm_content ? String(metadata.utm_content) : null,
    dateCreated: body.date_created ? String(body.date_created) : null,
    dateApproved: body.date_approved ? String(body.date_approved) : null,
    quantity: Number(body.quantity || 1),
  };
}

function parseGeneric(body: Record<string, unknown>) {
  return {
    platform: detectPlatform(body),
    status: extractField(body, ["status", "transaction_status", "payment_status", "order_status"]),
    productName: extractField(body, ["product_name", "product.name", "items.0.name", "productName"]),
    productId: extractField(body, ["product_id", "product.id", "productId"]),
    price: extractNumber(body, ["price", "amount", "value", "total", "sale_amount"]),
    currency: extractField(body, ["currency", "transaction.currency"]) || "USD",
    customerEmail: extractField(body, ["email", "customer.email", "buyer.email"]),
    customerCountry: extractField(body, ["country", "customer.country"]),
    paymentMethod: extractField(body, ["payment_method", "payment_type"]),
    utmSource: extractField(body, ["utm_source", "metadata.utm_source"]),
    utmCampaign: extractField(body, ["utm_campaign", "metadata.utm_campaign"]),
    transactionId: extractField(body, ["transaction_id", "code", "order_id", "id"]),
  };
}

function extractField(obj: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") break;
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== null && current !== undefined && current !== "") {
      return String(current);
    }
  }
  return null;
}

function extractNumber(obj: Record<string, unknown>, paths: string[]): number | null {
  const val = extractField(obj, paths);
  if (val === null) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function detectPlatform(body: Record<string, unknown>): string {
  if (body.hottok || body.hotmart_id) return "Hotmart";
  if (body.cartpanda_id || body.store_id) return "Cartpanda";
  if (body.sale_status_enum !== undefined) return "PerfectPay";
  if (body.monetizze_id) return "Monetizze";
  return "Unknown";
}
