import { createMachine, assign, send, sendParent, interpret } from 'xstate';

    /*
        https://xstate.js.org/docs/tutorials/7guis/timer.html#modeling
        https://spectrum.chat/statecharts/general/is-there-a-way-to-clear-an-interval-without-transitioning-to-another-state~252813ff-22aa-4d62-bb7f-9d8198afd8d9?m=MTU5NjYzNjAwNzcwOA==
    */

let intervalMachine = createMachine(
    {
        initial: 'running',
        context: {
            elapsed: 0,
            duration: 0,
            interval: 1
        },
        states: {
            running: {
                invoke: {
                    id: 'timer',
                    src: 'timer'
                },
                always: {
                    target: 'complete',
                    cond: 'intervalComplete'
                },
                on: {
                    TICK: {
                        actions: [
                            sendParent('INTERVAL_TICK'),
                            'incrementElapsed'
                        ]
                    },
                    PAUSE: 'paused'
                }
            },
            paused: {
                on: {
                    RESUME: 'running'
                }
            },
            complete: { type: 'final' }
        }
    },
    { /* config */
        actions: {
            incrementElapsed: assign({
                elapsed: cxt => cxt.elapsed + cxt.interval
            })
        },
        guards: {
            intervalComplete: cxt => cxt.elapsed === cxt.duration
        },
        services: {
            timer: () => sendBack => {
                let interval = setInterval(() => {
                    sendBack('TICK');
                }, 1000);
            
                return () => {
                    clearInterval(interval);
                };
            }
        }
    }
);

let intervalsMachine = createMachine(
    {
        initial: 'ready',
        context: {
            intervals: [{name: 'Int 1', duration: 3}, {name: 'Int 2', duration: 5}],
            intervalCursor: 0,
            elapsed: 0,
            timerInterval: 1
        },
        states: {
            ready: {
                on:{
                    START: 'running'
                }
            },
            running: {
                invoke: {
                    id: 'intervalMachine',
                    src: intervalMachine,
                    data: {
                        interval: ctx => ctx.timerInterval,
                        elapsed: 0,
                        duration: ctx => ctx.intervals[ctx.intervalCursor].duration
                    },
                    onDone: {
                        target: 'running',
                        actions: 'updateCurrentInterval'
                    }
                },
                always: {
                    target: 'complete',
                    cond: 'allIntervalsComplete'
                },
                on: {
                    INTERVAL_TICK: {
                        actions: 'incrementElapsed'
                    }
                }
            },
            paused: {},
            complete: { type: 'final' }
        }
    },
    { /* config */
        actions: {
            updateCurrentInterval: assign({
                intervalCursor: ctx => ctx.intervalCursor + 1
            }),
            incrementElapsed: assign({
                elapsed: ctx => ctx.elapsed + ctx.timerInterval
            })
        },
        guards: {
            allIntervalsComplete: ctx => ctx.intervalCursor === ctx.intervals.length
        },
        services: {
            intervalMachine
        }
    }
);

let intervalsService = interpret(intervalsMachine).onTransition(state => {
    console.log(state.context.elapsed);
});
  
intervalsService.start();

intervalsService.send('START');