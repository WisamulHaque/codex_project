import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRoutes } from "./routes/authRoutes";
import { commentRoutes } from "./routes/commentRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { okrRoutes } from "./routes/okrRoutes";
import { reportRoutes } from "./routes/reportRoutes";
import { userRoutes } from "./routes/userRoutes";
import { healthRoutes } from "./routes/healthRoutes";
import { apiRateLimiter } from "./middleware/rateLimit";
import { AppError } from "./utils/appError";
import { logError, logInfo, logWarn } from "./utils/logger";

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(apiRateLimiter);

  app.use("/api/v1", healthRoutes);
  app.use("/api/v1", authRoutes);
  app.use("/api/v1", userRoutes);
  app.use("/api/v1", okrRoutes);
  app.use("/api/v1", commentRoutes);
  app.use("/api/v1", notificationRoutes);
  app.use("/api/v1", reportRoutes);

  app.use((_request, response) => {
    void _request;
    logWarn("route", "Route not found");
    response.status(404).json({ message: "Route not found" });
  });

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _request;
    void _next;
    logError("route", `Unhandled error: ${error.message}`, error);
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    response.status(500).json({ message: "Internal server error" });
  });

  logInfo("server", "Express app configured");
  return app;
}
