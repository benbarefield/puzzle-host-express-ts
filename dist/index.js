import { __awaiter } from 'tslib';
import 'dotenv/config';
import express, { json, urlencoded } from 'express';
import websocketExpress from 'express-ws';
import { createPuzzle, getPuzzleById, verifyPuzzleOwnership, markPuzzleAsDeleted, updatePuzzle, getPuzzlesForUser, createPuzzleAnswer, getPuzzleAnswerById, getAnswersForPuzzle, removePuzzleAnswer, updatePuzzleAnswer, checkPuzzleGuess, sessionStarter } from 'puzzle-host-data-layer';
import EventEmitter from 'node:events';

function postPuzzle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const puzzleName = req.body.name;
        const currentUser = req.authenticatedUser;
        const createdId = yield createPuzzle(dataAccess, puzzleName, currentUser);
        res.status(201).send(createdId);
    });
}
function getPuzzle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const puzzleId = req.params.id;
        const currentUser = req.authenticatedUser;
        if (!currentUser) {
            res.status(401).send();
            return;
        }
        const puzzleData = yield getPuzzleById(dataAccess, puzzleId);
        if (!puzzleData) {
            res.status(404).send();
            return;
        }
        if (puzzleData.owner !== currentUser) {
            res.status(403).send();
            return;
        }
        res.send(JSON.stringify({ name: puzzleData.name, id: puzzleId }));
    });
}
function deletePuzzle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const puzzleId = req.params.id;
        const currentUser = req.authenticatedUser;
        if (!currentUser) {
            res.status(401).send();
            return;
        }
        const allowed = yield verifyPuzzleOwnership(dataAccess, puzzleId, currentUser);
        if (allowed === null) {
            res.status(404).send();
            return;
        }
        if (!allowed) {
            res.status(403).send();
            return;
        }
        const success = yield markPuzzleAsDeleted(dataAccess, puzzleId);
        if (!success) {
            res.status(404).send();
            return;
        }
        res.status(204).send();
    });
}
function putPuzzle(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const puzzleId = req.params.id;
        const currentUser = req.authenticatedUser;
        const { name } = req.body;
        if (!currentUser) {
            res.status(403).send();
            return;
        }
        const allowed = yield verifyPuzzleOwnership(dataAccess, puzzleId, currentUser);
        if (allowed === null) {
            res.status(404).send();
            return;
        }
        if (!allowed) {
            res.status(401).send();
            return;
        }
        let success = false;
        try {
            success = yield updatePuzzle(dataAccess, puzzleId, name);
        }
        catch (e) {
        }
        // if(!success) {
        //   res.status(404).send();
        //   return;
        // }
        res.status(204).send();
    });
}
function puzzle (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.method === "OPTIONS") {
            res.status(204).send();
            return;
        }
        if (req.method === 'POST') {
            return postPuzzle(req, res);
        }
        if (req.method === 'GET') {
            return getPuzzle(req, res);
        }
        if (req.method === "DELETE") {
            return deletePuzzle(req, res);
        }
        if (req.method === "PUT") {
            return putPuzzle(req, res);
        }
        res.status(501).send();
    });
}

function userPuzzles (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.method !== "GET") {
            res.status(501).send();
            return;
        }
        const dataAccess = req.app.get(DB_CLIENT);
        const userId = req.authenticatedUser;
        if (!userId) {
            res.status(403).send();
            return;
        }
        const puzzles = yield getPuzzlesForUser(dataAccess, userId);
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(puzzles.map(p => ({
            id: p.id,
            name: p.name,
        }))));
    });
}

function postPuzzleAnswer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentUser = req.authenticatedUser;
        if (!currentUser) {
            res.status(403).send();
            return;
        }
        const dataAccess = req.app.get(DB_CLIENT);
        const { puzzle, value, answerIndex } = req.body;
        const allowed = yield verifyPuzzleOwnership(dataAccess, puzzle, currentUser);
        if (allowed === null) {
            res.status(404).send();
            return;
        }
        if (!allowed) {
            res.status(401).send();
            return;
        }
        const id = yield createPuzzleAnswer(dataAccess, puzzle, value, +answerIndex);
        res.status(201).send(id);
    });
}
function getPuzzleAnswer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const currentUser = req.authenticatedUser;
        if (!currentUser) {
            res.status(403).send();
            return;
        }
        const dataAccess = req.app.get(DB_CLIENT);
        let puzzleId = ((_a = req.query.puzzle) === null || _a === void 0 ? void 0 : _a.toString()) || "";
        const answerId = req.params.id;
        if (puzzleId !== "" && answerId !== undefined) {
            res.status(414).send("Unsupported to get a puzzle answer by puzzle id and answer id");
            return;
        }
        let dataToSend;
        if (puzzleId === "") {
            const answer = yield getPuzzleAnswerById(dataAccess, answerId);
            if (!answer) {
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
        const ownershipVerified = yield verifyPuzzleOwnership(dataAccess, puzzleId, currentUser);
        if (ownershipVerified === null) {
            res.status(404).send();
            return;
        }
        if (!ownershipVerified) {
            res.status(401).send();
            return;
        }
        if (!dataToSend) {
            const answers = yield getAnswersForPuzzle(dataAccess, puzzleId);
            dataToSend = JSON.stringify(answers.map(p => ({
                id: p.id,
                value: p.value,
                puzzle: p.puzzle,
                answerIndex: p.answerIndex,
            })));
        }
        res.set('Content-Type', 'application/json');
        res.send(dataToSend);
    });
}
function deletePuzzleAnswer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const currentUser = req.authenticatedUser;
        const answerId = req.params.id;
        if (!currentUser) {
            res.status(403).send();
            return;
        }
        const answer = yield getPuzzleAnswerById(dataAccess, answerId);
        if (!answer) {
            res.status(404).send();
            return;
        }
        const allowed = yield verifyPuzzleOwnership(dataAccess, answer.puzzle, currentUser);
        if (!allowed) {
            res.status(401).send();
            return;
        }
        yield removePuzzleAnswer(dataAccess, answerId);
        res.status(204).send();
        return;
    });
}
function putPuzzleAnswer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataAccess = req.app.get(DB_CLIENT);
        const currentUser = req.authenticatedUser;
        const answerId = req.params.id;
        const { value, answerIndex } = req.body;
        if (!currentUser) {
            res.status(403).send();
            return;
        }
        let success = false;
        try {
            const answer = yield getPuzzleAnswerById(dataAccess, answerId);
            if (answer === null) {
                res.status(404).send();
                return;
            }
            const allowed = yield verifyPuzzleOwnership(dataAccess, answer.puzzle, currentUser);
            if (!allowed) {
                res.status(401).send();
                return;
            }
            success = yield updatePuzzleAnswer(dataAccess, answerId, value, answerIndex);
        }
        catch (e) {
            console.log(e);
            // todo: log better
        }
        if (!success) {
            res.status(500).send();
            return;
        }
        res.status(204).send();
    });
}
function puzzleAnswer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.method === "OPTIONS") {
            res.status(204).send();
        }
        if (req.method === "POST") {
            return postPuzzleAnswer(req, res);
        }
        if (req.method === "GET") {
            return getPuzzleAnswer(req, res);
        }
        if (req.method === "DELETE") {
            return deletePuzzleAnswer(req, res);
        }
        if (req.method === "PUT") {
            return putPuzzleAnswer(req, res);
        }
        res.status(501).send();
    });
}

const websocketMap = {};
const PUZZLE_QUERIED_EVENT = "puzzleQueried";
// todo: this end point needs testing...
function puzzleListener (ee) {
    ee.on(PUZZLE_QUERIED_EVENT, (puzzleId, success) => {
        let toBroadcastTo = websocketMap[puzzleId];
        if (!toBroadcastTo) {
            return;
        }
        for (let i = 0; i < toBroadcastTo.length; i++) {
            toBroadcastTo[i].send(success.toString());
        }
    });
    return (ws, req) => {
        const puzzleId = +req.params.id;
        if (isNaN(puzzleId)) {
            return;
        }
        if (!websocketMap[puzzleId]) {
            websocketMap[puzzleId] = [];
        }
        websocketMap[puzzleId].push(ws);
        ws.on('close', () => {
            websocketMap[puzzleId] = websocketMap[puzzleId].filter(w => w !== ws);
        });
    };
}

function queryPuzzle (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (req.method !== "GET") {
            res.status(501).send();
            return;
        }
        const dataAccess = req.app.get(DB_CLIENT);
        const puzzleId = req.params.id;
        const providedAnswers = req.params[0].split('/');
        const correct = yield checkPuzzleGuess(dataAccess, puzzleId, providedAnswers);
        if (correct === null) {
            res.status(404).send();
            return;
        }
        (_a = req.app.get(EVENT_EMITTER)) === null || _a === void 0 ? void 0 : _a.emit(PUZZLE_QUERIED_EVENT, puzzleId, correct);
        if (correct) {
            res.status(200).send("Correct");
        }
        else {
            res.status(422).send("Incorrect");
        }
    });
}

const DB_CLIENT = "dbClient";
const EVENT_EMITTER = "eventEmitter";
function setupServer(app, authMiddleware, dataAccess, eventEmitter = null) {
    app.set(DB_CLIENT, dataAccess);
    app.set(EVENT_EMITTER, eventEmitter);
    app.use(authMiddleware);
    app.use(json());
    app.use(urlencoded({ extended: false }));
    app.all("/api/puzzle/:id?", puzzle);
    app.all("/api/userPuzzles", userPuzzles);
    app.all("/api/puzzleAnswer/:id?", puzzleAnswer);
    app.all("/api/queryPuzzle/:id/*", queryPuzzle);
}

function authorization (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        req.authenticatedUser = "123456789";
        next();
    });
}

const port = 8888;
const app = websocketExpress(express()).app;
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        // todo: fix up cors.
        app.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", ["*"]);
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
            next();
        });
        let dbClient = null;
        try {
            dbClient = yield sessionStarter();
        }
        catch (e) {
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
    });
})();
