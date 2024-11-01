import {Request} from 'express';
import {WebSocket} from 'ws';
import EventEmitter from "node:events";

const websocketMap: {
  [key: string]: WebSocket[];
} = {};

export const PUZZLE_QUERIED_EVENT = "puzzleQueried";

// todo: this end point needs testing...
export default function(ee: EventEmitter) {
  ee.on(PUZZLE_QUERIED_EVENT, (puzzleId, success) => {
    let toBroadcastTo = websocketMap[puzzleId];

    if(!toBroadcastTo) { return; }
    for(let i = 0; i < toBroadcastTo.length; i++) {
      toBroadcastTo[i].send(success.toString());
    }
  });

  return (ws: WebSocket, req: Request) => {
    const puzzleId = req.params.id;

    if(!websocketMap[puzzleId]) {
      websocketMap[puzzleId] = [];
    }

    websocketMap[puzzleId].push(ws);

    ws.on('close', () => {
      websocketMap[puzzleId] = websocketMap[puzzleId].filter(w => w !== ws);
    });
  }
}
