import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any,
    appInfo: {
        name: 'ReFiAI',
        version: '0.1.0',
    },
});
