
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { createAuth } from "./config/auth.js";
import tuitionRoutes from "./routes/tuitionRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const PORT = process.env.PORT || 5000;

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "MentorLagbe Server is Running!",
  });
});

async function startServer() {
  try {
    await connectDB();

    const auth = await createAuth();

    // BetterAuth routes
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // JSON middleware
    app.use(express.json());

    app.use("/api/tuitions", tuitionRoutes);

     // Application routes
    app.use("/api/applications", applicationRoutes);

    app.use("/api/admin", adminRoutes);

    app.use("/api/payments", paymentRoutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
