
import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const authURL = process.env.BETTER_AUTH_URL;

if (!authURL) {
  throw new Error("BETTER_AUTH_URL is missing in .env");
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authURL)
);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized. Token missing.",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS);

    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid token payload.",
      });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

export function verifyStudent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "student") {
    return res.status(403).json({
      message: "Student access only.",
    });
  }

  next();
}

export function verifyTutor(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "tutor") {
    return res.status(403).json({
      message: "Tutor access only.",
    });
  }

  next();
}

export function verifyAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Admin access only.",
    });
  }

  next();
}
