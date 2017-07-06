import { INIT_EVENT, INITIAL_STATE_NAME, NO_OUTPUT } from "./synchronous_fsm"
import { equals, tryCatch } from "ramda"
import { toJsonPatch } from "./utils"
import { DONE_EVENT, ERROR_EVENT, NEW_EVENT, PULL_EVENT, STATES } from "./properties"

export const ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION = `Encountered an error while executing generating function.`;

const { INIT, NEW, SAME, ERROR, DONE, TEMP } = STATES;

const initialValue = {
  controlState: INIT,
  cache: null,
  value: NO_OUTPUT,
  error: null
};

export const syncDataflowCreateFromFnAutomaton = {
  control_states: { [INIT]: '', [NEW]: '', [SAME]: '', [ERROR]: '', [DONE]: '', [TEMP]: '' },
  events: [PULL_EVENT, NEW_EVENT, ERROR_EVENT, DONE_EVENT],
  transitions: [
    // initial transition on start
    { from: INITIAL_STATE_NAME, to: INIT, event: INIT_EVENT, action: init },
    //
    { from: INIT, to: TEMP, event: PULL_EVENT, action: firstPullFromFn },
    {
      // no event property means automatic event is fired on entering the state
      from: TEMP, conditions: [
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
    model_update: toJsonPatch('')({
      controlState: SAME,
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
    model_update: toJsonPatch('')({
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
    model_update: toJsonPatch('')({
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
    model_update: toJsonPatch('')({
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

function init(model, eventData, settings) {
  return {
    // no model update on init
    model_update: [],
    // but we do want to output something for the initial state
    output: {
      controlState: INIT,
      output: NO_OUTPUT
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
    (e) => ({
      value: NO_OUTPUT,
      error: 'subsequentPullFromFn > ' + ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION + ' : ' + e
    })
  )();

  return {
    model_update: toJsonPatch('')({
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
    (e) => ({
      value: NO_OUTPUT,
      error: 'firstPullFromFn > ' + ERROR_WHEN_EXECUTING_ITERABLE_GENERATING_FUNCTION + ' : ' + e
    })
  )();

  const model_update = toJsonPatch('')({
    controlState: TEMP,
    cache: null,
    ...value
  });

  return {
    model_update,
    output: NO_OUTPUT
  }
}
