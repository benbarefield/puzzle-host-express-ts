import express from "express";
import setupServer from "../serverSetup";
import fakeAuth from "../../test/fakeAuth";
import request from "supertest";
import {testingStart} from 'puzzle-host-data-layer';

describe('puzzle answer endpoint', () => {
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

  describe('unsupported endpoints', () => {
    test('should send status 501', (done) => {
      request(expressApp)
        .merge('/api/puzzleAnswer')
        .expect(501, done);
    });

    test('getting a answer with a potentially bad id is not responds with a 404', (done) => {
      request(expressApp)
        .get('/api/puzzleAnswer/asdf')
        .expect(404, done);
    });

    test('getting a answer with a potentially bad puzzle id is not responds with a 404', (done) => {
      request(expressApp)
        .get('/api/puzzleAnswer/?puzzle=asdf')
        .expect(404, done);
    });
  });

  describe("creating a puzzle answer", () => {
    test('responds with a 201 when successful', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const response = await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "5",
          answerIndex: 0,
        }));

      expect(response.status).toEqual(201);
    });

    test('response with 404 when the puzzle does not exist', (done) => {
      request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: "545895436",
          value: "5",
          answerIndex: 0,
        }))
        .expect(404, done);
    });

    test('responds with 401 when the user does not own the puzzle', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      userHelper.id = "234524";
      const response = await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "5",
          answerIndex: 0,
        }));

      expect(response.status).toBe(401);
      // todo: verify nothing is put in db?
    });

    test('responds with 403 when no user is logged in', (done) => {
      userHelper.id = undefined;
      request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: "1235435",
          value: "5",
          answerIndex: 0,
        }))
        .expect(403, done);
    });

    test('responds with 404 for a potentially bad puzzle id', done => {
      request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: "asdb",
          value: "5",
          answerIndex: 0,
        }))
        .expect(404, done);
    });
  });

  describe('getting a puzzle answer', () => {
    test('the answer data is returned', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const value = "5";
      const answerIndex = 0;
      const answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value,
          answerIndex,
        }))).text;

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      expect(response.headers['content-type']).toContain('application/json');
      const data = JSON.parse(response.text);
      expect(response.status).toEqual(200);
      expect(data).toEqual({
        value,
        answerIndex,
        puzzle: puzzleId,
        id: answerId,
      });
    });

    test('responds with 403 when no user is logged in', (done) => {
      userHelper.id = undefined;

      request(expressApp)
        .get(`/api/puzzleAnswer/123412512`)
        .expect(403, done);
    });

    test('response with 401 when the user does not own the puzzle for the answer', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "5",
          answerIndex: 0,
        }))).text;

      userHelper.id = "98765";
      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toBe(401);
    });

    test('404 response when there is no puzzle answer', (done) => {
      request(expressApp)
        .get(`/api/puzzleAnswer/1231541`)
        .expect(404, done);
    });
  });

  describe('getting the all the answers for a puzzle', () => {
    test('should be an empty array when there are no answers', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data).toEqual([]);
    });

    test('all the answers are retrieved', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const answer1 = "5", answer2 = "10";
      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: answer1,
          answerIndex: 0,
        }));

      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: answer2,
          answerIndex: 1,
        }));

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe(answer1)
      expect(data.find(a => a.answerIndex === 1).value).toBe(answer2)
    });

    test('should respond with a 401 if the puzzle is not owned by the user', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      userHelper.id = "98765";
      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      expect(response.status).toBe(401);
    });

    test('should respond with 414 if a puzzle answer id is given with a puzzle id', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "5",
          answerIndex: 0,
        }))).text;

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}?puzzle=${puzzleId}`);

      expect(response.status).toBe(414);
    });
  });

  describe("creating answers when answers already exist", () => {
    test('creating an answer in the middle of existing answers updates ordering properly', async () => {
      const puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      const answer1 = "1", answer2 = "2", answer3 = "3";
      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: answer1,
          answerIndex: 0,
        }));

      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: answer3,
          answerIndex: 1,
        }));

      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: answer2,
          answerIndex: 1,
        }));

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe(answer1);
      expect(data.find(a => a.answerIndex === 1).value).toBe(answer2);
      expect(data.find(a => a.answerIndex === 2).value).toBe(answer3);
    });
  });

  describe('deleting an answer', () => {
    let answerId;
    let puzzleId;
    beforeEach(async () => {
      puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle" }))).text;

      answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "10",
          answerIndex: 0,
        }))).text;
    });

    test('it is no longer retrieved', async () => {
      let response = await request(expressApp)
        .delete(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toEqual(404);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      expect(response.text).toEqual("[]");
    });

    test("it should 403 if there is no user", async () => {
      userHelper.id = undefined;
      let response = await request(expressApp)
        .delete(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toBe(403);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toEqual(200);
    })

    test('it should 401 if the answer is not from a puzzle owned by the user', async () => {
      userHelper.id = "123123";
      let response = await request(expressApp)
        .delete(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toBe(401);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      expect(response.status).toEqual(200);
    });

    test('responds with a 404 when the answer id is potentially not valid', (done) => {
      request(expressApp)
        .delete(`/api/puzzleAnswer/abcd`)
        .expect(404, done);
    });

    test('it should update the answer indexes', async () => {
      answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "11",
          answerIndex: 1,
        }))).text;

      (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "12",
          answerIndex: 2,
        }))).text;

      await request(expressApp)
        .delete(`/api/puzzleAnswer/${answerId}`);

      const response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);

      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toEqual("10");
      expect(data.find(a => a.answerIndex === 1).value).toEqual("12");
    });
  });

  describe('changing an answer', () => {
    let answerId;
    let puzzleId;
    beforeEach(async () => {
      puzzleId = (await request(expressApp)
        .post("/api/puzzle")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({name: "my first puzzle"}))).text;

      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "0",
          answerIndex: 0,
        }));

      answerId = (await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "10",
          answerIndex: 1,
        }))).text;

      await request(expressApp)
        .post('/api/puzzleAnswer')
        .set("Content-Type", "application/json")
        .send(JSON.stringify({
          puzzle: puzzleId,
          value: "100",
          answerIndex: 2,
        }));
    });

    test('an updated value can be retrieved', async () => {
      const newValue = "a different value";
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({value: newValue}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      const data = JSON.parse(response.text);
      expect(data.value).toBe(newValue);
      expect(data.answerIndex).toBe(1);
    });

    test('no user results in a 403', async () => {
      userHelper.id = undefined;
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({value: "a different value"}));

      expect(response.status).toBe(403);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      const data = JSON.parse(response.text);
      expect(data.value).toBe("10");
    });

    test('a user that does not own the associated puzzle gets a 401', async () => {
      userHelper.id = "359349586";
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({value: "a different value"}));

      expect(response.status).toBe(401);

      userHelper.id = originalUser;
      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      const data = JSON.parse(response.text);
      expect(data.value).toBe("10");
    });

    test('potentially invalid answer id responds with a 404', done => {
      request(expressApp)
        .put(`/api/puzzleAnswer/abcdedf`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({value: "a different value"}))
        .expect(404, done);
    });

    test("updating the answer index to be bigger results in reducing later answer indexes", async () => {
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({answerIndex: 2}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);
      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe("0");
      expect(data.find(a => a.answerIndex === 1).value).toBe("100");
      expect(data.find(a => a.answerIndex === 2).value).toBe("10");
    });

    test("updating the answer index to be smaller results in increasing earlier answer indexes", async () => {
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({answerIndex: 0}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);
      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe("10");
      expect(data.find(a => a.answerIndex === 1).value).toBe("0");
      expect(data.find(a => a.answerIndex === 2).value).toBe("100");
    });

    test('updating the answer index to be the same does not change any indexes', async () => {
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({answerIndex: 1}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);
      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe("0");
      expect(data.find(a => a.answerIndex === 1).value).toBe("10");
      expect(data.find(a => a.answerIndex === 2).value).toBe("100");
    });

    test("updating both the answer index and value is persisted properly", async () => {
      const newValue = "hello world";
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({answerIndex: 2, value: newValue}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/?puzzle=${puzzleId}`);
      const data = JSON.parse(response.text);
      expect(data.find(a => a.answerIndex === 0).value).toBe("0");
      expect(data.find(a => a.answerIndex === 1).value).toBe("100");
      expect(data.find(a => a.answerIndex === 2).value).toBe(newValue);
    });

    test("using same answer index still allows value to change", async () => {
      const newValue = "a different value";
      let response = await request(expressApp)
        .put(`/api/puzzleAnswer/${answerId}`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({value: newValue, answerIndex: 1}));

      expect(response.status).toBe(204);

      response = await request(expressApp)
        .get(`/api/puzzleAnswer/${answerId}`);

      const data = JSON.parse(response.text);
      expect(data.value).toBe(newValue);
      expect(data.answerIndex).toBe(1);
    });
  });
});
