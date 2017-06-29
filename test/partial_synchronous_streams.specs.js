import * as QUnit from "qunitjs"
import * as Rx from "rx"
// import { values } from "ramda"
// import {runTestScenario, format, noop} from "rx-component-combinators"
// import { addPrefix, convertVNodesToHTML, format, noop } from "../src/utils"
// import { runTestScenario } from "../src/runTestScenario"
// import { span } from "cycle-snabbdom"
import { create_state_machine } from "../src/synchronous_fsm"

const default_settings = {
  event_emitter_factory: function () {return new Rx.Subject()}
};

const NO_ACTION = null;
const aValue = "some value";
const anotherValue = "another value";
const anObjectValue = {
  objKey1: 'objValue1',
  objKey2: 'objValue2',
  objKey3: 'objValue3',
};
const model_initial = {
  aKey: aValue,
  anotherKey: anotherValue
}

QUnit.module("Testing create_state_machine(control_states, events, transitions, model_initial, Rx)", {});

// Basic test with settings
// NOK -init> A, no action, no guard, it is init -> outputs NO_OUTPUT
// NOK -init> A, no action, true guard, it is init -> guards called with right params, outputs
// NO_OUTPUT
// NOK -init> A, action, false guard, it is init -> action not called, outputs as NO_OUTPUT
// NOK -init> A, action, true guard, it is init -> action called right params, outputs as expected
QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '' },
    events: {},
    transitions: [
      { from: 'NOK', to: 'A', event: 'INIT', action: NO_ACTION }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(null, result, `INIT event starts the state machine`);


});

//   const { control_states, events, transitions, model_initial } = fsmDef;
// const { event_emitter_factory } = settings;
// {model_update, output} = action(model_, event_data, settings);!!
// will return null (NO_OUTPUT) when no handler
// TODO : add test condition for no action defined for a transition
// TODO : document initial state is NOK, and event init automatically fired on starting the fsm
// TODO : allow to start with a fsm in anotehr initial state than NOK


