import * as QUnit from "qunitjs"
import { fromFn } from "../src/partial_synchronous_streams"
import { ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION } from "../src/fromFnAutomaton"
import { STATES } from "../src/properties"

const { NEW, SAME, ERROR, DONE } = STATES;

function makeCounterFn(init) {
  return function counterFn() {
    return init++
  }
}

function makeStammeringCounterFn(init) {
  return function counterFn() {
    return Math.floor(init++ / 2);
  }
}

function makeThrowingFn(error) {
  return function throwingFn() {
    throw error
  }
}

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


QUnit.module("Testing fromFn(fn)", {});

// Given a function fn which always emits a new value every time called
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns {controlState : NEW, output : the function output}
QUnit.test("From fn = x y z ...", function exec_test(assert) {
  const fn = makeCounterFn(1);
  // No done settings
  const iterator = fromFn(fn);

  const sequence = [1, 2, 3].reduce((acc, _) => {
    iterator.pull();
    acc.push(iterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": "new", "output": 1 },
    { "controlState": "new", "output": 2 },
    { "controlState": "new", "output": 3 }
  ], `Iterator correctly generates value from generating function`);
});


// Given a function fn which always emits x x y y z z ...
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : NEW, output : x}
//   - {controlState : SAME, output : x}
//   - {controlState : NEW, output : y}
//   - {controlState : SAME, output : y}
// ...
QUnit.test("From fn = x x y y z z ...", function exec_test(assert) {
  const fn = makeStammeringCounterFn(0);
  // No done settings
  const iterator = fromFn(fn);

  const sequence = [1, 2, 3, 4, 5, 6].reduce((acc, _) => {
    iterator.pull();
    acc.push(iterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": "new", "output": 0 },
    { "controlState": "same", "output": 0 },
    { "controlState": "new", "output": 1 },
    { "controlState": "same", "output": 1 },
    { "controlState": "new", "output": 2 },
    { "controlState": "same", "output": 2 },
  ], `Iterator correctly generates value from generating function`);
});

// Given a function fn which emits error (throws exception)
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : ERROR, output : NO_OUTPUT}
//   - {controlState : ERROR, output : NO_OUTPUT}
//   - {controlState : ERROR, output : NO_OUTPUT}
// ...
QUnit.test("From fn = err ..", function exec_test(assert) {
  const ERROR = `Some error occurred while executing the function!`;
  const fn = makeThrowingFn(ERROR);
  // No done settings
  const iterator = fromFn(fn);

  const sequence = [1, 2, 3].reduce((acc, _) => {
    iterator.pull();
    acc.push(iterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    {
      "controlState": "error",
      "output": `firstPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR}`
    },
    {
      "controlState": "error",
      "output": `firstPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR}`
    },
    {
      "controlState": "error",
      "output": `firstPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR}`
    }
  ], `Iterator correctly generates value from generating function`);
});


// Given a function fn which emits x y y z err z z x
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : NEW, output : x}
//   - {controlState : NEW, output : y}
//   - {controlState : SAME, output : y}
//   - {controlState : NEW, output : z}
//   - {controlState : ERROR, output : NO_OUTPUT}
//   - {controlState : ERROR, output : NO_OUTPUT}
// ...
QUnit.test("From fn = x y y z err z z x", function exec_test(assert) {
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;
  const fn = makeEventuallyThrowingFn(0, ERROR_MESSAGE);
  // No done settings
  const iterator = fromFn(fn);

  const sequence = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, _) => {
    iterator.pull();
    acc.push(iterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": 0 },
    { "controlState": NEW, "output": 1 },
    { "controlState": SAME, "output": 1 },
    { "controlState": NEW, "output": 2 },
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
  ], `Iterator correctly generates value from generating function`);
});

// Given a function fn which emits x y y z done z z x
// Given fromFn(fn, {done:'done'}) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : NEW, output : x}
//   - {controlState : NEW, output : y}
//   - {controlState : SAME, output : y}
//   - {controlState : NEW, output : z}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
// ...
QUnit.test("From fn = x y y z done z z x", function exec_test(assert) {
  const fn = makeEventuallyDoneFn(0, DONE);
  const iterator = fromFn(fn, { done: DONE });

  const sequence = [1, 2, 3, 4, 5, 6, 7, 8].reduce((acc, _) => {
    iterator.pull();
    acc.push(iterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": 0 },
    { "controlState": NEW, "output": 1 },
    { "controlState": SAME, "output": 1 },
    { "controlState": NEW, "output": 2 },
    { "controlState": DONE, "output": null },
    { "controlState": DONE, "output": null },
    { "controlState": DONE, "output": null },
    { "controlState": DONE, "output": null }
  ], `Iterator correctly generates value from generating function`);
});
