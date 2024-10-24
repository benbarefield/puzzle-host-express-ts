import {Application, json, urlencoded, RequestHandler} from 'express';
import puzzle from "./endpoints/puzzle";
import userPuzzles from "./endpoints/userPuzzles";
import puzzleAnswer from "./endpoints/puzzleAnswer";
import queryPuzzle from "./endpoints/queryPuzzle";
import EventEmitter from "node:events";

export const DB_CLIENT = "dbClient";
export const EVENT_EMITTER = "eventEmitter";

export default function setupServer(app : Application, authMiddleware: RequestHandler, dataAccess: any, eventEmitter: EventEmitter = null) {
  app.set(DB_CLIENT, dataAccess);
  app.set(EVENT_EMITTER, eventEmitter);
  app.use(authMiddleware);
  app.use(json());
  app.use(urlencoded({extended: false}));

  app.all("/api/puzzle/:id?", puzzle);
  app.all("/api/userPuzzles", userPuzzles);
  app.all("/api/puzzleAnswer/:id?", puzzleAnswer);
  app.all("/api/queryPuzzle/:id/*", queryPuzzle);
}
