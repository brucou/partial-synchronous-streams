# TODO

synchronous fsm:

- change the current behviour to add the fact that an action returns both an update of the model 
and an output
  - an action call also perform effects
  - the model update can be expressed as a json patch to forcing no modification of the model
  - there is a special zero value of the output, which serves to indicate that there will be no 
  value passed downstream (not even undefined)
- input via send_event or yield? (eventName : eventData)
- output via callback
- option to have output via event emitter (through settings)
