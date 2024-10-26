import request from 'supertest';
import express from "express";
import setupServer from "../serverSetup";
import fakeAuth from "../../test/fakeAuth";
import {testingStart} from 'puzzle-host-data-layer';

describe("puzzle endpoint", () => {
  jest.setTimeout(60000);

  let dataAccess, teardown, expressApp;
  const originalUser = "123344567";
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

  describe('unsupported endpoints', () => {
    test('should send status 501', (done) => {
      request(expressApp)
        .merge('/api/puzzle')
        .expect(501, done);
    });
  });

  describe("bad inputs", () => {
    test('should respond with 404 when the puzzle id might be invalid', (done) => {
      request(expressApp)
        .get("/api/puzzle/abcd")
        .expect(404, done);
    });
  });

  describe("when a puzzle has been successfully created", () => {
    test('the response is a 201', (done) => {
      request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))
        .expect(201, done);
    });
    test('the response includes an id for the puzzle', async () => {
      const response = await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }));

      expect(response.text).toBeTruthy();
    });
  });

  describe("after creating a puzzle", () => {
    test("it can be retrieved", async () => {
      const puzzleName = "my first puzzle";

      const createResponse = await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: puzzleName }));

      const getResponse = await request(expressApp)
        .get(`/api/puzzle/${createResponse.text}`);

      const data = JSON.parse(getResponse.text);

      expect(data.name).toEqual(puzzleName);
      expect(""+data.id).toEqual(createResponse.text)
    });

    test("response is a 403 if the puzzle is not owned by the user", async () => {
      const puzzleName = "my first puzzle";

      const createResponse = await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: puzzleName }));

      userHelper.id = "134347656";
      const getResponse = await request(expressApp)
        .get(`/api/puzzle/${createResponse.text}`);

      expect(getResponse.status).toBe(403);
    });

    test("response is a 401 if there is no user", async () => {
      const puzzleName = "my first puzzle";

      const createResponse = await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: puzzleName }));

      userHelper.id = undefined;
      const getResponse = await request(expressApp)
        .get(`/api/puzzle/${createResponse.text}`);

      expect(getResponse.status).toBe(401);
    });

    test("getting a puzzle that does not exist responds with a 404", (done) => {
      request(expressApp)
        .get(`/api/puzzle/123456`)
        .expect(404, done);
    });
  });

  describe('deleting a puzzle', () => {
    const puzzleName = "my first puzzle";
    let puzzleId;

    beforeEach(async () => {
      puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: puzzleName }))).text;
    });

    test("it is no longer retrieved after being deleted", async () => {
      const deleteResponse = await request(expressApp)
        .delete(`/api/puzzle/${puzzleId}`);

      expect(deleteResponse.status).toBe(204);

      const puzzleResponse = await request(expressApp)
        .get(`/api/puzzle/${puzzleId}`);

      expect(puzzleResponse.status).toBe(404);
    });

    test('it responds with a 401 when there is not authenticated user', done => {
      userHelper.id = undefined;
      request(expressApp)
        .delete(`/api/puzzle/${puzzleId}`)
        .expect(401, done);
    });

    test('it responds with a 404 when the puzzle id may be invalid', done => {
      request(expressApp)
        .delete('/api/puzzle/abcd')
        .expect(404, done);
    });

    test('it responds with a 403 when the authenticated user does not own the puzzle', async () => {
      userHelper.id = "986554";
      const deleteResponse = await request(expressApp)
        .delete(`/api/puzzle/${puzzleId}`);

      expect(deleteResponse.status).toBe(403);

      userHelper.id = originalUser;
      const puzzleResponse = await request(expressApp)
        .get(`/api/puzzle/${puzzleId}`);
      const data = JSON.parse(puzzleResponse.text);

      expect(data).toEqual({
        id: puzzleId,
        name: puzzleName
      });
    });
  });

  describe('updating a puzzle', () => {
    const puzzleName = "my first puzzle";
    let puzzleId;

    beforeEach(async () => {
      puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: puzzleName }))).text;
    });

    test('setting the name is persisted', async () => {
      const newName = "a new name";
      let response = await request(expressApp)
        .put(`/api/puzzle/${puzzleId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: newName}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzle/${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data.name).toBe(newName);
    });

    test('responds with a 403 when no user exists', async () => {
      userHelper.id = undefined;
      let response = await request(expressApp)
        .put(`/api/puzzle/${puzzleId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "newName"}));

      expect(response.status).toBe(403);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzle/${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data.name).toBe(puzzleName);
    });

    test('responds with a 401 when the user does not own the puzzle', async () => {
      userHelper.id = "1231231231232132";
      let response = await request(expressApp)
        .put(`/api/puzzle/${puzzleId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "newName"}));

      expect(response.status).toBe(401);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzle/${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data.name).toBe(puzzleName);
    });

    test('response with a 404 when the puzzle id may not be valid', done => {
      request(expressApp)
        .put(`/api/puzzle/asdfasdf`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "newName"}))
        .expect(404, done);
    });
  });
});
