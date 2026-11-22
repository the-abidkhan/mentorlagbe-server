import "dotenv/config";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";
import { connectDB } from "./db.js";

export async function createAuth() {
  const database = await connectDB();

  const clientUrl =
    process.env.CLIENT_URL || "https://mentorlagbe-client-ebon.vercel.app";

  const allowedOrigins = [
    "http://localhost:3000",
    "https://mentorlagbe-client-ebon.vercel.app",
    "https://mentorlagbe-client-gdz6fwzdj-theabidkhan.vercel.app",
    clientUrl,
  ].filter(Boolean) as string[];

  const isProd = process.env.NODE_ENV === "production";

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,

    trustedOrigins: allowedOrigins,

    database: mongodbAdapter(database),

    advanced: {
      defaultCookieAttributes: {
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
        httpOnly: true,
      },
    },

    onAPIError: {
      errorURL: `${clientUrl}/login`,
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },

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
          input: true,
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

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = user.role || "student";

            if (role !== "student" && role !== "tutor") {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid role selection.",
              });
            }

            return {
              data: {
                ...user,
                role,
              },
            };
          },
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