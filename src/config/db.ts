
import "dotenv/config";
import { Db, MongoClient } from "mongodb";

const dbName = process.env.DB_NAME || "mentorlagbe";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export async function connectDB(): Promise<Db> {
  if (db) {
    return db;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing");
    }

    const mongoClient = new MongoClient(uri);

    await mongoClient.connect();

    client = mongoClient;
    db = mongoClient.db(dbName);

    console.log("MongoDB connected:", dbName);

    return db;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    client = null;
    db = null;

    throw error;
  }
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
