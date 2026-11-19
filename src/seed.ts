import "dotenv/config";
import { connectDB, getCollections } from "./config/db.js";


const seedTuitions = [
  {
    title: "Need a Physics Tutor for Class 10",
    subject: "Physics",
    classLevel: "Class 10",
    mode: "Offline",
    location: "Dhanmondi, Dhaka",
    monthlyFee: 5000,
    daysPerWeek: 4,
    bannerImage: "",
    description:
      "Looking for an experienced tutor to teach Physics with proper concept building and regular practice.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
    approvalStatus: "approved",
    isActive: true,
    createdAt: new Date(),
  },
  {
    title: "Mathematics Tutor Needed for Class 9",
    subject: "Mathematics",
    classLevel: "Class 9",
    mode: "Online",
    location: "Online",
    monthlyFee: 4000,
    daysPerWeek: 3,
    bannerImage: "",
    description:
      "Need a Mathematics tutor for regular online classes with problem-solving sessions.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
    approvalStatus: "approved",
    isActive: true,
    createdAt: new Date(),
  },
  {
    title: "English Tutor for HSC Student",
    subject: "English",
    classLevel: "HSC",
    mode: "Offline",
    location: "Uttara, Dhaka",
    monthlyFee: 6000,
    daysPerWeek: 4,
    bannerImage: "",
    description:
      "Looking for an English tutor to improve grammar, writing and overall communication skills.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
    approvalStatus: "approved",
    isActive: true,
    createdAt: new Date(),
  },
];

async function seedDatabase() {
  try {
    await connectDB();

    const { tuitions } = await getCollections();

    const existingDemoTuitions = await tuitions.countDocuments({
      tutorEmail: "demo.tutor@example.com",
    });

    if (existingDemoTuitions > 0) {
      console.log("Demo tuitions already exist. Skipping seed.");
      return;
    }

    const result = await tuitions.insertMany(seedTuitions);

    console.log(`${result.insertedCount} demo tuitions inserted.`);
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  }
}

seedDatabase();