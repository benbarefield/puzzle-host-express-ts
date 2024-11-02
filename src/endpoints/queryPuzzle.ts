import {Request, Response} from "express";
import {DB_CLIENT, EVENT_EMITTER} from "../serverSetup";
import {PUZZLE_QUERIED_EVENT} from "./puzzleListener";
import {checkPuzzleGuess} from "puzzle-host-data-layer";

export default async function(req: Request, res: Response): Promise<void> {
  if(req.method !== "GET") {
    res.status(501).send("Not implemented");
    return;
  }

  const dataAccess = req.app.get(DB_CLIENT);
  const puzzleId = req.params.id;

  const providedAnswers = req.params[0].split('/');
  const correct = await checkPuzzleGuess(dataAccess, puzzleId, providedAnswers);
  if(correct === null) {
      res.status(404).send();
      return;
  }

  req.app.get(EVENT_EMITTER)?.emit(PUZZLE_QUERIED_EVENT, puzzleId, correct);

  if(correct) {
    res.status(200).send("Correct");
  } else {
    res.status(422).send("Incorrect");
  }
}
