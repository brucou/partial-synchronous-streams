// TODO : the latest version of synchronous_fsm should go back to rx-component-combinators!!
// TODO : document code with jsdoc, in particular @modify tags for side-effectful functions
// TODO : document the library

// TODO : entry and exit actions??
// TODO : Add termination connector (T)?
// TODO : DSL TODO : write program which takes a transition specifications and draw a nice graph
// out of it with yed or else
// TODO : think about the concurrent states (AND states)
// TODO : cd player demo
// - TEST CASE no history (last seen state is null...)
// - add the view (template + enabling disabling of buttons in function of state)
// - add the tooltips


// CONTRACT : no transition from the history state (history state is only a target state)
// CONTRACT : init events only acceptable in nesting state (aka grouping state)
// NOTE : enforced via in_auto_state only true for grouping state
// CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state
// (aka grouping state)
// NOTE : That would lead to non-determinism if A < B < C and both A and B
// have such automatic actions CONTRACT : There MUST be an action in each transition
// NOTE : Dead states: - Possible if automatic actions (no events) with conditions always true.
// If there is not another condition which at some point is set to false, we have an infinite
// loop (a very real one which could monopolize the CPU if all actions are synchronous) - To
// break out of it, maybe put a guard that if we remain in the same state for X steps,
// transition automatically (to error or else)

import * as Rx from "rx"
import { always, clone, keys } from "ramda"
import * as jsonpatch from "fast-json-patch"
import { assertContract } from "./utils"
import { isArrayUpdateOperations } from "./contracts"
import { CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE } from "./properties"

// CONSTANTS
export const INITIAL_STATE_NAME = 'nok';
export const INIT_EVENT = 'init';
export const AUTO_EVENT = 'auto';
const STATE_PROTOTYPE_NAME = 'State'; // !!must be the function name for the constructor State,
                                      // i.e. State
export const NO_MODEL_UPDATE = [];
export const NO_OUTPUT = null;
export const default_action_result = {
  model_update: NO_MODEL_UPDATE,
  output: NO_OUTPUT
};
export function default_emitter_factory() {return new Rx.Subject()};

function wrap(str) {
  return ['-', str, '-'].join("");
}

/**
 *
 * @param {FSM_Model} model
 * @param {UpdateOperation[]} modelUpdateOperations
 * @returns {FSM_Model}
 */
function applyUpdateOperations(/*OUT*/model, modelUpdateOperations) {
  assertContract(isArrayUpdateOperations, [modelUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  jsonpatch.apply(model, modelUpdateOperations);
  return model;
}

function make_action_DSL(action_list) {
  // action_list is an array whose entries are actions (functions)
  // Returns :
  // [function my_name(){}] -> action_enum : {my_name: 'my_name'}
  // [function my_name(){}] -> action_hash : {my_name: 0}
  return action_list.reduce(function build_action_enum(action_struct, action_fn, index) {
    const action_name = action_fn.name;
    action_struct.action_enum[action_name] = action_name;
    action_struct.action_hash[action_name] = action_fn;
    return action_struct;
  }, { action_enum: {}, action_hash: {} });
}

/**
 * Takes a list of identifiers (strings), adds init to it, and returns a hash whose properties are
 * the uppercased identifiers For instance :
 * ('edit', 'delete') -> {EDIT: 'EDIT', DELETE : 'DELETE', INIT : 'INIT'}
 * If there is an init in the list of identifiers, it is overwritten
 * RESTRICTION : avoid having init as an identifier
 * @param array_identifiers {Array | arguments}
 * @returns {Object<String,String>}
 */
function build_event_enum(array_identifiers) {
  array_identifiers = array_identifiers.reduce ? array_identifiers : Array.prototype.slice.call(arguments);
  // NOTE : That will overwrite any other event called init...
  array_identifiers.push(INIT_EVENT);
  return array_identifiers.reduce(function (acc, identifier) {
    acc[identifier] = identifier;
    return acc;
  }, {})
}

/**
 * Returns the name of the function as taken from its source definition.
 * For instance, function do_something(){} -> "do_something"
 * @param fn {Function}
 * @returns {String}
 */
function get_fn_name(fn) {
  const tokens =
    /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/
      .exec(fn.toString());
  return tokens[1];
}

/**
 * Processes the hierarchically nested states and returns miscellaneous objects derived from it:
 * `is_group_state` : {Object<String,Boolean>} Hash whose properties (state names) are matched with
 * whether that state is a nested state
 * `hash_states` : Hierarchically nested object whose properties are the nested states.
 * - Nested states inherit (prototypal inheritance) from the containing state.
 * - Holds a `history` property which holds a `last_seen_state` property which holds the latest
 * state for that hierarchy group For instance, if A < B < C and the state machine leaves C for a
 * state in another branch, then `last_seen_state` will be set to C for A, B and C
 * - Holds an `active` property which is not so useful so far, and which signal whether the state
 * is active (current) or not
 * - Tthe root state (NOK) is added to the whole hierarchy, i.e. all states inherit from the root
 * state
 * `states` {Object<String,Boolean>} : Hash which maps every state name with itself
 * `states.history` {Object<String,Function>} : Hash which maps every state name with a function
 * whose name is the state name
 * @param states
 * @returns {{hash_states: {}, is_group_state: {}}}
 */
function build_nested_state_structure(states, event_emitter_factory) {
  const root_name = 'State';
  const last_seen_state_event_emitter = event_emitter_factory();
  let hash_states = {};
  let last_seen_state_listener_disposables = [];
  let is_group_state = {};

  // Add the starting state
  states = { nok: states };

  ////////
  // Helper functions
  function add_last_seen_state_listener(child_name, parent_name) {
    last_seen_state_listener_disposables.push(
      last_seen_state_event_emitter.subscribe(function (x) {
        const event_emitter_name = x.event_emitter_name
        const last_seen_state_name = x.last_seen_state_name;
        if (event_emitter_name === child_name) {
          console.log(['last seen state set to', wrap(last_seen_state_name), 'in', wrap(parent_name)].join(" "));
          hash_states[parent_name].history.last_seen_state = last_seen_state_name;
        }
      }));
  }

  function build_state_reducer(states, curr_constructor) {
    keys(states).forEach(function (state_name) {
      const state_config = states[state_name];
      let curr_constructor_new;

      // The hierarchical state mechanism is implemented by reusing the standard Javascript
      // prototypal inheritance If A < B < C, then C has a B as prototype which has an A as
      // prototype So when an event handler (transition) is put on A, that event handler will be
      // visible in B and C
      hash_states[state_name] = new curr_constructor();
      hash_states[state_name].name = state_name;
      const parent_name = hash_states[state_name].parent_name = get_fn_name(curr_constructor);
      hash_states[state_name].root_name = root_name;
      hash_states[state_name].history = { last_seen_state: null };
      hash_states[state_name].active = false;

      // Set up the listeners for propagating the last seen state up the prototypal chain
      // Prototypal inheritance only works in one direction, we need to implement the other
      // direction by hand if A < B < C is a state hierarchy, to implement correctly the history
      // mechanism, we need the last seen state to be the same throughout the whole hierarchy.
      // Prototypal inheritance does not help here as it works in the opposite direction. So we
      // resort to an event emitter (here an RxJS subject) which connect C and B, B and A. When
      // state C is abandoned, then it updates it `last_seen_state` property and emits a change
      // event, B is subscribed to it, and updates its property and emits a change. A is subscribed
      // to B changes, so that the change event is propagated recursively up the hierarchy. This is
      // a reactive mechanim which is simpler that the interactive one where you adjust the whole
      // hierarchy when state C is abandoned.
      add_last_seen_state_listener(state_name, parent_name);

      if (typeof(state_config) === 'object') {
        is_group_state[state_name] = true;
        eval(['curr_constructor_new = function', state_name, '(){}'].join(" "));
        curr_constructor_new.displayName = state_name;
        curr_constructor_new.prototype = hash_states[state_name];
        build_state_reducer(state_config, curr_constructor_new);
      }
    })
  }

  function State() {
    this.history = { last_seen_state: null };
  }

  // The `emitLastSeenStateEvent` is set on the State object which is inherited by all state
  // objects, so it can be called from all of them when a transition triggers a change of state
  State.prototype = {
    emitLastSeenStateEvent: function (x) {
      last_seen_state_event_emitter.onNext(x);
    },
    current_state_name: INITIAL_STATE_NAME
  };

  hash_states[INITIAL_STATE_NAME] = new State();
  hash_states[STATE_PROTOTYPE_NAME] = new State();

  build_state_reducer(states, State);

  return {
    hash_states: hash_states,
    is_group_state: is_group_state
  };
}

/**
 * Returns a hash which maps a state name to :
 * - a string identifier which represents the standard state
 * - a function whose name is the state name to represent the state history (set in the `history`
 * property of the hash)
 * @param states A hash describing a hierarchy of nested states
 * @returns {state_name: {String}, {history: {Function}}}
 */
function build_state_enum(states) {
  let states_enum = { history: {} };

  // Set initial state
  states_enum.NOK = INITIAL_STATE_NAME;

  function build_state_reducer(states) {
    keys(states).forEach(function (state_name) {
      const state_config = states[state_name];

      states_enum[state_name] = state_name;
      // All history states will be signalled through the history property, and a function instead
      // of a value The function name is the state name whose history is referred to
      let state_name_history_fn;
      // NOTE : we add an underscore to avoid collision with javascript reserved word (new,
      // each, ...)
      eval(['state_name_history_fn = function', '_' + state_name, '(){}'].join(" "));
      states_enum.history[state_name] = state_name_history_fn;

      if (typeof(state_config) === 'object') {
        build_state_reducer(state_config);
      }
    })
  }

  build_state_reducer(states);

  return states_enum;
}


/**
 * TODO : document transition mechanism
 * - transition format
 *   - events : if not present, then actions become automatic
 *   - condition(s) : if several, pass them in an array (field `conditions`), the order of the
 * array is the order of applying the conditions. When a single condition (field `condition`) When
 * the first is found true, the sequence of condition checking stops there
 *   - action : function (model, event_data) : model_prime
 *   - from : state from which the described transition operates
 *   - to : target state for the described transition
 * @param fsmDef
 * @param settings
 * @returns {{yield : Function, start: Function}}
 */
function create_state_machine(fsmDef, settings) {
  const { control_states, events, transitions, model_initial } = fsmDef;
  const event_emitter_factory = ('event_emitter_factory' in settings)
    ? settings.event_emitter_factory
    : default_emitter_factory;

  const _control_states = build_state_enum(control_states);
  const _events = build_event_enum(events);

  // Create the nested hierarchical
  const hash_states_struct = build_nested_state_structure(_control_states, event_emitter_factory);

  // This will be the model object which will be updated by all actions and on which conditions
  // will be evaluated It is safely contained in a closure so it cannot be accessed in any way
  // outside the state machine
  let model = clone(model_initial);
  let is_init_state = {}; // {Object<state_name,boolean>}, allows to know whether a state has a
  // init transition defined
  let is_auto_state = {}; // {Object<state_name,boolean>}, allows to know whether a state has an
  // automatic transition defined
  const is_group_state = hash_states_struct.is_group_state; // {Object<state_name,boolean>}, allows
                                                            // to know whether a state is a group
                                                            // of state or not
  let hash_states = hash_states_struct.hash_states;

  transitions.forEach(function (transition) {
    console.log("processing transition:", transition);
    let from = transition.from, to = transition.to;
    const action = transition.action;
    let event = transition.event;
    // CONTRACT : `conditions` property used for array of conditions, otherwise `condition`
    // property is used
    let arr_predicate = transition.conditions || transition.condition;
    // CASE : ZERO OR ONE condition set
    if ((arr_predicate && !arr_predicate.forEach) || !arr_predicate) arr_predicate = [
      { condition: arr_predicate, to: to, action: action }
    ];

    // CASE : transition has a init event
    // NOTE : there should ever only be one, but we don't enforce it for now
    if (event === INIT_EVENT) {
      is_init_state[from] = true;
    }

    let from_proto = hash_states[from];

    // ERROR CASE : state found in transition but cannot be found in the events passed as parameter
    // NOTE : this is probably all what we need the events variable for
    if (event && !(event in _events)) throw `unknown event ${event} found in state machine definition!`
    // CASE : automatic transitions : no events - likely a transient state with only conditions
    if (!event) {
      event = AUTO_EVENT;
      is_auto_state[from] = true;
    }
    // CASE : automatic transitions : init event automatically fired upon entering a grouping state
    if (is_group_state[from] && is_init_state[from]) {
      is_auto_state[from] = true;
    }

    console.log("This is transition for event:", event);
    console.log("Predicates:", arr_predicate);

    from_proto[event] = arr_predicate.reduce(function (acc, condition, index) {
      let action = condition.action || always(default_action_result);
      console.log("Condition:", condition);
      const condition_checking_fn = (function (condition, settings) {
        let condition_suffix = '';
        // We add the `current_state` because the current state might be different from the `from`
        // field here This is the case for instance when we are in a substate, but through
        // prototypal inheritance it is the handler of the prototype which is called
        const condition_checking_fn = function (model_, event_data, current_state) {
          from = current_state || from;
          const predicate = condition.condition;
          condition_suffix = predicate ? '_checking_condition_' + index : '';
          const to = condition.to;
          let actionResult;

          if (!predicate || predicate(model_, event_data, settings)) {
            // CASE : condition for transition is fulfilled so we can execute the actions...
            console.info("IN STATE ", from);
            console.info("WITH model, event data, settings BEING ", model_, event_data, settings);
            console.info("CASE : "
              + (predicate ? "condition " + predicate.name + " for transition is fulfilled"
                : "automatic transition"));
            if (action) {
              // CASE : we do have some actions to execute
              console.info("THEN : we execute the action " + action.name);
              // NOTE : in a further extension, passing the fsm and the events object could help
              // in implementing asynchronous fsm
              actionResult = action(model_, event_data, settings);
            }

            // Leave the current state
            leave_state(from, model_, hash_states);

            // Update the model before entering the next state
            model = update_model(model_, actionResult.model_update);
            // Emit the new model event
            // new_model_event_emitter.onNext(model);
            console.info("RESULTING IN : ", model);
            console.info("RESULTING IN OUTPUT : ", actionResult.output);

            // ...and enter the next state (can be different from to if we have nesting state group)
            const next_state = enter_next_state(to, actionResult.model_update, hash_states);
            console.info("ENTERING NEXT STATE : ", next_state);

            return { stop: true, output: actionResult.output }; // allows for chaining and stop
                                                                // chaining condition
          }
          else {
            // CASE : condition for transition is not fulfilled
            console.log("CASE : "
              + (predicate ? "condition " + predicate.name + " for transition NOT fulfilled..."
                : "no predicate"));
            return { stop: false, output: NO_OUTPUT };
          }
        };
        condition_checking_fn.displayName = from + condition_suffix;
        return condition_checking_fn;
      })(condition, settings);

      return function arr_predicate_reduce_fn(model_, event_data, current_state) {
        const condition_checked = acc(model_, event_data, current_state);
        return condition_checked.stop
          ? condition_checked
          : condition_checking_fn(model_, event_data, current_state);
      }
    }, function dummy() {
      return { stop: false, output: NO_OUTPUT }
    });
  });

  function send_event(event_struct) {
    console.log("send event", event_struct);
    const event_name = keys(event_struct)[0];
    const event_data = event_struct[event_name];

    return process_event(hash_states_struct.hash_states, event_name, event_data, model);
  }

  function process_event(hash_states, event, event_data, model) {
    console.log("Processing event ", event, event_data);
    const current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
    const event_handler = hash_states[current_state][event];

    if (event_handler) {
      // CASE : There is a transition associated to that event
      console.log("found event handler!");
      console.info("WHEN EVENT ", event);
      /* OUT : this event handler modifies the model and possibly other data structures */
      const output = event_handler(model, event_data, current_state).output;

      // we read it anew as the execution of the event handler may have changed it
      const current_state = hash_states[INITIAL_STATE_NAME].current_state_name;

      // Two cases here:
      // 1. Init handlers, when present on the current state, must be acted on immediately
      // This allows for sequence of init events in various state levels
      // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
      // In this case event_data will carry on the data passed on from the last event (else we loose
      // the model?) 2. transitions with no events associated, only conditions (i.e. transient
      // states) In this case, there is no need for event data
      if (is_auto_state[current_state]) {
        // CASE : transient state with no triggering event, just conditions
        // automatic transitions = transitions without events
        const auto_event = is_init_state[current_state] ? INIT_EVENT : AUTO_EVENT;
        return send_event({ [AUTO_EVENT]: event_data });
      }
      else return output
    }
    else {
      // CASE : There is no transition associated to that event from that state
      console.error(`There is no transition associated to that event!`);

      return NO_OUTPUT;
    }
  }

  function leave_state(from, model, hash_states) {
    // NOTE : model is passed as a parameter for symetry reasons, no real use for it so far
    const state_from = hash_states[from];
    const state_from_name = state_from.name;

    // Set the `last_seen_state` property in the object representing that state's state (!)...
    state_from.history.last_seen_state = state_from_name;
    state_from.active = false;
    console.log("left state", wrap(from));

    // ... and emit the change event for the parents up the hierarchy to update also their
    // last_seen_state properties This updating solution is preferred to an imperative solution, as
    // it allows not to think too much about how to go up the hierarchy There is no big difference
    // also, as by default subject emits synchronously their values to all subscribers. The
    // difference in speed should be neglectable, and anyways it is not expected to have large
    // state chart depths
    state_from.emitLastSeenStateEvent({
      event_emitter_name: state_from_name,
      last_seen_state_name: state_from_name
    });
  }

  function enter_next_state(to, model_prime, hash_states) {
    // Enter the target state
    let state_to;
    let state_to_name;
    // CASE : history state (H)
    if (typeof(to) === 'function') {
      state_to_name = get_fn_name(to);

      const target_state = hash_states[state_to_name].history.last_seen_state;
      state_to_name = target_state
        // CASE : history state (H) && existing history, target state is the last seen state
        ? target_state
        // CASE : history state (H) && no history (i.e. first time state is entered), target state
        // is the entered state
        : state_to_name;
      state_to = hash_states[state_to_name];
    }
    // CASE : normal state
    else if (to) {
      state_to = hash_states[to];
      state_to_name = state_to.name;
    }
    else {
      throw 'enter_state : unknown case! Not a state name, and not a history state to enter!'
    }
    state_to.active = true;
    hash_states[INITIAL_STATE_NAME].current_state_name = state_to_name;

    console.info("AND TRANSITION TO STATE", state_to_name);
    return state_to_name;
  }

  function start() {
    return send_event({ [INIT_EVENT]: model_initial });
  }

  /**
   * OUT
   * @param model
   * @param modelUpdateOperations
   */
  function update_model(model, modelUpdateOperations) {
    return applyUpdateOperations(model, modelUpdateOperations);
  }

  return {
    yield: send_event,
    start: start,
  }
}

export {
  create_state_machine,
  build_state_enum,
  build_event_enum,
}
