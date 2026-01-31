import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: Request) {
    const body = await req.json();
    const { priceId, courseId } = body;
    const headersList = await headers();
    const origin = headersList.get("origin") || "http://localhost:3001";

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
