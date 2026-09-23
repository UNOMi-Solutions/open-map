// import env file, and axios (automatic json)
import dotenv from "dotenv";
dotenv.config();

import axios from "axios"

import { response, Router } from "express";

const router = Router();

// Test Command
router.get('/test', (req, res) => {
    const testResponse = { "response": "Success: Viewing Flock Data" };
    res.json(testResponse);
});

router.get('/cameras', (req, res) => {
    
})

export default router;