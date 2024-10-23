import {Request, Response} from "express";
import {DB_CLIENT} from "../serverSetup";
import {getPuzzlesForUser} from "puzzle-host-data-layer";

export default async function(req: Request, res: Response) : Promise<void> {
  if(req.method !== "GET") {
    res.status(501).send();
    return;
  }

  const dataAccess = req.app.get(DB_CLIENT);
  const userId = req.authenticatedUser;

  if(!userId) {
    res.status(403).send();
    return;
  }

  const puzzles = await getPuzzlesForUser(dataAccess, userId);

  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(puzzles.map(p => ({
    id: p.id,
    name: p.name,
  }))));
}
