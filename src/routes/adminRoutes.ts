
import express from "express";
import { getCollections } from "../config/db.js";
import {
  AuthRequest,
  verifyToken,
  verifyAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all users
router.get(
  "/users",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { users } = await getCollections();

      const result = await users
        .find({})
        .project({
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          phone: 1,
          plan: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        message: "Failed to fetch users.",
      });
    }
  }
);

// Get pending tuitions
router.get(
  "/tuitions/pending",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { tuitions } = await getCollections();

      const result = await tuitions
        .find({ approvalStatus: "pending" })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        message: "Failed to fetch pending tuitions.",
      });
    }
  }
);

// Get dashboard statistics
router.get(
  "/stats",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { users, tuitions, applications, payments } =
        await getCollections();

      const [
        totalUsers,
        totalStudents,
        totalTutors,
        totalTuitions,
        pendingTuitions,
        totalApplications,
        totalPayments,
      ] = await Promise.all([
        users.countDocuments(),
        users.countDocuments({ role: "student" }),
        users.countDocuments({ role: "tutor" }),
        tuitions.countDocuments(),
        tuitions.countDocuments({ approvalStatus: "pending" }),
        applications.countDocuments(),
        payments.countDocuments({ paymentStatus: "paid" }),
      ]);

      res.status(200).json({
        totalUsers,
        totalStudents,
        totalTutors,
        totalTuitions,
        pendingTuitions,
        totalApplications,
        totalPayments,
      });
    } catch {
      res.status(500).json({
        message: "Failed to fetch dashboard statistics.",
      });
    }
  }
);

export default router;
