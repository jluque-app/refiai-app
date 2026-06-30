import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: Request) {
    const body = await req.json();
    const { priceId, courseId } = body;
    const headersList = await headers();
    const origin = headersList.get("origin") || "http://localhost:3001";

    // Stripe not configured yet → return a "mock" so the purchase flow works
    // end-to-end in demo (the client grants access locally). Once a real
    // STRIPE_SECRET_KEY is set this branch is skipped and a real Checkout Session
    // is created. (Production: also add a Stripe webhook that grants the
    // entitlement in your DB on `checkout.session.completed`.)
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith("sk_test_placeholder")) {
        return NextResponse.json({ mock: true, courseId });
    }

    if (!priceId) {
        return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/course/${courseId}?success=true`,
            cancel_url: `${origin}/pricing?canceled=true`,
            metadata: {
                courseId,
            },
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
