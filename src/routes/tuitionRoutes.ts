
import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import {
  AuthRequest,
  verifyToken,
  verifyTutor,
  verifyAdmin,
} from "../middleware/authMiddleware.js";
import { Tuition } from "../types/index.js";

const router = express.Router();

// Get all approved and active tuitions
router.get("/", async (_req, res) => {
  try {
    const { tuitions } = await getCollections();

    const result = await tuitions
      .find({
        approvalStatus: "approved",
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch tuitions." });
  }
});

// Get tutor's own tuitions
router.get(
  "/my",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const { tuitions } = await getCollections();

      const result = await tuitions
        .find({ tutorEmail: req.user!.email })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({ message: "Failed to fetch your tuitions." });
    }
  }
);

// Get single tuition
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition ID." });
    }

    const { tuitions } = await getCollections();

    const tuition = await tuitions.findOne({
      _id: new ObjectId(req.params.id),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." });
    }

    res.status(200).json(tuition);
  } catch {
    res.status(500).json({ message: "Failed to fetch tuition." });
  }
});

// Tutor creates a tuition
router.post("/", verifyToken, verifyTutor, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      bannerImage,
      description,
    } = req.body;

    if (
      !title ||
      !subject ||
      !classLevel ||
      !mode ||
      !location ||
      !monthlyFee ||
      !daysPerWeek ||
      !description
    ) {
      return res.status(400).json({
        message: "Please provide all required fields.",
      });
    }

    if (!["Online", "Offline"].includes(mode)) {
      return res.status(400).json({ message: "Invalid tuition mode." });
    }

    if (
      !Number.isFinite(Number(monthlyFee)) ||
      Number(monthlyFee) <= 0 ||
      !Number.isInteger(Number(daysPerWeek)) ||
      Number(daysPerWeek) < 1 ||
      Number(daysPerWeek) > 7
    ) {
      return res.status(400).json({
        message: "Invalid monthly fee or days per week.",
      });
    }

    const { users, tuitions } = await getCollections();

    const user = await users.findOne({ email: req.user!.email });

    if (!user) {
      return res.status(404).json({ message: "Tutor not found." });
    }

    const plan = user.plan || "free";

    if (plan === "free") {
      const tuitionCount = await tuitions.countDocuments({
        tutorEmail: req.user!.email,
      });

      if (tuitionCount >= 2) {
        return res.status(403).json({
          message: "Free plan allows only 2 tuition posts. Upgrade to Pro.",
        });
      }
    }

    const newTuition: Omit<Tuition, "_id"> = {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee: Number(monthlyFee),
      daysPerWeek: Number(daysPerWeek),
      bannerImage: bannerImage || "",
      description,
      tutorName: user.name,
      tutorEmail: req.user!.email,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };

    const result = await tuitions.insertOne(newTuition);

    res.status(201).json({
      message: "Tuition submitted for admin approval.",
      tuitionId: result.insertedId,
    });
  } catch {
    res.status(500).json({ message: "Failed to create tuition." });
  }
});

// Tutor updates their own tuition
router.patch("/:id", verifyToken, verifyTutor, async (req: AuthRequest, res) => {
  try {
    const tuitionId = req.params.id;

    if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
      return res.status(400).json({ message: "Invalid tuition ID." });
    }

    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      bannerImage,
      description,
    } = req.body;

    if (
      !title ||
      !subject ||
      !classLevel ||
      !mode ||
      !location ||
      !monthlyFee ||
      !daysPerWeek ||
      !description
    ) {
      return res.status(400).json({
        message: "Please provide all required fields.",
      });
    }

    if (!["Online", "Offline"].includes(mode)) {
      return res.status(400).json({ message: "Invalid tuition mode." });
    }

    if (
      !Number.isFinite(Number(monthlyFee)) ||
      Number(monthlyFee) <= 0 ||
      !Number.isInteger(Number(daysPerWeek)) ||
      Number(daysPerWeek) < 1 ||
      Number(daysPerWeek) > 7
    ) {
      return res.status(400).json({
        message: "Invalid monthly fee or days per week.",
      });
    }

    const { tuitions } = await getCollections();

    const result = await tuitions.updateOne(
      {
        _id: new ObjectId(tuitionId),
        tutorEmail: req.user!.email,
      },
      {
        $set: {
          title,
          subject,
          classLevel,
          mode,
          location,
          monthlyFee: Number(monthlyFee),
          daysPerWeek: Number(daysPerWeek),
          bannerImage: bannerImage || "",
          description,
          approvalStatus: "pending",
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Tuition not found or you are not authorized to edit it.",
      });
    }

    res.status(200).json({
      message: "Tuition updated successfully. Waiting for admin approval.",
    });
  } catch {
    res.status(500).json({ message: "Failed to update tuition." });
  }
});


// Admin approves or rejects a tuition
router.patch(
  "/:id/approval",
  verifyToken,
  verifyAdmin,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({ message: "Invalid tuition ID." });
      }

      const { approvalStatus } = req.body;

      if (!["approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json({
          message: "Status must be approved or rejected.",
        });
      }

      const { tuitions } = await getCollections();

      const result = await tuitions.updateOne(
        { _id: new ObjectId(tuitionId) },
        { $set: { approvalStatus } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Tuition not found." });
      }

      res.status(200).json({
        message: `Tuition ${approvalStatus} successfully.`,
      });
    } catch {
      res.status(500).json({ message: "Failed to update tuition status." });
    }
  }
);

export default router;
