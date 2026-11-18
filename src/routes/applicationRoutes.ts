
import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import {
  AuthRequest,
  verifyToken,
  verifyStudent,
  verifyTutor,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Student applies for a tuition
router.post("/", verifyToken, verifyStudent, async (req: AuthRequest, res) => {
  try {
    const { tuitionId, studentPhone, preferredSchedule, studentNote } =
      req.body;

    if (
      typeof tuitionId !== "string" ||
      !ObjectId.isValid(tuitionId) ||
      !studentPhone ||
      !preferredSchedule
    ) {
      return res.status(400).json({
        message: "Please provide valid application information.",
      });
    }

    const { users, tuitions, applications } = await getCollections();

    const tuition = await tuitions.findOne({
      _id: new ObjectId(tuitionId),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({
        message: "Tuition not found or unavailable.",
      });
    }

    const student = await users.findOne({
      email: req.user!.email,
    });

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found.",
      });
    }

    const existingApplication = await applications.findOne({
      tuitionId: new ObjectId(tuitionId),
      studentEmail: req.user!.email,
    });

    if (existingApplication) {
      return res.status(409).json({
        message: "You have already applied for this tuition.",
      });
    }

    const newApplication = {
      tuitionId: new ObjectId(tuitionId),
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      studentName: student.name,
      studentEmail: req.user!.email,
      studentPhone,
      preferredSchedule,
      studentNote: studentNote || "",
      status: "pending",
      appliedAt: new Date(),
    };

    const result = await applications.insertOne(newApplication);

    res.status(201).json({
      message: "Application submitted successfully.",
      applicationId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to submit application.",
    });
  }
});

// Student views their applications
router.get(
  "/my",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const { applications } = await getCollections();

      const result = await applications
        .find({ studentEmail: req.user!.email })
        .sort({ appliedAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        message: "Failed to fetch your applications.",
      });
    }
  }
);

// Tutor views applications for their tuitions
router.get(
  "/tutor",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const { applications } = await getCollections();

      const result = await applications
        .find({ tutorEmail: req.user!.email })
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

// Tutor accepts or rejects an application
router.patch(
  "/:id/status",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const applicationId = req.params.id;
      const { status } = req.body;

      if (
        typeof applicationId !== "string" ||
        !ObjectId.isValid(applicationId)
      ) {
        return res.status(400).json({
          message: "Invalid application ID.",
        });
      }

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({
          message: "Status must be accepted or rejected.",
        });
      }

      const { applications } = await getCollections();

      const result = await applications.updateOne(
        {
          _id: new ObjectId(applicationId),
          tutorEmail: req.user!.email,
          status: "pending",
        },
        {
          $set: { status },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "Application not found or already processed.",
        });
      }

      res.status(200).json({
        message: `Application ${status} successfully.`,
      });
    } catch {
      res.status(500).json({
        message: "Failed to update application status.",
      });
    }
  }
);

export default router;
