
import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import {
  AuthRequest,
  verifyToken,
  verifyTutor,
  verifyStudent,
  verifyAdmin,
} from "../middleware/authMiddleware.js";
import { Tuition } from "../types/index.js";

const router = express.Router();

// Add tutor's plan to a list of tuitions
const addTutorPlans = async (tuitionsList: any[]) => {
  const { users } = await getCollections();

  const tutorEmails = [
    ...new Set(
      tuitionsList
        .map((tuition) => tuition.tutorEmail)
        .filter((email) => typeof email === "string")
    ),
  ];

  if (tutorEmails.length === 0) {
    return tuitionsList.map((tuition) => ({
      ...tuition,
      tutorPlan: "free",
    }));
  }

  const tutors = await users
    .find(
      { email: { $in: tutorEmails } },
      { projection: { email: 1, plan: 1 } }
    )
    .toArray();

  const tutorPlans = new Map(
    tutors.map((tutor) => [tutor.email, tutor.plan || "free"])
  );

  return tuitionsList.map((tuition) => ({
    ...tuition,
    tutorPlan: tutorPlans.get(tuition.tutorEmail) || "free",
  }));
};

// Get all approved and active tuitions with search and filters
router.get("/", async (req, res) => {
  try {
    const { tuitions } = await getCollections();

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const subject =
      typeof req.query.subject === "string" ? req.query.subject.trim() : "";

    const classLevel =
      typeof req.query.classLevel === "string"
        ? req.query.classLevel.trim()
        : "";

    const mode =
      typeof req.query.mode === "string" ? req.query.mode.trim() : "";

    if (mode && !["Online", "Offline"].includes(mode)) {
      return res.status(400).json({ message: "Invalid tuition mode." });
    }

    const filter: any = {
      approvalStatus: "approved",
      isActive: true,
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { title: searchRegex },
        { subject: searchRegex },
      ];
    }

    if (subject) {
      const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.subject = new RegExp(`^${escapedSubject}$`, "i");
    }

    if (classLevel) {
      const escapedClassLevel = classLevel.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      filter.classLevel = new RegExp(`^${escapedClassLevel}$`, "i");
    }

    if (mode) {
      filter.mode = mode;
    }

    const result = await tuitions
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const updatedTuitions = await addTutorPlans(result);

    res.status(200).json(updatedTuitions);
  } catch {
    res.status(500).json({ message: "Failed to fetch tuitions." });
  }
});

// Get student's saved tuitions
// Keep this route before /:id
router.get(
  "/saved",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const { users, tuitions } = await getCollections();

      const user = await users.findOne({ email: req.user!.email });

      if (!user) {
        return res.status(404).json({ message: "Student not found." });
      }

      const savedIds: string[] = user.savedTuitionIds || [];

      if (savedIds.length === 0) {
        return res.status(200).json([]);
      }

      const objectIds = savedIds
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));

      const savedTuitions = await tuitions
        .find({
          _id: { $in: objectIds },
          approvalStatus: "approved",
          isActive: true,
        })
        .toArray();

      // Keep the same order as the student's saved list
      const orderedTuitions = savedIds
        .map((id: string) =>
          savedTuitions.find((tuition) => tuition._id.toString() === id)
        )
        .filter(Boolean);

      const updatedTuitions = await addTutorPlans(orderedTuitions);

      res.status(200).json(updatedTuitions);
    } catch {
      res.status(500).json({ message: "Failed to fetch saved tuitions." });
    }
  }
);

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

// Add tuition to student's bookmarks
router.post(
  "/:id/bookmark",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({ message: "Invalid tuition ID." });
      }

      const { users, tuitions } = await getCollections();

      const tuition = await tuitions.findOne({
        _id: new ObjectId(tuitionId),
        approvalStatus: "approved",
        isActive: true,
      });

      if (!tuition) {
        return res.status(404).json({ message: "Tuition not found." });
      }

      const user = await users.findOne({ email: req.user!.email });

      if (!user) {
        return res.status(404).json({ message: "Student not found." });
      }

      const savedIds: string[] = user.savedTuitionIds || [];

      if (savedIds.includes(tuitionId)) {
        return res.status(200).json({
          message: "Tuition is already saved.",
          saved: true,
        });
      }

      const plan = user.plan || "free";

      // Free students can save up to 5 tuitions
      if (plan !== "pro" && savedIds.length >= 5) {
        return res.status(403).json({
          message:
            "Free plan allows only 5 saved tuitions. Upgrade to Pro for unlimited bookmarks.",
          limitReached: true,
        });
      }

      // Add the bookmark only if the free plan limit is not exceeded
      const updateFilter: any = {
        email: req.user!.email,
      };

      if (plan !== "pro") {
        updateFilter.$expr = {
          $lt: [{ $size: { $ifNull: ["$savedTuitionIds", []] } }, 5],
        };
      }

      const result = await users.updateOne(updateFilter, {
        $addToSet: { savedTuitionIds: tuitionId },
      });

      if (result.matchedCount === 0) {
        return res.status(403).json({
          message: "You have reached your 5 bookmark limit. Upgrade to Pro.",
          limitReached: true,
        });
      }

      res.status(200).json({
        message: "Tuition saved successfully.",
        saved: true,
      });
    } catch {
      res.status(500).json({ message: "Failed to save tuition." });
    }
  }
);

// Remove tuition from student's bookmarks
router.delete(
  "/:id/bookmark",
  verifyToken,
  verifyStudent,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({ message: "Invalid tuition ID." });
      }

      const { users } = await getCollections();

      const result = await users.updateOne(
        { email: req.user!.email },
        {
          $pull: {
            savedTuitionIds: tuitionId,
          },
        } as any
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Student not found." });
      }

      res.status(200).json({
        message: "Tuition removed from saved list.",
        saved: false,
      });
    } catch {
      res.status(500).json({ message: "Failed to remove saved tuition." });
    }
  }
);

// Get single tuition
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition ID." });
    }

    const { users, tuitions } = await getCollections();

    const tuition = await tuitions.findOne({
      _id: new ObjectId(req.params.id),
      approvalStatus: "approved",
      isActive: true,
    });

    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." });
    }

    const tutor = await users.findOne(
      { email: tuition.tutorEmail },
      { projection: { plan: 1 } }
    );

    const updatedTuition = {
      ...tuition,
      tutorPlan: tutor?.plan || "free",
    };

    res.status(200).json(updatedTuition);
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

// Tutor deletes their own tuition
router.delete(
  "/:id",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({ message: "Invalid tuition ID." });
      }

      const { tuitions } = await getCollections();

      const result = await tuitions.deleteOne({
        _id: new ObjectId(tuitionId),
        tutorEmail: req.user!.email,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: "Tuition not found or you are not authorized to delete it.",
        });
      }

      res.status(200).json({ message: "Tuition deleted successfully." });
    } catch {
      res.status(500).json({ message: "Failed to delete tuition." });
    }
  }
);

// Tutor activates or deactivates their own tuition
router.patch(
  "/:id/active",
  verifyToken,
  verifyTutor,
  async (req: AuthRequest, res) => {
    try {
      const tuitionId = req.params.id;
      const { isActive } = req.body;

      if (typeof tuitionId !== "string" || !ObjectId.isValid(tuitionId)) {
        return res.status(400).json({ message: "Invalid tuition ID." });
      }

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be true or false.",
        });
      }

      const { tuitions } = await getCollections();

      const result = await tuitions.updateOne(
        {
          _id: new ObjectId(tuitionId),
          tutorEmail: req.user!.email,
        },
        { $set: { isActive } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "Tuition not found or you are not authorized.",
        });
      }

      res.status(200).json({
        message: `Tuition ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch {
      res.status(500).json({ message: "Failed to update tuition status." });
    }
  }
);

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
      res.status(500).json({
        message: "Failed to update tuition approval status.",
      });
    }
  }
);

export default router;
