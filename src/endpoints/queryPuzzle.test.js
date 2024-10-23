import express from "express";
import setupServer from "../serverSetup";
import fakeAuth from "../../test/fakeAuth";
import request from "supertest";
import {testingStart} from 'puzzle-host-data-layer';

describe('querying a puzzle', () => {
  jest.setTimeout(60000);

  let dataAccess, teardown, expressApp;
  let originalUser = "123344567";
  const userHelper = {id: originalUser};

  beforeEach(async () => {
    userHelper.id = originalUser;

    expressApp = express();

    ({dataAccess, teardown} = await testingStart());
    setupServer(expressApp, fakeAuth(userHelper), dataAccess);
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

    test('responds with 400 for a bad puzzle id', done => {
      request(expressApp)
        .get('/api/queryPuzzle/asdf/123123')
        .expect(400, done);
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
  });
});
