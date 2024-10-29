import request from 'supertest';
import express from "express";
import setupServer from "../serverSetup";
import fakeAuth from "../../test/fakeAuth";
import {testingStart} from 'puzzle-host-data-layer';

describe("user puzzles endpoint", () => {
  jest.setTimeout(20000);

  let dataAccess, teardown, expressApp;
  const user1 = "76541258";
  const userHelper = {id: user1};

  beforeEach(async () => {
    userHelper.id = user1;

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
        .merge('/api/userPuzzles')
        .expect(501, done);
    });

    test('should send a 403 when there is no user', (done) => {
      userHelper.id = undefined;
      request(expressApp)
        .get("/api/userPuzzles")
        .expect(403, done)
    });
  });

  describe("after creating puzzles", () => {
    test("they can be retrieved for the logged in user", async () => {
      const puzzle1 = "my first puzzle";
      const puzzle2 = "another puzzle";

      const puzzle1Id = (await request(expressApp)
        .post("/api/puzzle")
        .send(`name=${puzzle1.replace(' ', '+')}`)).text;

      const puzzle2Id = (await request(expressApp)
        .post("/api/puzzle")
        .send(`name=${puzzle2.replace(' ', '+')}`)).text;

      const getResponse = await request(expressApp)
        .get(`/api/userPuzzles`);

      expect(getResponse.headers['content-type']).toContain("application/json");

      const data = JSON.parse(getResponse.text);
      expect(data).toEqual([
        {name: puzzle1, id: puzzle1Id},
        {name: puzzle2, id: puzzle2Id},
      ]);
    });

    test('puzzles from other users are not retrieved', async () => {
      const puzzle1 = "my first puzzle";
      const puzzle2 = "another puzzle";

      await request(expressApp)
        .post("/api/puzzle")
        .send(`name=${puzzle1.replace(' ', '+')}`);

      userHelper.id = "52562345235";
      await request(expressApp)
        .post("/api/puzzle")
        .send(`name=${puzzle2.replace(' ', '+')}`);

      userHelper.id = user1;
      const getResponse = await request(expressApp)
        .get(`/api/userPuzzles`);

      const data = JSON.parse(getResponse.text);

      expect(data.length).toEqual(1);
      expect(data[0].name).toEqual(puzzle1);
    });
  });
});
