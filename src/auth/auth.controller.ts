import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, refreshTokens } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "../config/env";
import { generateAccessToken, generateRefreshToken, hashToken } from "../utils/token.util";

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

interface AuthRequest extends Request {
  user?: JWTPayload;
}

// ========== REGISTER ==========
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [newUser] = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      role: "VIEWER",
      provider: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const accessToken = generateAccessToken({ userId: newUser.id, email: newUser.email, role: newUser.role });
    const refreshToken = generateRefreshToken({ userId: newUser.id });

    const hashedRefreshToken = await hashToken(refreshToken);
    await db.insert(refreshTokens).values({
      userId: newUser.id,
      tokenHash: hashedRefreshToken,
      deviceId: "web",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // httpOnly cookie as required
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      accessToken,
      user: { id: newUser.id, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== LOGIN ==========
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash || "");
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Token rotation - delete old tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    const hashedRefreshToken = await hashToken(refreshToken);
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashedRefreshToken,
      deviceId: "web",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== REFRESH TOKEN (with rotation) ==========
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JWTPayload;
    const hashedToken = await hashToken(refreshToken);

    const [storedToken] = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, hashedToken),
        eq(refreshTokens.userId, decoded.userId)
      ));

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Rotate tokens - delete old, create new
    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    const newHashedToken = await hashToken(newRefreshToken);
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: newHashedToken,
      deviceId: storedToken.deviceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(401).json({ error: "Invalid refresh token" });
  }
};

// ========== LOGOUT ==========
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const hashedToken = await hashToken(refreshToken);
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashedToken));
    }
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== GET ME ==========
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      provider: users.provider,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.user!.userId));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== MOBILE LOGIN ==========
export const mobileLogin = async (req: Request, res: Response) => {
  try {
    const { email, password, deviceId } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash || "");
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Delete old tokens for this device
    await db.delete(refreshTokens).where(
      and(eq(refreshTokens.userId, user.id), eq(refreshTokens.deviceId, deviceId))
    );

    const hashedRefreshToken = await hashToken(refreshToken);
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashedRefreshToken,
      deviceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // No cookies for mobile - return tokens in JSON
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== MOBILE REFRESH ==========
export const mobileRefresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken, deviceId } = req.body;

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JWTPayload;
    const hashedToken = await hashToken(refreshToken);

    const [storedToken] = await db.select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, hashedToken),
        eq(refreshTokens.userId, decoded.userId),
        deviceId ? eq(refreshTokens.deviceId, deviceId) : undefined
      ));

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    const newHashedToken = await hashToken(newRefreshToken);
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: newHashedToken,
      deviceId: deviceId || storedToken.deviceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("Mobile refresh error:", error);
    res.status(401).json({ error: "Invalid refresh token" });
  }
};

// ========== OAUTH CALLBACKS ==========
export const googleCallback = async (req: Request, res: Response) => {
  const user = req.user as any;
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  const hashedRefreshToken = await hashToken(refreshToken);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashedRefreshToken,
    deviceId: "web",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.redirect(`${env.FRONTEND_URL}/oauth-callback?token=${accessToken}`);
};

export const githubCallback = async (req: Request, res: Response) => {
  const user = req.user as any;
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  const hashedRefreshToken = await hashToken(refreshToken);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashedRefreshToken,
    deviceId: "web",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.redirect(`${env.FRONTEND_URL}/oauth-callback?token=${accessToken}`);
};