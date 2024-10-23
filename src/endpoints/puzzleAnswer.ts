import {Request, Response} from "express";
import {DB_CLIENT} from "../serverSetup";
import {
  createPuzzleAnswer,
  getAnswersForPuzzle,
  getPuzzleAnswerById,
  removePuzzleAnswer,
  updatePuzzleAnswer,
  getPuzzleById,
  verifyPuzzleOwnership
} from "puzzle-host-data-layer";

async function postPuzzleAnswer(req: Request, res: Response) : Promise<void> {
  const currentUser = req.authenticatedUser;
  if(!currentUser) {
    res.status(403).send();
    return;
  }

  const dataAccess = req.app.get(DB_CLIENT);
  const {puzzle, value, answerIndex}: {puzzle: number, value: string, answerIndex: number} = req.body;

  if(isNaN(puzzle)) {
    res.status(400).send("Invalid puzzle id");
    return;
  }

  const puzzleData = await getPuzzleById(dataAccess, puzzle);

  if(!puzzleData) {
    res.status(404).send();
    return;
  }

  if(puzzleData.owner !== currentUser) {
    res.status(401).send();
    return;
  }

  const id = await createPuzzleAnswer(dataAccess, puzzle, value, +answerIndex);

  res.status(201).send(id);
}

async function getPuzzleAnswer(req: Request, res: Response) : Promise<void> {
  const currentUser = req.authenticatedUser;
  if(!currentUser) {
    res.status(403).send();
    return;
  }
  const dataAccess = req.app.get(DB_CLIENT);
  let puzzleId = +req.query.puzzle;
  const answerId = +req.params.id;
  if((puzzleId || puzzleId === 0) && answerId) {
    res.status(414).send("Unsupported to get a puzzle answer by puzzle id and answer id");
    return;
  }

  if(isNaN(puzzleId) && isNaN(answerId)) {
    res.status(400).send("Invalid puzzle Id or answer Id");
    return;
  }

  let dataToSend: string;
  if(!puzzleId && puzzleId !== 0) { // support for id = 0?
    const answer = await getPuzzleAnswerById(dataAccess, answerId);
    if(!answer) {
      res.status(404).send();
      return;
    }

    dataToSend = JSON.stringify({
      id: answer.id,
      value: answer.value,
      puzzle: answer.puzzle,
      answerIndex: answer.answerIndex,
    });
    puzzleId = answer.puzzle;
  }

  const ownershipVerified = await verifyPuzzleOwnership(dataAccess, puzzleId, currentUser);
  if(!ownershipVerified) {
    res.status(401).send();
    return;
  }

  if(!dataToSend) {
    const answers = await getAnswersForPuzzle(dataAccess, puzzleId);

    dataToSend = JSON.stringify(answers.map(p => ({
      id: p.id,
      value: p.value,
      puzzle: p.puzzle,
      answerIndex: p.answerIndex,
    })));
  }

  res.set('Content-Type', 'application/json');
  res.send(dataToSend);
}

async function deletePuzzleAnswer(req: Request, res: Response) : Promise<void> {
  const dataAccess = req.app.get(DB_CLIENT);
  const currentUser = req.authenticatedUser;
  const answerId = +req.params.id;

  if(!currentUser) {
    res.status(403).send();
    return;
  }

  if(isNaN(answerId)) {
    res.status(400).send();
    return;
  }

  const answer = await getPuzzleAnswerById(dataAccess, answerId);
  if(!answer) {
    res.status(404).send();
    return;
  }
  const allowed = await verifyPuzzleOwnership(dataAccess, answer.puzzle, currentUser);

  if(!allowed) {
    res.status(401).send();
    return;
  }

  await removePuzzleAnswer(dataAccess, answerId);

  res.status(204).send();
  return;
}

async function putPuzzleAnswer(req: Request, res: Response) : Promise<void> {
  const dataAccess = req.app.get(DB_CLIENT);
  const currentUser = req.authenticatedUser;
  const answerId = +req.params.id;
  const {value, answerIndex}: {value: string | undefined, answerIndex: number | undefined} = req.body;

  if(!currentUser) {
    res.status(403).send();
    return;
  }

  if(isNaN(answerId)) {
    res.status(400).send();
    return;
  }

  let success = false;
  try {
    const answer = await getPuzzleAnswerById(dataAccess, answerId);
    const allowed = await verifyPuzzleOwnership(dataAccess, answer.puzzle, currentUser);
    if(!allowed) {
      res.status(401).send();
      return;
    }

    success = await updatePuzzleAnswer(dataAccess, answerId, value, answerIndex);
  }
  catch(e) {
    console.log(e);
    // todo: log better
  }
  if(!success) {
    res.status(500).send();
    return;
  }

  res.status(204).send();
}

export default async function puzzleAnswer(req: Request, res: Response): Promise<void> {
  if(req.method === "OPTIONS") {
    res.status(204).send();
  }

  if(req.method === "POST") {
    return postPuzzleAnswer(req, res);
  }
  if(req.method === "GET") {
    return getPuzzleAnswer(req, res);
  }
  if(req.method === "DELETE") {
    return deletePuzzleAnswer(req, res);
  }
  if(req.method === "PUT") {
    return putPuzzleAnswer(req, res);
  }

  res.status(501).send();
}
