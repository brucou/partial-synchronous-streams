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

const STATES = {
  INIT: 'init',
  NEW: 'new',
  SAME: 'same',
  ERROR: 'error',
  DONE: 'done'
};

const { INIT, NEW, SAME, ERROR, DONE } = STATES;

const PULL_EVENT = 'pull';
const NEW_EVENT = 'new';
const ERROR_EVENT = 'error';
const DONE_EVENT = 'done';
const pullMessage = { [PULL_EVENT]: null };

function makeNewMessage(data) {
  return { [NEW_EVENT]: data }
}

function makeErrMessage(data) {
  return { [ERROR_EVENT]: data }
}

function makeDoneMessage(data) {
  return { [DONE_EVENT]: data }
}

function fromFn(fn) {
  const initialValue = {
    controlState: INIT,
    cache: null,
    value: null
  };
  const pullMessage = PULL_EVENT;
  // TODO : see signature of createsyncFSM : must be able to pass dependencies, but then those
  // dependencies must be passed also to the actions and guards etc. also review settings arg
  const automaton = createSyncFSM(syncDataflowCreateFromFnAutomaton, { initialValue, fn })

  let _value = initialValue;

  return {
    get: function () {
      return { controlState, output } = _value
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
