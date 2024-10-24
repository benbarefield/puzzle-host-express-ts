import {Request, Response} from "express";
import {getAnswersForPuzzle} from "puzzle-host-data-layer";
import {DB_CLIENT, EVENT_EMITTER} from "../serverSetup";
import {PUZZLE_QUERIED_EVENT} from "./puzzleListener";

export default async function(req: Request, res: Response): Promise<void> {
  if(req.method !== "GET") {
    res.status(501).send();
    return;
  }

  const dataAccess = req.app.get(DB_CLIENT);
  const puzzleId = +req.params.id;

  if(isNaN(puzzleId)) {
    res.status(400).send("Invalid puzzle id");
    return;
  }

  const answers = await getAnswersForPuzzle(dataAccess, puzzleId);
  if(answers.length === 0) {
    res.status(404).send();
    return;
  }
  answers.sort((a, b) => a.answerIndex - b.answerIndex);

  const providedAnswers = req.params[0].split('/');

  if(providedAnswers.length > answers.length) {
    req.app.get(EVENT_EMITTER)?.emit(PUZZLE_QUERIED_EVENT, puzzleId, false);
    res.status(414).send("Incorrect");
    return;
  }

  let correct = true;
  for(let i = 0; i < answers.length; i++) {
    if(answers[i].value != providedAnswers[i]) {
      correct = false;
    }
  }

  req.app.get(EVENT_EMITTER)?.emit(PUZZLE_QUERIED_EVENT, puzzleId, correct);
  if(correct) {
    res.status(200).send("Correct");
  } else {
    res.status(422).send("Incorrect");
  }
}
