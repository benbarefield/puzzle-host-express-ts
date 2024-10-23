import {Request, Response, NextFunction} from "express";

export default async function(req: Request, res: Response, next: NextFunction) {
  req.authenticatedUser = "123456789";

  next();
}
