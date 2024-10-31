import 'dotenv/config';
import express from "express";
import websocketExpress from 'express-ws';
import {sessionStarter} from "puzzle-host-data-layer";
import setupServer from "./serverSetup.js";
import authorization from "./authorization.js";
import puzzleListener from "./endpoints/puzzleListener.js";
import EventEmitter from "node:events";

const port = 8888;
const app = websocketExpress(express()).app;

(async function() {
  // todo: fix up cors.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", ["*"]);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  let dbClient = null;
  try {
    dbClient = await sessionStarter(process.argv[process.argv.length - 1]);
  }
  catch(e) {
    console.log("error connecting to database:", e);
    return;
  }
  const eventing = new EventEmitter();

  setupServer(app, authorization, dbClient, eventing);

  app.ws("/puzzle/:id", puzzleListener(eventing));

  app.listen(port, () => {
    console.log(`Server started on port: ${port}
ctrl+c to quit
`);
  });
})();
