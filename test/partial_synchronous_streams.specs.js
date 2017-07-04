import * as QUnit from "qunitjs"
import { clone, F, merge, T } from "ramda"
import {fromFn} from "../src/partial_synchronous_streams"

function spy_on_args(fn, spy_fn) {
  return function spied_on(...args) {
    spy_fn(...args);

    return fn(...args);
  }
}

const default_settings = {
  event_emitter_factory: function () {return new Rx.Subject()}
};

QUnit.module("Testing fromFn(fn)", {});

// Given a function fn which always emits a new value every time called
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns {controlState : NEW, output : the function output}

// Given a function fn which always emits x x y y z z ...
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : NEW, output : x}
//   - {controlState : SAME, output : x}
//   - {controlState : NEW, output : y}
//   - {controlState : SAME, output : y}
// ...

// Given a function fn which emits error (throws exception)
// Given fromFn(fn) an iterator constructed from generating function fn
// When(ever) called,
// Then the iterator returns
//   - {controlState : ERROR, output : NO_OUTPUT}
//   - {controlState : ERROR, output : NO_OUTPUT}
//   - {controlState : ERROR, output : NO_OUTPUT}
// ...

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
