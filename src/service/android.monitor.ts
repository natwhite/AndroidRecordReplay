import {Position} from "../models/position";
import {OsExecutor} from "./os.executor";
import {adb_path} from "../constants";
import {catchError, filter, first, groupBy, map, mergeMap, share, tap, zipWith} from "rxjs/operators";
import {TouchEvent} from "../models/touch.event";
import {GroupedObservable, Observable} from "rxjs";
import * as console from "console";

export class AndroidService {
}

export class AndroidTouchEventMonitor {
    swipeMonitor: Observable<TouchEvent>

    private isSwiping = false
    private startTime = 0
    private startPos: Position | null = null
    private endPos: Position | null = null

    constructor(androidMonitor: AndroidRawTouchMonitor) {

        androidMonitor.isTouchingUpdate
            .pipe(
                tap(({isTouching: touch}) => {
                    if (touch)
                        this.startTime = Date.now()
                    else {
                        this.isSwiping = false
                    }
                }),
                // tap(touch => console.log(`Touching update ${JSON.stringify(touch)}`))
            )
            .subscribe()

        androidMonitor.positionUpdate
            .pipe(
                tap(pos => {
                    if (!this.isSwiping) {
                        this.isSwiping = true // We'll only get position data if we're touching anyway
                        this.startPos = pos
                    } else {
                        this.endPos = pos
                    }
                }),
                // tap(pos => console.log(`Positional update ${JSON.stringify(pos)}`))
            )
            .subscribe()

        this.swipeMonitor = androidMonitor.isTouchingUpdate
            .pipe(
                filter(touch => !touch.isTouching),
                map((): TouchEvent => ({
                    startPos: this.startPos!,
                    endPos: this.endPos || this.startPos!,
                    duration: Date.now() - this.startTime
                })),
                tap(() => {
                    this.startPos = null // Nulling these to make checks for tap vs swipe easier later
                    this.endPos = null
                })
            )
    }
}

export class AndroidRawTouchMonitor {
    positionUpdate: Observable<Position>;
    isTouchingUpdate: Observable<{ isTouching: boolean; }>;

    private constructor(
        positionUpdate: Observable<Position>,
        isTouchingUpdate: Observable<{ isTouching: boolean }>
    ) {
        this.positionUpdate = positionUpdate
        this.isTouchingUpdate = isTouchingUpdate
    }

    // TODO : Fix all the check and everything here.
    static fromEventStream(streamSource: Observable<string>) {
        const posX = /ABS_MT_POSITION_X\s+([0-9a-f]{8})/;
        const posY = /ABS_MT_POSITION_Y\s+([0-9a-f]{8})/;
        const touch = /BTN_TOUCH\s+(UP|DOWN)/;

        enum msgType {
            xUpdate,
            yUpdate,
            touchUpdate,
            other
        }

        // Split a single source of truth to prevent duplicate event processing
        const sysMon = streamSource
            .pipe(
                groupBy(msg => {
                    if (touch.test(msg)) {
                        return msgType.touchUpdate
                    } else if (posX.test(msg)) {
                        return msgType.xUpdate
                    } else if (posY.test(msg)) {
                        return msgType.yUpdate
                    } else {
                        return msgType.other
                    }
                })
            )

        // Create individual pipes that share the same source observable
        const splitStream = (type: msgType) => sysMon.pipe(
            filter((splitStreams: GroupedObservable<msgType, string>) => splitStreams.key === type),
            mergeMap(typedStream => typedStream.pipe(share()) as Observable<string>)
        );

        let xPosPrimer: Observable<string> = splitStream(msgType.xUpdate);
        let yPosPrimer: Observable<string> = splitStream(msgType.yUpdate);
        let touchPrimer: Observable<string> = splitStream(msgType.touchUpdate);

        const xPosStream = xPosPrimer.pipe(
            map<string, { x: number }>(value => {
                const matches = [...posX.exec(value)!];
                const hexString = matches[1]
                const num = parseInt(hexString, 16)
                return {x: num}
            }),
            // tap(x => loggerService.info(`Emitting ${JSON.stringify(x)}`))
        );

        const yPosStream = yPosPrimer.pipe(
            map<string, { y: number }>(value => {
                const matches = [...posY.exec(value)!];
                const hexString = matches[1]
                const num = parseInt(hexString, 16)
                return {y: num}
            }),
            // tap(y => loggerService.info(`Emitting ${JSON.stringify(y)}`))
        );

        const positionUpdate = xPosStream
            .pipe(
                zipWith(yPosStream),
                map(positionsArr => ({
                    x: positionsArr[0].x,
                    y: positionsArr[1].y
                }))
            )

        const isTouchingUpdate = touchPrimer.pipe(
            map<string, { isTouching: boolean }>(value => ({
                isTouching: touch.exec(value)![1] == "DOWN"
            })),
            // tap(t => loggerService.info(`Emitting ${JSON.stringify(\t)}`))
        );


        return new AndroidRawTouchMonitor(positionUpdate, isTouchingUpdate)
    }
}