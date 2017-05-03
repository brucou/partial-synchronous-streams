import { mapObjIndexed} from "ramda"

function traceSinks(header, sinks) {
  return mapObjIndexed((sink$, sinkName) => {
    return sink$.subscribe
      ? sink$.tap(console.debug.bind(console, `${header} > ${sinkName} sink`))
      // not an observable but probably an object, leave as is
      : sink$
  }, sinks)
}

// example
//   const rows$ = traceSource(`a > b > c`, sources.x$)
function traceSource(header, source$) {
  return source$.subscribe
    ? source$.tap(console.debug.bind(console, `${header} source`))
    // not an observable but probably an object, leave as is
    : source$
}

export {  traceSinks, traceSource }
