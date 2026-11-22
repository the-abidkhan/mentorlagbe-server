
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
    bannerImage:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=1200&q=80",
    description:
      "Looking for an experienced tutor to teach Physics with proper concept building and regular practice.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Mathematics Tutor Needed for Class 9",
    subject: "Mathematics",
    classLevel: "Class 9",
    mode: "Online",
    location: "Online",
    monthlyFee: 4000,
    daysPerWeek: 3,
    bannerImage:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80",
    description:
      "Need a Mathematics tutor for regular online classes with problem-solving sessions.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "English Tutor for HSC Student",
    subject: "English",
    classLevel: "HSC",
    mode: "Offline",
    location: "Uttara, Dhaka",
    monthlyFee: 6000,
    daysPerWeek: 4,
    bannerImage:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    description:
      "Looking for an English tutor to improve grammar, writing and overall communication skills.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Chemistry Tutor Needed for SSC",
    subject: "Chemistry",
    classLevel: "SSC",
    mode: "Offline",
    location: "Mirpur, Dhaka",
    monthlyFee: 4500,
    daysPerWeek: 3,
    bannerImage:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
    description:
      "Need a Chemistry tutor for SSC preparation with chapter-wise lessons and exam practice.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Biology Tutor for HSC Student",
    subject: "Biology",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 5000,
    daysPerWeek: 4,
    bannerImage:
      "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=80",
    description:
      "Looking for a tutor to explain Biology concepts and help with regular revision.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "ICT Tutor Needed for HSC",
    subject: "ICT",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 3500,
    daysPerWeek: 3,
    bannerImage:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    description:
      "Need an ICT tutor for programming basics, theory and practical preparation.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Mathematics Tutor for Class 8",
    subject: "Mathematics",
    classLevel: "Class 8",
    mode: "Offline",
    location: "Bashundhara, Dhaka",
    monthlyFee: 4000,
    daysPerWeek: 4,
    bannerImage:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80",
    description:
      "Looking for a Mathematics tutor to help a Class 8 student improve problem-solving skills.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Physics Tutor for Class 9 Student",
    subject: "Physics",
    classLevel: "Class 9",
    mode: "Online",
    location: "Online",
    monthlyFee: 4000,
    daysPerWeek: 3,
    bannerImage:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=1200&q=80",
    description:
      "Need an online Physics tutor for regular lessons and preparation for school examinations.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "Chemistry Tutor for HSC Student",
    subject: "Chemistry",
    classLevel: "HSC",
    mode: "Offline",
    location: "Mohammadpur, Dhaka",
    monthlyFee: 5500,
    daysPerWeek: 4,
    bannerImage:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
    description:
      "Looking for an experienced Chemistry tutor for HSC topics and problem-solving practice.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
  {
    title: "English Tutor Needed for Class 5",
    subject: "English",
    classLevel: "Class 5",
    mode: "Offline",
    location: "Jatrabari, Dhaka",
    monthlyFee: 3000,
    daysPerWeek: 3,
    bannerImage:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    description:
      "Need an English tutor to help with grammar, reading, writing and school lessons.",
    tutorName: "Demo Tutor",
    tutorEmail: "demo.tutor@example.com",
  },
].map((tuition) => ({
  ...tuition,
  approvalStatus: "approved",
  isActive: true,
  createdAt: new Date(),
}));

async function seedDatabase() {
  try {
    await connectDB();

    const { tuitions } = await getCollections();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const tuition of seedTuitions) {
      const existingTuition = await tuitions.findOne({
        title: tuition.title,
        tutorEmail: tuition.tutorEmail,
      });

      if (existingTuition) {
        if (!existingTuition.bannerImage) {
          await tuitions.updateOne(
            { _id: existingTuition._id },
            {
              $set: {
                bannerImage: tuition.bannerImage,
              },
            }
          );

          updatedCount++;
        }
      } else {
        await tuitions.insertOne(tuition);
        insertedCount++;
      }
    }

    console.log(`${insertedCount} new demo tuitions inserted.`);
    console.log(`${updatedCount} existing demo tuitions updated.`);
    console.log("Seed process completed.");
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  }
}

seedDatabase();
