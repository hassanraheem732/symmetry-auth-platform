import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user exists on request
    if (!req.user) {
      return res.status(401).json({ 
        error: "Authentication required",
        message: "Please login first" 
      });
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You don't have permission to access this resource",
        requiredRoles: allowedRoles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

// Shortcut middleware for common roles
export const requireAdmin = requireRole(["ADMIN"]);
export const requireManager = requireRole(["MANAGER", "ADMIN"]);
export const requireViewer = requireRole(["VIEWER", "MANAGER", "ADMIN"]);