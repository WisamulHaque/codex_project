import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/health", (_request, response) => {
  void _request;
  return response.status(200).json({ status: "ok" });
});
