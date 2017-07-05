import * as QUnit from "qunitjs"
import { ERROR_FROM_GENERATING_BEHAVIOR, fromBehavior } from "../src/partial_synchronous_streams"
import * as Rx from "rx"
import { NO_OUTPUT } from "../src/synchronous_fsm"
import { STATES } from "../src/properties"

const PULL = 'pull';
const END = 'end';
const ERR = 'some error'
const { NEW, SAME, DONE, ERROR } = STATES;

QUnit.module("Testing fromBehavior(behavior, settings)", {});

// Given a behaviour B = a$-b-b-c---d-d-e-f-g! ...
// Given fromBehaviour(B) an iterator constructed from generating function fn (no settings)
// Given we pull like     -x-x---xx--x-x-x
// When pulled,
// Then the iterator returns
//   - {controlState : NEW, output : a}
//   - {controlState : NEW, output : b}
//   - {controlState : NEW, output : c}
//   - {controlState : SAME, output : c}
//   - {controlState : NEW, output : d}
//   - {controlState : NEW, output : d}
//   - {controlState : NEW, output : e}
QUnit.test("From behaviour = a$-b-b-c---d-d-e-f-g! ", function exec_test(assert) {
  const done = assert.async(1);
  const intervalT = 20; // ms
  const initValue = 0;
  const behaviorS = new Rx.BehaviorSubject(initValue);
  const values = [PULL, 1, PULL, 1, null, 2, PULL, PULL, null, 3, PULL, 3, PULL, 4, PULL, 5, 6, DONE, END];
  const iterator = fromBehavior(behaviorS);
  let result = [];

  const intervalID = setInterval(function simulate() {
    const action = values.shift();

    switch (action) {
      case null :
        break;
      case PULL :
        iterator.pull();
        result.push(iterator.get());
        break;
      case 1 :
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        behaviorS.onNext(action);
        break;
      case DONE :
        behaviorS.onCompleted();
        break;
      case END :
        iterator.pull();
        result.push(iterator.get());
        clearInterval(intervalID);
        assert.deepEqual(result, [
          { "controlState": NEW, "output": 0 },
          { "controlState": NEW, "output": 1 },
          { "controlState": NEW, "output": 2 },
          { "controlState": SAME, "output": 2 },
          { "controlState": NEW, "output": 3 },
          { "controlState": NEW, "output": 3 },
          { "controlState": NEW, "output": 4 },
          { "controlState": DONE, "output": NO_OUTPUT },
        ], `
        When a batch of pull happens, the first pull outputs a value with NEW control state, subsequent pull outputs the same value with SAME control state.\n
           When a batch of behaviour message emission happens, no value is pulled. When a pull then happens, the current behaviour value is output with NEW control state.\n
            Once the behaviour has completed, any pull will return DONE control state and no value (i.e. the configured zero value, by default nul)
            Once the behaviour has errored, any pull will return ERROR control state and no value (i.e. the configured zero value, by default nul)             
        `);
        done();
        break;
      default:
        throw 'should not get there'
    }
  }, intervalT);
});

// Given a behaviour B = a$-b-b-c---d-d-e-f-g!
// Given fromBehaviour(B) an iterator constructed from generating function fn (no settings)
// Given we pull like     -x-x---xx--x-x-x
// When pulled,
// Then the iterator returns
//   - {controlState : NEW, output : a}
//   - {controlState : NEW, output : b}
//   - {controlState : NEW, output : c}
//   - {controlState : SAME, output : c}
//   - {controlState : NEW, output : d}
//   - {controlState : NEW, output : d}
//   - {controlState : NEW, output : e}
QUnit.test("From behaviour = a$-b-b-c---d-d-e-f-g-err ", function exec_test(assert) {
  const done = assert.async(1);
  const intervalT = 20; // ms
  const initValue = 0;
  const behaviorS = new Rx.BehaviorSubject(initValue);
  const values = [PULL, 1, PULL, 1, null, 2, PULL, PULL, null, 3, PULL, 3, PULL, 4, PULL, 5, 6, ERR, END];
  const iterator = fromBehavior(behaviorS);
  let result = [];

  const intervalID = setInterval(function simulate() {
    const action = values.shift();

    switch (action) {
      case null :
        break;
      case ERR :
        behaviorS.onError(action);
        break;
      case PULL :
        iterator.pull();
        result.push(iterator.get());
        break;
      case 1 :
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        behaviorS.onNext(action);
        break;
      case DONE :
        behaviorS.onCompleted();
        break;
      case END :
        iterator.pull();
        result.push(iterator.get());
        clearInterval(intervalID);
        assert.deepEqual(result, [
          { "controlState": NEW, "output": 0 },
          { "controlState": NEW, "output": 1 },
          { "controlState": NEW, "output": 2 },
          { "controlState": SAME, "output": 2 },
          { "controlState": NEW, "output": 3 },
          { "controlState": NEW, "output": 3 },
          { "controlState": NEW, "output": 4 },
          {
            "controlState": ERROR,
            "output": `fromBehavior > ${ERROR_FROM_GENERATING_BEHAVIOR} : ${ERR}`
          },
        ], `
        When a batch of pull happens, the first pull outputs a value with NEW control state, subsequent pull outputs the same value with SAME control state.\n
           When a batch of behaviour message emission happens, no value is pulled. When a pull then happens, the current behaviour value is output with NEW control state.\n
            Once the behaviour has completed, any pull will return DONE control state and no value (i.e. the configured zero value, by default nul)
            Once the behaviour has errored, any pull will return ERROR control state and no value (i.e. the configured zero value, by default nul)             
        `);
        done();
        break;
      default:
        throw 'should not get there'
    }
  }, intervalT);
});

// NOTE : Should do test to check that pull after err continues to return err, and pull after
// done contines to return done, but won't.
