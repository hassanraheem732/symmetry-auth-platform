import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("3000"),
  
  // Database
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.string().transform(Number).default("5432"),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  
  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, "Access secret must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "Refresh secret must be at least 32 characters"),
  
  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),
  
  // OAuth - GitHub
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_CALLBACK_URL: z.string().url(),
  
  // Frontend
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  
  // API Keys
  API_KEY_SALT: z.string().default("symmetry-salt-2025"),
});

export const env = envSchema.parse(process.env);

// Database URL builder
export const DATABASE_URL = `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;