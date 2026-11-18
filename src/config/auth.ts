
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { connectDB } from "./db.js";

export async function createAuth() {
  const database = await connectDB();

  return betterAuth({
    database: mongodbAdapter(database),

    emailAndPassword: {
      enabled: true,
    },

    user: {
      modelName: "users",

      additionalFields: {
        role: {
          type: ["student", "tutor", "admin"],
          required: false,
          defaultValue: "student",
          input: false,
        },

        phone: {
          type: "string",
          required: false,
        },

        bio: {
          type: "string",
          required: false,
        },

        plan: {
          type: ["free", "pro"],
          required: false,
          defaultValue: "free",
          input: false,
        },
      },
    },
  });
}
