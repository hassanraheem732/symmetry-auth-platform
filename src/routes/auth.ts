import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, refreshTokens } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ========== ZOD SCHEMAS  ==========
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ========== VALIDATION MIDDLEWARE ==========
const validate = (schema: z.AnyZodObject) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Parse and validate request body
      const validatedData = await schema.parseAsync(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Structured validation error response
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
};

// ========== REGISTER ==========
router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    
    if (existingUser.length > 0) {
      // Structured error response
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        error: "Email already exists",
        timestamp: new Date().toISOString(),
      });
    }

    // Hash password 
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Save user
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      role: "VIEWER",
      provider: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    // Store refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // STRUCTURED SUCCESS RESPONSE
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Register error:", error);
    
    // STRUCTURED ERROR RESPONSE
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
      timestamp: new Date().toISOString(),
    });
  }
});

// ========== LOGIN ==========
router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "Invalid email or password",
        timestamp: new Date().toISOString(),
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash || "");
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: "Invalid email or password",
        timestamp: new Date().toISOString(),
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    // Store refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // STRUCTURED SUCCESS RESPONSE
    res.json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Login error:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Something went wrong",
      timestamp: new Date().toISOString(),
    });
  }
});

// ========== REFRESH TOKEN ==========
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
        error: "No refresh token provided",
        timestamp: new Date().toISOString(),
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };
    
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        error: "Invalid refresh token",
        timestamp: new Date().toISOString(),
      });
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // STRUCTURED SUCCESS RESPONSE
    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Refresh error:", error);
    
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
      error: "Token expired or invalid",
      timestamp: new Date().toISOString(),
    });
  }
});

// ========== LOGOUT ==========
router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("refreshToken");
    
    res.json({
      success: true,
      message: "Logged out successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: "Something went wrong",
      timestamp: new Date().toISOString(),
    });
  }
});

// ========== GET CURRENT USER ==========
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "No token provided",
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: number };
    
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      provider: users.provider,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, decoded.userId));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        error: "User does not exist",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: "User fetched successfully",
      data: { user },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      error: "Authentication failed",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;