import * as QUnit from "qunitjs"
import { fromFn, map as mapS } from "../src/partial_synchronous_streams"
import { STATES } from "../src/properties"
import { ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION } from "../src/fromFnAutomaton"
import { NO_OUTPUT } from "../src/synchronous_fsm"

const { NEW, SAME, ERROR, DONE } = STATES;

function makeEventuallyThrowingFn(init, error) {
  return function eventuallyThrowingFn() {
    const values = [0, 1, 1, 2, null, 3, 3, 0];
    const currentValue = values[init++];

    if (currentValue == null) throw error
    else return currentValue
  }
}

function makeEventuallyDoneFn(init, done) {
  return function eventuallyThrowingFn() {
    const values = [0, 1, 1, 2, done, 3, 3, 0];
    const currentValue = values[init++];

    return currentValue
  }
}

function mappingFn(x) {return { mapped: x }}

QUnit.module("Testing map(pss, fn)", {});

// Given a pss fromFn x y y z err z z x
// Given mapping function fn : x => {mapped : x}
// Given map(pss, fn)
// When pulled,
// Then the iterator returns
//   - {controlState : NEW, output : mx}
//   - {controlState : NEW, output : my}
//   - {controlState : SAME, output : my}
//   - {controlState : NEW, output : mz}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("map, with fromFn = x y y z err z z x", function exec_test(assert) {
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;
  const fn = makeEventuallyThrowingFn(0, ERROR_MESSAGE);
  // No done settings
  const iterator = fromFn(fn);

  const mappedIterator = mapS(iterator, mappingFn);

  const sequence = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, _) => {
    mappedIterator.pull();
    acc.push(mappedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": { "mapped": 0 } },
    { "controlState": NEW, "output": { "mapped": 1 } },
    { "controlState": SAME, "output": { "mapped": 1 } },
    { "controlState": NEW, "output": { "mapped": 2 } },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    }
  ], `Map operator correctly map values from source iterator`);
});

// Given a pss fromFn x y y z done z z x
// Given mapping function fn : x => {mapped : x}
// Given map(pss, fn)
// When pulled,
// Then the iterator returns
//   - {controlState : NEW, output : mx}
//   - {controlState : NEW, output : my}
//   - {controlState : SAME, output : my}
//   - {controlState : NEW, output : mz}
//   - {controlState : DONE, output : no_output}
//   - {controlState : DONE, output : no_output}
//   - {controlState : DONE, output : no_output}
//   - {controlState : DONE, output : no_output}
QUnit.test("map, with fromFn = x y y z done z z x", function exec_test(assert) {
  const fn = makeEventuallyDoneFn(0, DONE);
  const iterator = fromFn(fn, { done: DONE });
  const mappedIterator = mapS(iterator, mappingFn);

  const sequence = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, _) => {
    mappedIterator.pull();
    acc.push(mappedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": { "mapped": 0 } },
    { "controlState": NEW, "output": { "mapped": 1 } },
    { "controlState": SAME, "output": { "mapped": 1 } },
    { "controlState": NEW, "output": { "mapped": 2 } },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT }
  ], `Map operator correctly map values from source iterator`);
});
