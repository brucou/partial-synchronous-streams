import * as QUnit from "qunitjs"
import { combine, fromFn } from "../src/partial_synchronous_streams"
import { STATES } from "../src/properties"
import { ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION } from "../src/fromFnAutomaton"
import { NO_OUTPUT } from "../src/synchronous_fsm"

const { NEW, SAME, ERROR, DONE } = STATES;

function makeIteratorFromArray(arrayOfCommands, settings) {
  let index = 0;

  return function getIteratedValue() {
    const command = arrayOfCommands[index++];

    if (command === settings.error) {
      throw settings.message
    }
    else if (command === settings.done) {
      return command
    }
    else {
      return command
    }
  }
}

QUnit.module("Testing combine(combiningFn, arrayOfIterators)", {});

// Tests must cover [NEW, SAME, DONE, ERROR] x [NEW, SAME, DONE, ERROR] w/
// NEW x SAME = SAME x NEW = NEW
// SAME x SAME = SAME
// DONE x ERROR = ERROR x DONE= ERROR
// DONE x _ = DONE
// ERROR x _ = ERROR
// and of course output computed according to the combining function

// 1. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x ERROR = ERROR
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, DONE, 4]
// with fn2 = [A, A, B, C, C, ERROR, D]
// Given combiningFn = fn2.output + fn1.output
// Given combine(combiningFn, arrayOfIterators)
// When pulled,
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x ERROR = ERROR", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, DONE, 4], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, ERROR, D], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
  ], `Map operator correctly map values from source iterator`);
});

// 2. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x DONE= ERROR
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, ERROR, 4]
// with fn2 = [A, A, B, C, C, DONE, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x DONE= ERROR", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([A, A, B, C, C, ERROR, D], {
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([0, 1, 1, 2, 2, DONE, 4], { done: DONE });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + x + y}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
  ], `Map operator correctly map values from source iterator`);
});

// 3. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x SAME = DONE
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, DONE, 4]
// with fn2 = [A, A, B, C, C, C, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x SAME = DONE", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, DONE, 4], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, C, D], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT },
  ], `Map operator correctly map values from source iterator`);
});

// 4. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x NEW= DONE
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, DONE, 4]
// with fn2 = [A, A, B, C, C, D, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x NEW = DONE", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, DONE, 4], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, D, D], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT },
  ], `Map operator correctly map values from source iterator`);
});

// 5. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x DONE = DONE
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, DONE, 4]
// with fn2 = [A, A, B, C, C, DONE, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : DONE, output : NO_OUTPUT}
//   - {controlState : DONE, output : NO_OUTPUT}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, DONE x DONE = DONE", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, DONE, 4], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, DONE, D], {
    done: DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    { "controlState": DONE, "output": NO_OUTPUT },
    { "controlState": DONE, "output": NO_OUTPUT },
  ], `Map operator correctly map values from source iterator`);
});

// 6. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x SAME = ERROR
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, ERROR, 4]
// with fn2 = [A, A, B, C, C, C, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x SAME= ERROR", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, ERROR, 4], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, C, D], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
  ], `Map operator correctly map values from source iterator`);
});

// 7. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x NEW = ERROR
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, ERROR, 4]
// with fn2 = [A, A, B, C, C, D, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x NEW= ERROR", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, ERROR, 4], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, D, D], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
  ], `Map operator correctly map values from source iterator`);
});

// 8. NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x ERROR = ERROR
// Given arrayOfIterators = [fn1, fn2]
// with fn1 = [0, 1, 1, 2, 2, ERROR, 4]
// with fn2 = [A, A, B, C, C, ERROR, D]
// Then the iterator returns
//   - {controlState : NEW, output : A0}
//   - {controlState : NEW, output : A1}
//   - {controlState : NEW, output : B1}
//   - {controlState : NEW, output : C2}
//   - {controlState : SAME, output : C2}
//   - {controlState : ERROR, output : some error}
//   - {controlState : ERROR, output : some error}
QUnit.test("combine, NEW x SAME = SAME x NEW = NEW, SAME x SAME = SAME, ERROR x ERROR= ERROR", function exec_test(assert) {
  const A = 'A', B = 'B', C = 'C', D = 'D';
  const ERROR_MESSAGE = `Some error occurred while executing the function!`;

  const fn1 = makeIteratorFromArray([0, 1, 1, 2, 2, ERROR, 4], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator1 = fromFn(fn1, { done: DONE });

  const fn2 = makeIteratorFromArray([A, A, B, C, C, ERROR, D], {
    done:DONE,
    error: ERROR,
    message: ERROR_MESSAGE
  });
  const iterator2 = fromFn(fn2);

  function combiningFn(x, y) {return "" + y + x}

  const combinedIterator = combine(combiningFn, [iterator1, iterator2]);

  const sequence = [1, 2, 3, 4, 5, 6, 7].reduce((acc, _) => {
    combinedIterator.pull();
    acc.push(combinedIterator.get());

    return acc
  }, []);

  assert.deepEqual(sequence, [
    { "controlState": NEW, "output": "A0" },
    { "controlState": NEW, "output": "A1" },
    { "controlState": NEW, "output": "B1" },
    { "controlState": NEW, "output": "C2" },
    { "controlState": SAME, "output": "C2" },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}\nsubsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
    {
      "controlState": ERROR,
      "output": `subsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}\nsubsequentPullFromFn > ${ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION} : ${ERROR_MESSAGE}`
    },
  ], `Map operator correctly map values from source iterator - error messages are accumulated`);
});

