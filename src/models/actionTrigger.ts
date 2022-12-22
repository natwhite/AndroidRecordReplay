import {TouchEvent} from "./touch.event";

export interface ActionTrigger {
    triggerAssetPath: string
    touchEvents: TouchEvent[]
}