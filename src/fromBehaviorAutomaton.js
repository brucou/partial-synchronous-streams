import { create_state_machine, INIT_EVENT, INITIAL_STATE_NAME, NO_OUTPUT } from "./synchronous_fsm"
import { equals, tryCatch } from "ramda"
import { toJsonPatch } from "./utils"
import {STATES, PULL_EVENT, NEW_EVENT, ERROR_EVENT, DONE_EVENT} from './properties'


export const syncDataflowCreateFromBehaviorAutomaton = {}
