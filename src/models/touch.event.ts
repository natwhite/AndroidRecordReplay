import {Position} from "./position";

export interface TouchEvent {
    startPos: Position
    endPos: Position
    duration: number
}