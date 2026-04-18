import { Router } from "express";
const router = Router();

// Test Command
router.get('/test', (req, res) => {
    const testResponse = { "response": "Success: Viewing Political Data" };
    res.json(testResponse);
})

export default router;