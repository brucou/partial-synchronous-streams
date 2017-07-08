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

import { create_state_machine, NO_OUTPUT } from "./synchronous_fsm"
import { syncDataflowCreateFromFnAutomaton } from "./fromFnAutomaton"
import { syncDataflowCreateFromBehaviorAutomaton } from "./fromBehaviorAutomaton"
import { DONE_EVENT, ERROR_EVENT, NEW_EVENT, PULL_EVENT, STATES } from "./properties"
import { equals } from "ramda"

const { INIT, NEW, SAME, ERROR, DONE, TEMP } = STATES;

export const ERROR_FROM_GENERATING_BEHAVIOR = `Error occured while observing on behaviour stream! `;

function pull(iterator) {
  iterator.pull();

  return iterator.get()
}

function makePullMessage() {
  return { [PULL_EVENT]: null }
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

export function fromFn(fn, settings) {
  const automaton = create_state_machine(syncDataflowCreateFromFnAutomaton, { fn, ...settings });
  let _value = automaton.start();

  return {
    get: function fromFnGet() {
      return {
        controlState: _value.controlState,
        output: _value.output
      }
    },
    pull: function fromFnPull() {
      _value = automaton.yield(makePullMessage())
    }
  }
}

export function fromBehavior(behavior, settings) {
  const automaton = create_state_machine(syncDataflowCreateFromBehaviorAutomaton, { ...settings });
  let _value = automaton.start();

  behavior.subscribe(
    (x) => _value = automaton.yield(makeNewMessage(x)),
    (err) => _value = automaton.yield(makeErrMessage('fromBehavior > ' + ERROR_FROM_GENERATING_BEHAVIOR + ' : ' + err)),
    () => _value = automaton.yield(makeDoneMessage()),
  );

  return {
    get: function fromBehaviorGet() {
      return {
        controlState: _value.controlState,
        output: _value.output
      }
    },
    pull: function fromBehaviorPull() {
      _value = automaton.yield(makePullMessage())
    }
  }
}

export function map(pss, fn) {
  // NOTE : pss stands for partial synchronous streams
  let cachedValue = null;

  return {
    get: function mapGet() {
      return cachedValue
    },
    pull: function mapPull() {
      pss.pull();
      const { controlState, output } = pss.get();

      // NOTE : At the difference of 'atomic' iterators, the map combinator does not treat the
      // DONE and ERROR as absorbing states. That means that after returning an error as output,
      // map could possibly return a valid value as output, if the source iterator does so.
      // It is yet an open matter whether this is the correct default behavior.
      switch (controlState) {
        case INIT :
          // could happen for instance with fromFn, when one does a get before a pull (!! dont
          // do that!!) In such pathological case, we just silently output nothing
          // TODO : put in doc
          cachedValue = { controlState, output: NO_OUTPUT };
          break;
        case NEW :
          cachedValue = {
            controlState,
            output: equals(output, NO_OUTPUT) ? NO_OUTPUT : fn(output)
          }
          break;
        case SAME :
          cachedValue = {
            controlState: SAME,
            output: cachedValue.output
          }
          break;
        case ERROR :
          cachedValue = { controlState, output }
          break;
        case DONE :
          cachedValue = { controlState, output }
          break;
      }
    }
  }
}

function hasOneWitnError(iteratorsOutput) {
  return iteratorsOutput.some(outputStruct => outputStruct.controlState === ERROR)
}

function hasOneWithDone(iteratorsOutput) {
  return iteratorsOutput.some(outputStruct => outputStruct.controlState === DONE)
}

function hasOneWitnNoOutput(iteratorsOutput) {
  return iteratorsOutput.some(
    outputStruct =>
      (outputStruct.controlState === NEW && equals(outputStruct.output, NO_OUTPUT)) ||
      (outputStruct.controlState === SAME && equals(outputStruct.output, NO_OUTPUT))
  )
}

function hasAllSame(iteratorsOutput) {
  return iteratorsOutput.every(outputStruct => outputStruct.controlState === SAME)
}

function aggregateIteratorsError(iteratorsOutput){
  return iteratorsOutput.reduce((accErrors, {controlState, output}) => {
    if (controlState === ERROR) {
      accErrors.push(output)
    }

    return accErrors
  },[]).join('\n')
}

export function combine(combiningFn, arrayOfIterators) {
  let cachedValue = null;

  return {
    get: function combineGet() {
      return cachedValue
    },
    // NOTE : At the difference of 'atomic' iterators, the combin combinator does not treat the
    // DONE and ERROR as absorbing states. That means that after returning an error as output,
    // map could possibly return a valid value as output, if the source iterator does so.
    // It is yet an open matter whether this is the correct default behavior.
    pull: function combinePull() {
      const iteratorsOutput = arrayOfIterators.map(pull);

      if (hasOneWitnError(iteratorsOutput)) {
        // Concatenate all errors with their indices
        cachedValue = {controlState : ERROR, output : aggregateIteratorsError(iteratorsOutput)};
      }
      else if (hasOneWithDone(iteratorsOutput)) {
        cachedValue = {controlState : DONE, output : NO_OUTPUT};
      }
      else if (hasOneWitnNoOutput(iteratorsOutput)) {
        // NOTE : I could also memoize the aggregatedCcontrolState and return SAME for second pull
        // bit I don't. I don't foresee any use for such distinction downstream.
        cachedValue = {controlState : NEW, ouput : NO_OUTPUT};
      }
      else if (hasAllSame(iteratorsOutput)) {
        cachedValue = {controlState : SAME, output : cachedValue.output};
      }
      else {
        // reaching here means all iterators have an non-zero output with control state either
        // NEW or SAME. Hence we can execute the combining function on that
        const combiningFnArgsArray = iteratorsOutput.map((obj) => obj.output);

        cachedValue = {
          controlState : NEW,
          output : combiningFn.apply(combiningFn, combiningFnArgsArray)
        };
      }
    }
  }
}

// TODO : put NO_OUTPUT in settings, put DONE_OUTPUT in settings as well and in synchronous fsm
// as well
// Note that this will go as settigns to the state machine cf. fromFn(.. setings)
// done can be used at guard and action levels, no_output used outside of the fsm
// TODO  : do combine. and then demo
