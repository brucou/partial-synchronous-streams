import {createHashHistory, createHistory} from 'history'
import {makeRouterDriver, supportsHistory} from 'cyclic-router'

// app root function
import Root from './root'
import defaultModules from 'cycle-snabbdom/lib/modules'

// drivers
import {makeDOMDriver} from 'cycle-snabbdom'
import {run} from '@cycle/core'

const history = supportsHistory() ?
  createHistory() : createHashHistory()

const modules = defaultModules

const {sources, sinks} = run(Root, {
  DOM: filterNull(makeDOMDriver('#app', {transposition: false, modules})),
  router: makeRouterDriver(history, {capture: true}),
  // TODO : add db write and db query drivers
})

if (module.hot) {
  module.hot.accept()

  module.hot.dispose(() => {
    sinks.dispose()
    sources.dispose()
  })
}

function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$.filter(x => x))
  }
}

// 0. router source, should be just this, no driver, Rx.Observable.create
// let unlisten = history.listen((location) => {
// observer.next(location);
//});
// I already hav history (imported from npm package history)
// 1. import history-driver from cycle, I need the click capture. check that
// that is use cyclic-router 1.0.0
// check it works with capture settings
// 2. implements the route logic
// navigate to /apply
// navigate to /completed (!!I will have to update the fsm state entry component for STATE_APPLIED)
// 3. check database keys - use the same as in example
// 4. I will need query$: makeDomainQueryDriver(repository, queryConfig),
// 4. replace firebase by something else
// use rxdb
// copy firebase data to rxdb (dump?)
// adapt the makeDomainQueryDriver to that repository
// or pipelinedb https://www.pipelinedb.com/
