import { Router } from "express";


const router = Router();

router.get("/register", (req, res)=>{
    res.send("Register route working");
});

router.post("/register", async (req, res) =>{
    res.json({
        message:"Register route working",
    });
});

export default router;