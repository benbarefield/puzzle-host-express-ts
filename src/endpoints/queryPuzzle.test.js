import express from "express";
import setupServer from "../serverSetup";
import fakeAuth from "../../test/fakeAuth";
import request from "supertest";
import {testingStart} from 'puzzle-host-data-layer';
import {EventEmitter} from "node:events";
import {PUZZLE_QUERIED_EVENT} from "./puzzleListener";

describe('querying a puzzle', () => {
  jest.setTimeout(60000);

  let dataAccess, teardown, expressApp, eventEmitter;
  let originalUser = "123344567";
  const userHelper = {id: originalUser};

  beforeEach(async () => {
    userHelper.id = originalUser;

    expressApp = express();

    ({dataAccess, teardown} = await testingStart());
    eventEmitter = new EventEmitter();
    setupServer(expressApp, fakeAuth(userHelper), dataAccess, eventEmitter);
  });

  afterEach(async () => {
    await teardown();
  });

  describe('unsupported endpoint methods', () => {
    test('the response should be a 501', (done) => {
      request(expressApp)
        .post(`/api/queryPuzzle/123154/123123`)
        .expect(501, done);
    });

    test('responds with 404 for a potentially invalid id', done => {
      request(expressApp)
        .get('/api/queryPuzzle/asdf/123123')
        .expect(404, done);
    });
  });

  async function createAnswers(puzzleId, value1, value2, value3) {
    await request(expressApp)
      .post('/api/puzzleAnswer')
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        puzzle: puzzleId,
        value: value1,
        answerIndex: 0,
      }))
    await request(expressApp)
      .post('/api/puzzleAnswer')
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        puzzle: puzzleId,
        value: value3,
        answerIndex: 1,
      }));
    await request(expressApp)
      .post('/api/puzzleAnswer')
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        puzzle: puzzleId,
        value: value2,
        answerIndex: 1,
      }));
  }

  describe('when a puzzle exists with answers', () => {
    test('the response is correct when the provided answer is correct', async() => {
      // todo: I think this should be failing??????
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      const response = await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value2}/${value3}`);

      expect(response.status).toBe(200);
      expect(response.text).toBe("Correct");
    });

    test('the response is incorrect when the provided answer is not correct', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      const response = await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value3}/${value2}`);

      expect(response.status).toBe(422);
      expect(response.text).toBe("Incorrect");
    });

    test("too many answers results in an incorrect response", async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      const response = await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value2}/${value3}/23423`);

      expect(response.status).toBe(414);
      expect(response.text).toBe("Incorrect");
    });

    test('too few answers results in an incorrect response', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      const response = await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value3}`);

      expect(response.status).toBe(422);
      expect(response.text).toBe("Incorrect");
    });

    test('response is a 404 when there are no answers setup for the puzzle', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const response = await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/4654`);

      expect(response.status).toBe(404);
    });

    test('event is emitted when there is a correct query', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      let eventEmitted = false;
      eventEmitter.on(PUZZLE_QUERIED_EVENT, (puzzle, success) => {
        expect(puzzle).toEqual(puzzleId);
        expect(success).toBe(true);
        eventEmitted = true;
      });

      await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value2}/${value3}`)

      expect(eventEmitted).toBe(true);
    });

    test('event is emitted when there is an incorrect query', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      let eventEmitted = false;
      eventEmitter.on(PUZZLE_QUERIED_EVENT, (puzzle, success) => {
        expect(puzzle).toEqual(puzzleId);
        expect(success).toBe(false);
        eventEmitted = true;
      });

      await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value3}/${value3}`)

      expect(eventEmitted).toBe(true);
    });

    test('event is emitted when too many answers are provided', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value1 = "5", value2 = "8", value3 = "10";
      await createAnswers(puzzleId, value1, value2, value3);

      let eventEmitted = false;
      eventEmitter.on(PUZZLE_QUERIED_EVENT, (puzzle, success) => {
        expect(puzzle).toEqual(puzzleId);
        expect(success).toBe(false);
        eventEmitted = true;
      });

      await request(expressApp)
        .get(`/api/queryPuzzle/${puzzleId}/${value1}/${value3}/${value3}/${value2}`)

      expect(eventEmitted).toBe(true);
    });
  });
});
