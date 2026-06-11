import { Router } from "express";
import passport from "passport";
import {
  register,
  login,
  refreshToken,
  logout,
  mobileLogin,
  mobileRefresh,
  getMe,
  googleCallback,
  githubCallback,
} from "./auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validate-zod.middleware";
import { registerSchema, loginSchema, mobileLoginSchema, refreshTokenSchema } from "./auth.schemas";

const router = Router();

// ========== LOCAL AUTH ==========
router.post("/register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);
router.post("/refresh", refreshToken);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getMe);

// ========== OAUTH ==========
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login" }), googleCallback);

router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get("/github/callback", passport.authenticate("github", { session: false, failureRedirect: "/login" }), githubCallback);

// ========== MOBILE AUTH ==========
router.post("/mobile/login", validateRequest(mobileLoginSchema), mobileLogin);
router.post("/mobile/refresh", validateRequest(refreshTokenSchema), mobileRefresh);

export default router;