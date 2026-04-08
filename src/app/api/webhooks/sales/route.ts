import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

/**
 * Webhook universal para receber vendas de plataformas de pagamento.
 * Suporta: Cartpanda, Hotmart, PerfectPay, Monetizze, NexFy, Yampi, etc.
 *
 * Configure nas plataformas de pagamento:
 * URL: https://banco-de-dados-ngv.vercel.app/api/webhooks/sales
 *
 * O webhook aceita qualquer formato de payload e extrai o que conseguir.
 */
export async function POST(request: Request) {
  // Auth: accept secret via header, query param, or token in body
  // PerfectPay and others send token in the payload, not headers
  const url = new URL(request.url);
  const headerSecret = request.headers.get("x-webhook-secret");
  const queryToken = url.searchParams.get("token");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyToken = typeof body.token === "string" ? body.token : null;
  const expectedSecret = process.env.SALES_WEBHOOK_SECRET;

  const isAuthorized =
    (headerSecret && headerSecret === expectedSecret) ||
    (queryToken && queryToken === expectedSecret) ||
    (bodyToken && bodyToken === expectedSecret);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

    // Try to extract common fields from different platform formats
    const sale = {
      // Common fields across platforms
      status: extractField(body, ["status", "transaction_status", "payment_status", "order_status"]),
      productName: extractField(body, ["product_name", "product.name", "items.0.name", "productName", "offer_name"]),
      productId: extractField(body, ["product_id", "product.id", "productId"]),
      price: extractNumber(body, ["price", "amount", "value", "total", "transaction.amount", "order_value", "purchase.price"]),
      currency: extractField(body, ["currency", "transaction.currency"]) || "USD",
      customerEmail: extractField(body, ["email", "customer.email", "buyer.email", "customer_email"]),
      customerCountry: extractField(body, ["country", "customer.country", "buyer.country"]),
      paymentMethod: extractField(body, ["payment_method", "payment_type", "paymentMethod"]),
      platform: detectPlatform(body),
      utmSource: extractField(body, ["utm_source", "utms.utm_source", "tracking.utm_source"]),
      utmCampaign: extractField(body, ["utm_campaign", "utms.utm_campaign", "tracking.utm_campaign"]),
      utmContent: extractField(body, ["utm_content", "utms.utm_content", "tracking.utm_content"]),
      transactionId: extractField(body, ["transaction_id", "transaction.id", "order_id", "id"]),
    };

    // Save to metrics_snapshots
    await db.insert(metricsSnapshots).values({
      date: new Date(),
      entityType: "sale",
      entityId: 0,
      source: "manual",
      revenue: sale.price ? String(sale.price / 100) : null,
      extraData: {
        ...sale,
        receivedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sale received",
      product: sale.productName,
      status: sale.status,
    });
  } catch (err) {
    console.error("[Sales Webhook] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process sale" },
      { status: 500 }
    );
  }
}

// Helper to extract nested fields
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
  // Try to detect which platform sent the webhook
  if (body.hottok || body.hotmart_id) return "Hotmart";
  if (body.cartpanda_id || body.store_id) return "Cartpanda";
  if (body.perfectpay_id) return "PerfectPay";
  if (body.monetizze_id) return "Monetizze";
  if (body.nexfy_id) return "NexFy";
  if (body.yampi_id) return "Yampi";
  return "Unknown";
}
