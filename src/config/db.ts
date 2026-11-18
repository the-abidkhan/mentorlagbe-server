import "dotenv/config";
import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "mentorlagbe";

if (!uri) {
  throw new Error("MONGODB_URI is missing in .env");
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri!);
  await client.connect();
  db = client.db(dbName);
  console.log("MongoDB connected:", dbName);
  return db;
}

export async function getCollections() {
  const database = await connectDB();
  return {
    users: database.collection("users"),
    tuitions: database.collection("tuitions"),
    applications: database.collection("applications"),
    payments: database.collection("payments"),
  };
}