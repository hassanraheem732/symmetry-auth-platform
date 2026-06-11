import { Request, Response } from "express";
import { db } from "../db";
import { products, categories } from "../db/schema";
import { eq, ilike, and, desc, sql } from "drizzle-orm";

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const categoryId = req.query.categoryId as string;
    const search = req.query.search as string;

    let query = db.select().from(products).where(eq(products.isDeleted, false));

    if (categoryId) {
      query = query.where(eq(products.categoryId, parseInt(categoryId)));
    }
    if (search) {
      query = query.where(ilike(products.name, `%${search}%`));
    }

    const allProducts = await query.limit(limit).offset(offset);
    const total = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isDeleted, false));

    res.json({
      data: allProducts,
      pagination: { page, limit, total: total[0]?.count || 0, totalPages: Math.ceil((total[0]?.count || 0) / limit) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, parseInt(req.params.id)), eq(products.isDeleted, false)));
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const [product] = await db.insert(products).values({ ...req.body, price: req.body.price * 100 }).returning