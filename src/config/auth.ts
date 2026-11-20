
import "dotenv/config";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";
import { connectDB } from "./db.js";

export async function createAuth() {
  const database = await connectDB();

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: ["http://localhost:3000"],
    database: mongodbAdapter(database),

    emailAndPassword: {
      enabled: true,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
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

    plugins: [
      jwt({
        jwt: {
          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            role: user.role,
          }),
        },
      }),
    ],
  });
}
