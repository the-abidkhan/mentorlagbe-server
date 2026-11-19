
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

        success_url: `${process.env.CLIENT_URL}/payment-success`,
        cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
      });

      res.status(200).json({
        checkoutUrl: session.url,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to create checkout session.",
      });
    }
  }
);

export default router;