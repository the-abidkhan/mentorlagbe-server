
import express from "express";
import { ObjectId } from "mongodb";
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
      res.status(500).json({ message: "Failed to fetch users." });
    }
  }
);

// Update user role
router.patch(
  "/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (typeof userId !== "string" || !ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid user ID.",
        });
      }

      if (!["student", "tutor", "admin"].includes(role)) {
        return res.status(400).json({
          message: "Invalid user role.",
        });
      }

      const { users } = await getCollections();

      const result = await users.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            role,
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      res.status(200).json({
        message: "User role updated successfully.",
      });
    } catch {
      res.status(500).json({
        message: "Failed to update user role.",
      });
    }
  }
);

// Get all tuitions
router.get(
  "/tuitions",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { tuitions } = await getCollections();

      const result = await tuitions
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({ message: "Failed to fetch tuitions." });
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

// Admin deletes a tuition
router.delete(
  "/tuitions/:id",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({
          message: "Invalid tuition ID.",
        });
      }

      const { tuitions } = await getCollections();

      const result = await tuitions.deleteOne({
        _id: new ObjectId(tuitionId),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: "Tuition not found.",
        });
      }

      res.status(200).json({
        message: "Tuition deleted successfully.",
      });
    } catch {
      res.status(500).json({
        message: "Failed to delete tuition.",
      });
    }
  }
);

// Get all applications
router.get(
  "/applications",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { applications } = await getCollections();

      const result = await applications
        .find({})
        .sort({ appliedAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        message: "Failed to fetch applications.",
      });
    }
  }
);

// Admin deletes an application
router.delete(
  "/applications/:id",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const applicationId = req.params.id;

      if (
        typeof applicationId !== "string" ||
        !ObjectId.isValid(applicationId)
      ) {
        return res.status(400).json({
          message: "Invalid application ID.",
        });
      }

      const { applications } = await getCollections();

      const result = await applications.deleteOne({
        _id: new ObjectId(applicationId),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: "Application not found.",
        });
      }

      res.status(200).json({
        message: "Application deleted successfully.",
      });
    } catch {
      res.status(500).json({
        message: "Failed to delete application.",
      });
    }
  }
);

// Get all transactions
router.get(
  "/transactions",
  verifyToken,
  verifyAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const { payments } = await getCollections();

      const result = await payments
        .find({})
        .sort({ paidAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        message: "Failed to fetch transactions.",
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
        approvedTuitions,
        totalApplications,
        totalPayments,
        revenueResult,
      ] = await Promise.all([
        users.countDocuments(),
        users.countDocuments({ role: "student" }),
        users.countDocuments({ role: "tutor" }),
        tuitions.countDocuments(),
        tuitions.countDocuments({ approvalStatus: "pending" }),
        tuitions.countDocuments({ approvalStatus: "approved" }),
        applications.countDocuments(),
        payments.countDocuments({ paymentStatus: "paid" }),
        payments
          .aggregate([
            { $match: { paymentStatus: "paid" } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" },
              },
            },
          ])
          .toArray(),
      ]);

      const totalRevenue = revenueResult[0]?.totalRevenue || 0;

      res.status(200).json({
        totalUsers,
        totalStudents,
        totalTutors,
        totalTuitions,
        pendingTuitions,
        approvedTuitions,
        totalApplications,
        totalPayments,
        totalRevenue,
      });
    } catch {
      res.status(500).json({
        message: "Failed to fetch dashboard statistics.",
      });
    }
  }
);

export default router;
