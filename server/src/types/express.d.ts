import type { TokenPayload } from "../utils/tokenFactory";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}
