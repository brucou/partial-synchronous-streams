import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { clone, F, merge, T } from "ramda"
// import {runTestScenario, format, noop} from "rx-component-combinators"
// import { addPrefix, convertVNodesToHTML, format, noop } from "../src/utils"
// import { runTestScenario } from "../src/runTestScenario"
// import { span } from "cycle-snabbdom"
import {
  create_state_machine, INIT_EVENT, INITIAL_STATE_NAME, NO_OUTPUT
} from "../src/synchronous_fsm"
import * as jsonpatch from "fast-json-patch"

function spy_on_args(fn, spy_fn) {
  return function spied_on(...args) {
    spy_fn(...args);

    return fn(...args);
  }
}

const default_settings = {
  event_emitter_factory: function () {return new Rx.Subject()}
};

const NO_ACTION = null;
const EVENT1 = 'event1';
const EVENT1_DATA = {
  event1_data_key1: 'event1_data_value1'
}
const a_value = "some value";
const another_value = "another value";
const an_object_value = {
  objKey1: 'objValue1',
  objKey2: 'objValue2',
  objKey3: 'objValue3',
};
const an_output = {
  outputKey1: 'outputValue1'
};
const another_output = {
  anotherOutputKey1: 'anotherOutputValue1'
};
const model_initial = {
  a_key: a_value,
  another_key: another_value
};
const dummy_action_result = {
  model_update: [],
  output: an_output
};
const another_dummy_action_result = {
  model_update: [],
  output: another_output
};
const replaced_model_property = {
  new_model_key: 'new_model_value'
}
const update_model_ops_1 = [
  { op: "add", path: '/new_model_key_1', value: 'new_model_value_1' },
  { op: "replace", path: '/a_key', value: replaced_model_property },
  { op: "remove", path: '/another_key' },
];
const update_model_ops_2 = [
  { op: "add", path: '/new_model_key_2', value: 'new_model_value_2' },
];
const dummy_action_result_with_update = {
  model_update: update_model_ops_1,
  output: an_output
};
const another_dummy_action_result_with_update = {
  model_update: update_model_ops_2,
  output: another_output
};

function dummy_action(model, event_data, settings) {
  return dummy_action_result
}
function another_dummy_action(model, event_data, settings) {
  return another_dummy_action_result
}
function dummy_action_with_update(model, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    output: {
      // NOTE : ! this is the model before update!!
      model: clone(model),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}
function another_dummy_action_with_update(model, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      output: {
        // NOTE : ! this is the model before update!!
        model: clone(model),
        event_data: clone(event_data),
        settings: JSON.parse(JSON.stringify(settings))
      }
    }
  )
}


QUnit.module("Testing create_state_machine(fsmDef, settings)", {});

// Basic test with settings
// NOK -init> A, no action, no guard, it is init -> outputs NO_OUTPUT
QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, action: NO_ACTION }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, NO_OUTPUT, `INIT event starts the state machine`);
});

// NOK -init> A, no action, false guard, it is init -> outputs as NO_OUTPUT
QUnit.test("INIT event, no action, false guard", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, condition: F, action: NO_ACTION }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, NO_OUTPUT, `INIT event starts the state machine`);
});

// NOK -init> A, no action, true guard, it is init -> default action called, outputs NO_OUTPUT
QUnit.test("INIT event, no action, true guard", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, condition: T, action: NO_ACTION }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, NO_OUTPUT, `INIT event starts the state machine`);
});

// NOK -init> A, action, false guard, it is init -> action called right params, outputs as expected
QUnit.test("INIT event, action, false guard", function exec_test(assert) {
  const fail_if_called = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.ok(true, false, `Guard is false, this action should not be called!`)
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, condition: F, action: fail_if_called }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, NO_OUTPUT, `INIT event starts the state machine`);
});

// NOK -init> A, action, true guard, it is init -> action called right params, outputs as expected
QUnit.test("INIT event, action, true guard", function exec_test(assert) {
  const spied_on_dummy_action = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.deepEqual(model, model_initial, `action called with model as first parameter`);
      assert.deepEqual(event_data, model_initial, `action called with event_data as second parameter`);
      assert.deepEqual(settings, default_settings, `action called with settings as third parameter`);
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      {
        from: INITIAL_STATE_NAME,
        to: 'A',
        event: INIT_EVENT,
        condition: T,
        action: spied_on_dummy_action
      }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, dummy_action_result.output,
    `INIT event starts the state machine, transition is taken, action is executed`);
});

// NOK -init> A, 2 actions, [{T,F}x{T,F}] guards
QUnit.test("INIT event, 2 actions, [T,T] conditions, 1st action executed", function exec_test(assert) {
  const spied_on_dummy_action = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.deepEqual(model, model_initial, `action called with model as first parameter`);
      assert.deepEqual(event_data, model_initial, `action called with event_data as second parameter`);
      assert.deepEqual(settings, default_settings, `action called with settings as third parameter`);
    });
  const fail_if_called = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.ok(true, false, `This true guard comes second, this action should not be called!`)
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      {
        from: INITIAL_STATE_NAME, event: INIT_EVENT, conditions: [
        { condition: T, to: 'A', action: spied_on_dummy_action },
        { condition: T, to: 'A', action: fail_if_called }
      ]
      }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, dummy_action_result.output,
    `INIT event starts the state machine, transition is taken, action is executed`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const spied_on_dummy_action = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.deepEqual(model, model_initial, `action called with model as first parameter`);
      assert.deepEqual(event_data, model_initial, `action called with event_data as second parameter`);
      assert.deepEqual(settings, default_settings, `action called with settings as third parameter`);
    });
  const fail_if_called = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.ok(true, false, `This true guard comes second, this action should not be called!`)
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      {
        from: INITIAL_STATE_NAME, event: INIT_EVENT, conditions: [
        { condition: F, to: 'A', action: fail_if_called },
        { condition: T, to: 'A', action: spied_on_dummy_action }
      ]
      }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, dummy_action_result.output,
    `INIT event starts the state machine, transition is taken, action is executed`);
});

QUnit.test("INIT event, 2 actions, [T,F] conditions, 1st action executed", function exec_test(assert) {
  const spied_on_dummy_action = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.deepEqual(model, model_initial, `action called with model as first parameter`);
      assert.deepEqual(event_data, model_initial, `action called with event_data as second parameter`);
      assert.deepEqual(settings, default_settings, `action called with settings as third parameter`);
    });
  const fail_if_called = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.ok(true, false, `This true guard comes second, this action should not be called!`)
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      {
        from: INITIAL_STATE_NAME, event: INIT_EVENT, conditions: [
        { condition: F, to: 'A', action: spied_on_dummy_action },
        { condition: T, to: 'A', action: fail_if_called }
      ]
      }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, dummy_action_result.output,
    `INIT event starts the state machine, transition is taken, action is executed`);
});

QUnit.test("INIT event, 2 actions, [F,F] conditions, no action executed", function exec_test(assert) {
  const spied_on_dummy_action = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.deepEqual(model, model_initial, `action called with model as first parameter`);
      assert.deepEqual(event_data, model_initial, `action called with event_data as second parameter`);
      assert.deepEqual(settings, default_settings, `action called with settings as third parameter`);
    });
  const fail_if_called = spy_on_args(dummy_action,
    (model, event_data, settings) => {
      assert.ok(true, false, `This true guard comes second, this action should not be called!`)
    });
  const fsmDef = {
    control_states: { A: '' },
    events: [],
    transitions: [
      {
        from: INITIAL_STATE_NAME, event: INIT_EVENT, conditions: [
        { condition: F, to: 'A', action: fail_if_called },
        { condition: F, to: 'A', action: fail_if_called }
      ]
      }
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = fsm.start();
  assert.deepEqual(result, NO_OUTPUT,
    `INIT event starts the state machine, all guards failing, no transition is taken, no action is executed`);
});

// NOK -init> A, no guards, dummy action
// A -ev1> B, no guards, another dummy action
QUnit.test("INIT event, 2 actions with no model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, action: dummy_action },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action },
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result1 = fsm.start();
  const result2 = fsm.yield({ [EVENT1]: EVENT1_DATA });
  assert.deepEqual([result1, result2], [an_output, another_output], `event triggers correct transition`);
});

// NOK -init> A, no guards, dummy action
// A -ev1> B, no guards, another dummy action
// WITH MODEL UPDATE and test of model update, settings and event passing : except last model update
QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    control_states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INITIAL_STATE_NAME, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    model_initial: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result1 = fsm.start();
  const result2 = fsm.yield({ [EVENT1]: EVENT1_DATA });
  const cloned_model_initial = clone(model_initial);
  assert.deepEqual([result1, result2],[
    {
      "event_data": model_initial,
      "model": model_initial,
      // settings has its function and regexp removed by JSON.parse(JSON.stringify...
      "settings": {}
    },
    {
      "event_data": EVENT1_DATA,
      "model": (jsonpatch.apply(cloned_model_initial, update_model_ops_1), cloned_model_initial),
      "settings": {}
    }
  ], `event triggers correct transition`);
});

// TODO : add 3 conditions F,T,F with spied_dummy on T, throw_if_Called on F
// TODO : modify the update of the model on the action to include JSON patch?

// TODO : document initial state is NOK, and event init automatically fired on starting the fsm
// TODO : allow to start with a fsm in anotehr initial state than NOK
//   for that     state_to.active = true;
//                hash_states[INITIAL_STATE_NAME].current_state_name = state_to_name;
// set the model to some initial value, and the initial state in hash_states, and the active = true
// to MUST be a name of the state_to = hash_states[to]; NOT a history state (to is fn then)
