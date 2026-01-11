import { Router } from "express";
import { downloadReport, getQuarterlyReports, getYearlyReports } from "../controllers/reportController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/authMiddleware";

export const reportRoutes = Router();

reportRoutes.get("/reports/quarterly", requireAuth, asyncHandler(getQuarterlyReports));
reportRoutes.get("/reports/yearly", requireAuth, asyncHandler(getYearlyReports));
reportRoutes.get("/reports/download", requireAuth, asyncHandler(downloadReport));
