/*
 height  width
 |       |
 ---------
 |
 [Mobile, Tablet, Desktop] = screenType


 input keypress --> userName

 f
 (screenType, userName) -> DisplayedDOM


 We want to compute DisplayedDOM so that :
 1 not more frequently than rAF
 2 reusing as much as possible previous computations

 1. Every rAF
 - compute displayedDOM which is a combine of screenType and userName, which are signals
 - pull screenType
 - screenType is combine (height, width), which are signals, i.e. can be computed/evaluated at call time, i.e. not reactive
 - height is pulled, width is pulled
 - automaton for height and width. INIT ->pull NEW ->pull.new?  NEW
 ->pull.same? SAME->pull.new?  -> NEW
 ->pull.same? -> SAME
 - combine returns signals with automaton so that
 - if both height, width are SAME, then dont recompute combine, use the cached value (stored in the automaton), pass on {SAME, cached value}
 - if one is different, recompute combine, compare with cached value, if same -> SAME, different, update the cache, -> {NEW, cached value}
 - pull userName
 - userName is reactive behaviour, which reacts to each keypress
 - userName is wrapped into a Signal which returns the userName current value anytime asked
 - however in addition to the current value, the signal keeps hold of whether the userName was updated, after being pulled
 - So automaton : state INIT ->new NEW ->pull SAME ->new NEW
 (no pull in INIT)        ->pull SAME


 This means signals can be observed with next() which returns {controlState, value}
 One can then extend the set of control states to include error, termination, and noValue.
 noValue can be useful to simulate synchronous streams and allows for convenient implementation of filters (which would otherwise potentially consume the upstream iterator as pull is a synchronous operation)
 The semantics of noValue would be that if it comes out, there it is propagated downStream all the way (it is an absorbing zero basically)

 Then SyncDataflow is the type in relation to synchronous dataflow modelling use in digital signal processing (cf. http://slideplayer.com/slide/6988373/).
 or call it partial sync stream?

 Interface SyncDataflow
 - constructor
 - from function :: () -> IO *, or any other monad for that matter, just to say it is effectful potentially
 - pull
 - fires a pull event to the inner automaton specifying behavior. Updates its state (computed value, and cache) with the result
 - get
 - returns the last computed value (? or the full inner state of the automaton?)

 Interface SyncDataflowOperator
 :: SyncDataFlow -> SyncDataFlow

 Example from function
 - new SyncDataFlow.fromFunction(() => window.height)

 */

import {
  AUTO_EVENT, create_state_machine, INIT_EVENT, INITIAL_STATE_NAME, NO_OUTPUT
} from "./synchronous_fsm"
import { tryCatch } from "ramda"
import { toJsonPatch } from "./utils"

const ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION = `Encountered an error while executing generating function.`;
const STATES = {
  INIT: 'init',
  NEW: 'new',
  SAME: 'same',
  ERROR: 'error',
  DONE: 'done',
  TEMP: 'temp'
};

const { INIT, NEW, SAME, ERROR, DONE, TEMP } = STATES;

const PULL_EVENT = 'pull';
const NEW_EVENT = 'new';
const ERROR_EVENT = 'error';
const DONE_EVENT = 'done';
const pullMessage = { [PULL_EVENT]: null };

function makePullMessage() {
  return pullMessage
}

function makeNewMessage(data) {
  return { [NEW_EVENT]: data }
}

function makeErrMessage(data) {
  return { [ERROR_EVENT]: data }
}

function makeDoneMessage(data) {
  return { [DONE_EVENT]: data }
}

const initialValue = {
  controlState: INIT,
  cache: null,
  value: null,
  error : null
};

const syncDataflowCreateFromFnAutomaton = {
  control_states: { [INIT]: '', [NEW]: '', [SAME]: '', [ERROR]: '', [DONE]: '', [TEMP]: '' },
  events: [PULL_EVENT, NEW_EVENT, ERROR_EVENT, DONE_EVENT],
  transitions: [
    // initial transition on start
    { from: INITIAL_STATE_NAME, to: INIT, event: INIT_EVENT, action : init },
    //
    { from: INIT, to: TEMP, event: PULL_EVENT, action: firstPullFromFn },
    {
      from: TEMP, event: AUTO_EVENT, conditions: [
      { condition: isErrorValue, to: ERROR, action: updateModelWithError },
      { condition: isDoneValue, to: DONE, action: updateModelWithDone },
      { condition: isNewValue, to: NEW, action: updateModelWithNew },
      { condition: isSameValue, to: SAME, action: updateModelWithSame },
    ],
    },
    { from: ERROR, to: ERROR, event: PULL_EVENT, action: repeatError },
    { from: DONE, to: DONE, event: PULL_EVENT, action: repeatDone },
    { from: NEW, to: TEMP, event: PULL_EVENT, action: subsequentPullFromFn },
    { from: SAME, to: TEMP, event: PULL_EVENT, action: subsequentPullFromFn },
  ],
  model_initial: initialValue
};


// TODO : subsequentPullFromFn and firstPullFromFn could be the same function given the initial
// value of the model, but more clear like that

function repeatDone(model, eventData, settings) {
  return {
    // no update for cache, in case we want to access the last generated value
    // no update for error/value, it is already there, and we haven't re-executed the function
    // no update for controlState, controlState is already equal to DONE
    model_update: [],
    output: {
      controlState: DONE,
      // We repeatedly output the empty output for any pulls occuring after the first done
      output: NO_OUTPUT
    }
  }
}

function repeatError(model, eventData, settings) {
  return {
    // no update for cache, in case we want to access the latest generated valid value
    // no update for error, it is already there, and we haven't re-executed the function
    // no update for controlState, controlState is already equal to ERROR
    // no update for value, it is already equal to null
    model_update: [],
    output: {
      controlState: ERROR,
      // We repeatedly output the error for any pulls occuring after the first error
      output: model.error
    }
  }
}

function updateModelWithSame(model, eventData, settings) {
  return {
    model_update: toJsonPatch('/')({
      controlState: NEW,
      cache: model.value,
      // no update for value, it was already updated in TEMP
      error: null
    }),
    output: {
      controlState: SAME,
      output: model.value
    }
  }
}

function updateModelWithNew(model, eventData, settings) {
  return {
    model_update: toJsonPatch('/')({
      controlState: NEW,
      cache: model.value,
      // no update for value, it was already updated in TEMP
      error: null
    }),
    output: {
      controlState: NEW,
      output: model.value
    }
  }
}

function updateModelWithDone(model, eventData, settings) {
  return {
    model_update: toJsonPatch('/')({
      controlState: DONE,
      cache: null,
      // keep error and value the same in case we still want to access them after completion
    }),
    output: {
      controlState: DONE,
      output: NO_OUTPUT
    }
  }
}

function updateModelWithError(model, eventData, settings) {
  return {
    model_update: toJsonPatch('/')({
      // No updates to value and error,there already have the right value from TEMP
      // No update to the cache either
      controlState: ERROR
    }),
    output: {
      controlState: ERROR,
      output: model.error
    }
  }
}

function isNewValue(model, eventData, settings) {
  // use ramda `equals` if a comparison function is not provided in settings
  const equalsFn = settings.equals || equals;

  return !equalsFn(model.value, model.cache)
}

function isSameValue(model, eventData, settings) {
  const equalsFn = settings.equals || equals;

  return !!equalsFn(model.value, model.cache)
}

function isDoneValue(model, eventData, settings) {
  // NOTE : comparison is made by reference - this is to reduce the chances of accidentally
  // having a
  if ('done' in settings) return model.value == settings.done
  return false
}

function isErrorValue(model, eventData, settings) {
  return !!model.error
}

function init (model, eventData, settings) {
  return {
    // no model update on init
    model_update: [],
    // but we do want to output something for the initial state
    output: {
      controlState : INIT,
      output : NO_OUTPUT
    }
  }
}

function subsequentPullFromFn(model, eventData, settings) {
  const fn = settings.fn;
  // NOTE : null should be used anytimes there is a need to signal a zero value. undefined
  // should not be used for such purposes as json parsing automatically removes undefined
  // properties, hence json patches operation to update a field to undefined would fail.
  const value = tryCatch(
    () => ({ value: fn(), error: null }),
    () => ({
      value: NO_OUTPUT,
      error: 'subsequentPullFromFn > ' + ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION })
  )();

  return {
    model_update: toJsonPatch('/')({
      controlState: TEMP,
      cache: model.value,
      ...value
    }),
    output: NO_OUTPUT
  }
}

function firstPullFromFn(model, eventData, settings) {
  const fn = settings.fn;
  const value = tryCatch(
    () => ({ value: fn(), error: null }),
    () => ({
      value: NO_OUTPUT,
      error: 'firstPullFromFn > ' + ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION })
  )();

  return {
    model_update: toJsonPatch('/')({
      controlState: TEMP,
      cache: null,
      value: value,
      error: null
    }),
    output: NO_OUTPUT
  }
}

export function fromFn(fn) {
  const pullMessage = PULL_EVENT;
  const automaton = create_state_machine(syncDataflowCreateFromFnAutomaton, { fn });
  let _value = automaton.start();

  return {
    get: function () {
      return {
        controlState: _value.controlState,
        output: _value.output
      }
    },
    pull: function () {
      _value = automaton.yield(pullMessage)
    }
  }
}

function map(sdf, fn) {
  let cachedValue = null

  return {
    get: function () {
      return cachedValue
    },
    pull: function () {
      sdf.pull()
      const { controlState, output } = sdf.get()

      // TODO : add case where output == NO_OUTPUT!! must be mapped to NO_OUTPUT
      // TODO : map should return also {controlState, output} !! so no good here (imagine two maps)
      switch (controlState) {
        case INIT : // TODO : should not have a INIT state, I pulled - so put it in contracts, and return
          // error here
          cachedValue = value;
          break;
        case NEW :
          cachedValue = fn(value)
          break;
        case SAME :
          cachedValue = value
          break;
        case ERROR :
          cachedValue = value
          break;
        case DONE :
          cachedValue = value
          break;
      }
    }
  }
}

// NOTE: this is the same code for all fromXXX, just the automaton changing
function fromBehavior(behavior) {
  // TODO
  let _value;
  const automata = createSyncFSM(syncDataflowCreateFromBehaviorAutomaton)

  behavior.subscribe(
    (x) => _value = automata.yield(makeNewMessage(x)),
    (err) => _value = automata.yield(makeErrMessage(err)),
    () => _value = automata.yield(makeDoneMessage()),
  );

  return {
    get: function () {
      return { controlState, value } = _value
    },
    pull: function () {
      _value = automata.yield(pullMessage)
    }
  }
}

// TODO : put NO_OUTPUT in settings, put DONE_OUTPUT in settings as well and in synchronous fsm
// as well
