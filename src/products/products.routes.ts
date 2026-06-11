import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getDashboardStats,
} from "./products.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { validateRequest } from "../middleware/validate-zod.middleware";
import { createProductSchema, updateProductSchema } from "./products.schemas";

const router = Router();

// VIEWER+ (Anyone with valid JWT)
router.get("/", requireAuth, getProducts);
router.get("/categories", requireAuth, getCategories);
router.get("/:id", requireAuth, getProductById);

// MANAGER+
router.post("/", requireAuth, requireRole(["MANAGER", "ADMIN"]), validateRequest(createProductSchema), createProduct);
router.patch("/:id", requireAuth, requireRole(["MANAGER", "ADMIN"]), validateRequest(updateProductSchema), updateProduct);
router.get("/dashboard/stats", requireAuth, requireRole(["MANAGER", "ADMIN"]), getDashboardStats);

// ADMIN ONLY
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteProduct);

export default router;