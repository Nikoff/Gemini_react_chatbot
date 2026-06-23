const express = require('express');
const { prisma, stripe, STRIPE_PRICES, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app) {
  app.get('/api/subscription', requireAuth, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        include: { subscription: true },
      });

      const sub = user?.subscription;
      res.json({
        tier: sub?.status === 'active' ? (sub.stripePriceId === STRIPE_PRICES.team_monthly ? 'team' : 'pro') : 'free',
        status: sub?.status || 'free',
        currentPeriodEnd: sub?.currentPeriodEnd,
        stripeCustomerId: user?.stripeCustomerId,
      });
    } catch (err) {
      logger.error(`Subscription check failed: ${err.message}`);
      res.json({ tier: 'free', status: 'free' });
    }
  });

  app.post('/api/subscription/checkout', requireAuth, async (req, res) => {
    const { priceId } = req.body;

    if (!Object.values(STRIPE_PRICES).includes(priceId)) {
      return res.status(400).json({ error: 'Invalid price ID.' });
    }

    try {
      let user = await prisma.user.findUnique({ where: { id: req.user.sub } });

      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          metadata: { userId: req.user.sub },
        });
        user = await prisma.user.update({
          where: { id: req.user.sub },
          data: { stripeCustomerId: customer.id },
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: user.stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription?success=true`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription?canceled=true`,
        metadata: { userId: req.user.sub },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (err) {
      logger.error(`Checkout failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create checkout session.' });
    }
  });

  app.post('/api/subscription/portal', requireAuth, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.sub } });

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: 'No billing account found.' });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription`,
      });

      res.json({ url: session.url });
    } catch (err) {
      logger.error(`Portal failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create portal session.' });
    }
  });

  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata.userId;

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: session.subscription,
              stripePriceId: session.metadata.priceId,
              status: 'active',
            },
            create: {
              userId,
              stripeSubscriptionId: session.subscription,
              stripePriceId: session.metadata.priceId,
              status: 'active',
            },
          });
          logger.info(`Subscription activated for user ${userId}`);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
          });
          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'active', currentPeriodEnd: new Date(invoice.period_end * 1000) },
            });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
          });
          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'past_due' },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: sub.id },
          });
          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'canceled', currentPeriodEnd: new Date(sub.current_period_end * 1000) },
            });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (err) {
      logger.error(`Webhook handler failed: ${err.message}`);
      res.status(500).json({ error: 'Webhook handler failed.' });
    }
  });
};
