
import { ObjectId } from "mongodb";

export type UserRole = "student" | "tutor" | "admin";
export type UserPlan = "free" | "pro";

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  phone: string;
  bio?: string;
  plan: UserPlan;
  createdAt: Date;
}

export interface Tuition {
  _id?: ObjectId;
  title: string;
  subject: string;
  classLevel: string;
  mode: "Online" | "Offline";
  location: string;
  monthlyFee: number;
  daysPerWeek: number;
  bannerImage: string;
  description: string;
  tutorName: string;
  tutorEmail: string;
  approvalStatus: "pending" | "approved" | "rejected";
  isActive: boolean;
  createdAt: Date;
}

export interface Application {
  _id?: ObjectId;
  tuitionId: ObjectId;
  tuitionTitle: string;
  subject: string;
  monthlyFee: number;
  tutorEmail: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  preferredSchedule: string;
  studentNote: string;
  status: "pending" | "accepted" | "rejected";
  appliedAt: Date;
}

export interface Payment {
  _id?: ObjectId;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  planName: UserPlan;
  amount: number;
  currency: string;
  transactionId: string;
  stripeSessionId: string;
  paymentStatus: "paid";
  paidAt: Date;
}
