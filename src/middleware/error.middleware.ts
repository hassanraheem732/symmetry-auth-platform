import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { JsonWebTokenError } from "jsonwebtoken";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid input data",
      details: err.errors,
    });
  }

  // JWT errors
  if (err instanceof JsonWebTokenError) {
    return res.status(401).json({
      error: "Authentication Error",
      message: "Invalid or expired token",
    });
  }

  // Database errors
  if (err.message?.includes("duplicate key")) {
    return res.status(409).json({
      error: "Conflict",
      message: "Resource already exists",
    });
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === "production" 
    ? "Internal server error" 
    : err.message;

  res.status(statusCode).json({
    error: err.name || "Internal Server Error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// Async wrapper to avoid try-catch in controllers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};