import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { values } from "ramda"
// import {runTestScenario, format, noop} from "rx-component-combinators"
import { addPrefix, convertVNodesToHTML, format, noop } from "../src/utils"
import { runTestScenario } from "../src/runTestScenario"
import { span } from "cycle-snabbdom"
import {create_state_machine, build_event_enum, build_state_enum} from "../src/synchronous_fsm"

QUnit.module("Testing create_state_machine(control_states, events, transitions, model_initial, Rx)", {});

// Basic test
