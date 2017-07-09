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

// TODO : put NO_OUTPUT in settings,
