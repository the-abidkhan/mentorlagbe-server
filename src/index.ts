
import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import { toNodeHandler } from "better-auth/node";

import { connectDB } from "./config/db.js";
import { createAuth } from "./config/auth.js";

import tuitionRoutes from "./routes/tuitionRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://mentorlagbe-client-ebon.vercel.app",
  "https://mentorlagbe-client-gdz6fwzdj-theabidkhan.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Server health check
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "MentorLagbe Server is Running!",
  });
});

// Initialize only once per serverless instance
let initialization: Promise<void> | null = null;

async function initializeServer() {
  await connectDB();

  const auth = await createAuth();

  // Better Auth routes
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Stripe webhook raw body middleware
  app.use(
    "/api/payments/webhook",
    express.raw({ type: "application/json" })
  );

  // JSON middleware
  app.use(express.json());

  // API routes
  app.use("/api/tuitions", tuitionRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/payments", paymentRoutes);
}

// Vercel serverless handler
export async function handler(req: Request, res: Response) {
  try {
    if (!initialization) {
      initialization = initializeServer().catch((error) => {
        initialization = null;
        throw error;
      });
    }

    await initialization;

    app(req, res);
  } catch (error) {
    console.error("Server initialization failed:", error);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

export default handler;

// Local development server
if (!process.env.VERCEL) {
  initializeServer()
    .then(() => {
      const PORT = Number(process.env.PORT) || 5000;

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
    });
}
