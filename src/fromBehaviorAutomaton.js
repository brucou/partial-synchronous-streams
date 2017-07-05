import { INIT_EVENT, INITIAL_STATE_NAME, NO_OUTPUT } from "./synchronous_fsm"
import { equals, tryCatch } from "ramda"
import { toJsonPatch } from "./utils"
import {STATES, PULL_EVENT, NEW_EVENT, ERROR_EVENT, DONE_EVENT} from './properties'

const { INIT, NEW, SAME, ERROR, DONE, TEMP } = STATES;
const initialValue = {
  controlState: INIT,
  cache: null,
  value: null,
  error: null
};

export const syncDataflowCreateFromBehaviorAutomaton = {
  control_states: { [INIT]: '', [NEW]: '', [SAME]: '', [ERROR]: '', [DONE]: '', [TEMP]: '' },
  events: [PULL_EVENT, NEW_EVENT, ERROR_EVENT, DONE_EVENT],
  // TODO : refactor to a hierarchical state machine!! that waw I test it also
  transitions: [
    // initial transition on start
    { from: INITIAL_STATE_NAME, to: INIT, event: INIT_EVENT, action: init },

    { from: INIT, to: NEW, event: NEW_EVENT, action: updateWithNewValue },
    { from: INIT, to: DONE, event: DONE_EVENT, action: updateWithDone },
    { from: INIT, to: ERROR, event: ERROR_EVENT, action: updateWithError },

    { from: NEW, to: NEW, event: NEW_EVENT, action: updateWithNewValue },
    { from: NEW, to: DONE, event: DONE_EVENT, action: updateWithDone },
    { from: NEW, to: ERROR, event: ERROR_EVENT, action: updateWithError },
    { from: NEW, to: SAME, event: PULL_EVENT, action: setNewPullOutput },

    { from: SAME, to: SAME, event: PULL_EVENT, action: setSamePullOutput },
    { from: SAME, to: NEW, event: NEW_EVENT, action: updateWithNewValue },
    { from: SAME, to: DONE, event: DONE_EVENT, action: updateWithDone },
    { from: SAME, to: ERROR, event: ERROR_EVENT, action: updateWithError },

    { from: ERROR, to: ERROR, event: PULL_EVENT, action: repeatError },

    { from: DONE, to: DONE, event: PULL_EVENT, action: repeatDone },

  ],
  model_initial: initialValue
}

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

function setSamePullOutput (model, eventData, settings) {
  return {
    model_update: [],
    output: {
      controlState : SAME,
      output : model.value
    }
  }
}

function setNewPullOutput (model, eventData, settings) {
  return {
    model_update: [],
    output: {
      controlState : NEW,
      output : model.value
    }
  }
}

function updateWithError (model, eventData, settings) {
  return {
    model_update: toJsonPatch('')({
      value : null,
      error: eventData
    }),
    output: []
  }
}

function updateWithDone (model, eventData, settings) {
  return {
    model_update: toJsonPatch('')({
      controlState: DONE,
      value : null,
      error: null
    }),
    output: NO_OUTPUT
  }
}

function updateWithNewValue (model, eventData, settings) {
  return {
    model_update: toJsonPatch('')({
      controlState: NEW,
      value : eventData,
      error: null
    }),
    output: NO_OUTPUT
  }
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
