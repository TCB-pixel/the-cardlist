import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { amount, description, sourceType = "promptpay" } = await request.json();

  const secretKey = process.env.OMISE_SECRET_KEY!;
  const encoded = Buffer.from(`${secretKey}:`).toString("base64");

  try {
    // 1. สร้าง source
    const sourceRes = await fetch("https://api.omise.co/sources", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100, // สตางค์
        currency: "THB",
        type: sourceType,
      }),
    });

    const source = await sourceRes.json();
    if (source.object === "error") {
      return NextResponse.json({ error: source.message }, { status: 400 });
    }

    // 2. สร้าง charge
    const chargeRes = await fetch("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "THB",
        source: source.id,
        description,
        return_uri: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecardlistbkk.com"}/payment/complete`,
      }),
    });

    const charge = await chargeRes.json();
    if (charge.object === "error") {
      return NextResponse.json({ error: charge.message }, { status: 400 });
    }

    return NextResponse.json({
      chargeId: charge.id,
      status: charge.status,
      qrImage: charge.source?.scannable_code?.image?.download_uri ?? null,
      qrCode: charge.source?.scannable_code?.image?.download_uri ?? null,
      amount: charge.amount / 100,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ตรวจสอบสถานะ charge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chargeId = searchParams.get("chargeId");
  if (!chargeId) return NextResponse.json({ error: "No chargeId" }, { status: 400 });

  const secretKey = process.env.OMISE_SECRET_KEY!;
  const encoded = Buffer.from(`${secretKey}:`).toString("base64");

  const res = await fetch(`https://api.omise.co/charges/${chargeId}`, {
    headers: { Authorization: `Basic ${encoded}` },
  });

  const charge = await res.json();
  return NextResponse.json({
    chargeId: charge.id,
    status: charge.status, // pending, successful, failed
    paid: charge.paid,
    amount: charge.amount / 100,
  });
}
