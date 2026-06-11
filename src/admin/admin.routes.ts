import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  revokeUserTokens,
  getSystemStats,
  getAuditLogs,
} from "./admin.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { validateRequest } from "../middleware/validate-zod.middleware";
import { updateUserRoleSchema, userIdParamSchema } from "./admin.schemas";

const router = Router();

// All admin routes require ADMIN role
router.use(requireAuth);
router.use(requireRole(["ADMIN"]));

// ========== USER MANAGEMENT ==========

/**
 * @route   GET /admin/users
 * @desc    Get all users with pagination and filters
 * @access  ADMIN only
 */
router.get("/users", getAllUsers);

/**
 * @route   GET /admin/users/:id
 * @desc    Get single user by ID
 * @access  ADMIN only
 */
router.get("/users/:id", validateRequest(userIdParamSchema, "params"), getUserById);

/**
 * @route   PATCH /admin/users/:id/role
 * @desc    Update user role
 * @access  ADMIN only
 */
router.patch(
  "/users/:id/role",
  validateRequest(updateUserRoleSchema),
  updateUserRole
);

/**
 * @route   DELETE /admin/users/:id
 * @desc    Delete user (soft delete)
 * @access  ADMIN only
 */
router.delete("/users/:id", validateRequest(userIdParamSchema, "params"), deleteUser);

/**
 * @route   POST /admin/users/:id/revoke-tokens
 * @desc    Revoke all refresh tokens for a user
 * @access  ADMIN only
 */
router.post(
  "/users/:id/revoke-tokens",
  validateRequest(userIdParamSchema, "params"),
  revokeUserTokens
);

// ========== SYSTEM MANAGEMENT ==========

/**
 * @route   GET /admin/stats
 * @desc    Get system statistics
 * @access  ADMIN only
 */
router.get("/stats", getSystemStats);

/**
 * @route   GET /admin/audit-logs
 * @desc    Get audit logs
 * @access  ADMIN only
 */
router.get("/audit-logs", getAuditLogs);

export default router;