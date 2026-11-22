
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

// Student submits a new application
router.post(
  "/",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const {
        tuitionId,
        studentPhone,
        preferredSchedule,
        studentNote,
      } = req.body;

      if (!tuitionId || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({
          message: "Invalid tuition ID.",
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

      const application = {
        tuitionId: new ObjectId(tuitionId),
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        tutorEmail: tuition.tutorEmail,
        studentName: student.name,
        studentEmail: req.user!.email,
        studentPhone,
        preferredSchedule,
        studentNote,
        status: "pending",
        appliedAt: new Date(),
      };

      await applications.insertOne(application);

      res.status(201).json({
        message: "Application submitted successfully.",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to submit application.",
      });
    }
  }
);

// Student gets their own applications
router.get(
  "/my",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const { applications } = await getCollections();

      const result = await applications
        .find({
          studentEmail: req.user!.email,
        })
        .sort({ appliedAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch applications.",
      });
    }
  }
);

// Tutor gets applications for their tuitions
router.get(
  "/tutor",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const { applications } = await getCollections();

      const result = await applications
        .find({
          tutorEmail: req.user!.email,
        })
        .sort({ appliedAt: -1 })
        .toArray();

      res.status(200).json(result);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch applications.",
      });
    }
  }
);

// Student cancels their own pending application
router.delete(
  "/:id",
  verifyToken,
  verifyStudent,
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
        studentEmail: req.user!.email,
        status: "pending",
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: "Application not found or cannot be cancelled.",
        });
      }

      res.status(200).json({
        message: "Application cancelled successfully.",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to cancel application.",
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
          message: "Invalid application status.",
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
          $set: {
            status,
            updatedAt: new Date(),
          },
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
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to update application status.",
      });
    }
  }
);

export default router;
