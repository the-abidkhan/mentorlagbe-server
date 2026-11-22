import "dotenv/config";
import express from "express";
import Stripe from "stripe";
import { getCollections } from "../config/db.js";
import {
  AuthRequest,
  verifyToken,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create Stripe Checkout Session
router.post(
  "/create-checkout-session",
  verifyToken,
  async (req: AuthRequest, res) => {
    try {
      const { planName } = req.body;

      if (planName !== "pro") {
        return res.status(400).json({
          message: "Invalid plan.",
        });
      }

      const { users } = await getCollections();

      const user = await users.findOne({
        email: req.user!.email,
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      if (user.plan === "pro") {
        return res.status(400).json({
          message: "You already have a Pro plan.",
        });
      }

      const amount = user.role === "tutor" ? 1500 : 1000;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "MentorLagbe Pro Plan",
                description: `${user.role} Pro membership`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],

        metadata: {
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          planName: "pro",
        },

        success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
      });

      res.status(200).json({
        checkoutUrl: session.url,
      });
    } catch (error) {
      console.error("Checkout session error:", error);

      res.status(500).json({
        message: "Failed to create checkout session.",
      });
    }
  }
);

// Verify Stripe Checkout Session
router.get(
  "/verify-session",
  verifyToken,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = req.query.session_id;

      if (typeof sessionId !== "string" || !sessionId) {
        return res.status(400).json({
          message: "Session ID is required.",
        });
      }

      // Get Checkout Session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Check session owner
      if (session.metadata?.userEmail !== req.user!.email) {
        return res.status(403).json({
          message: "You are not allowed to access this payment.",
        });
      }

      // Check payment status
      if (
        session.payment_status !== "paid" ||
        session.metadata?.planName !== "pro"
      ) {
        return res.status(200).json({
          success: false,
          message: "Payment is not completed yet.",
          planActivated: false,
        });
      }

      const { users, payments } = await getCollections();

      // Check whether webhook processed the payment
      const existingPayment = await payments.findOne({
        stripeSessionId: session.id,
      });

      const user = await users.findOne({
        email: req.user!.email,
      });

      res.status(200).json({
        success: true,
        message: "Payment completed successfully.",
        paymentProcessed: !!existingPayment,
        planActivated: user?.plan === "pro",
        plan: user?.plan || "free",
      });
    } catch (error) {
      console.error("Payment verification error:", error);

      res.status(500).json({
        message: "Failed to verify payment.",
      });
    }
  }
);

// Stripe Webhook
router.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (typeof signature !== "string" || !webhookSecret) {
    return res.status(400).json({
      message: "Webhook signature or secret missing.",
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);

    return res.status(400).json({
      message: "Invalid webhook signature.",
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        return res.status(200).json({
          message: "Payment is not completed yet.",
        });
      }

      const userEmail = session.metadata?.userEmail;
      const userName = session.metadata?.userName;
      const userRole = session.metadata?.userRole;
      const planName = session.metadata?.planName;

      if (
        !userEmail ||
        !userName ||
        !["student", "tutor"].includes(userRole || "") ||
        planName !== "pro"
      ) {
        return res.status(400).json({
          message: "Invalid payment metadata.",
        });
      }

      const { users, payments } = await getCollections();

      // Check duplicate payment
      const existingPayment = await payments.findOne({
        stripeSessionId: session.id,
      });

      if (existingPayment) {
        return res.status(200).json({
          message: "Payment already processed.",
        });
      }

      // Update user plan
      await users.updateOne(
        { email: userEmail, role: userRole },
        { $set: { plan: "pro" } }
      );

      // Save payment information
      await payments.insertOne({
        userEmail,
        userName,
        userRole,
        planName: "pro",
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        transactionId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || "",
        stripeSessionId: session.id,
        paymentStatus: "paid",
        paidAt: new Date(),
      });

      console.log("Payment completed:", userEmail);
    }

    res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);

    res.status(500).json({
      message: "Webhook processing failed.",
    });
  }
});

export default router;
