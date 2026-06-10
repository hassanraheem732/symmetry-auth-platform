import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "../db/schema";

const router = Router();
router.get("/register", (req, res) => {
  res.send("Register route working");
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    //Email check

    const existingUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // Password hash
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Save user
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

router.post("/login", async (req, res) => {
  try{
    const { email, password } = req.body;

    res.json({
      email,
      password,
    });
  } catch(error) {
    console.error(error);

    res.status(500).json({
      massage: "Something went wrong",
    });
  }
});

export default router;