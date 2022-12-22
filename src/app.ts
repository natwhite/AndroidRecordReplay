import * as console from "console";
import {AndroidRawTouchMonitor, AndroidTouchEventMonitor} from "./service/android.monitor";
import {filter, map, share, tap, zipWith} from "rxjs/operators";
import {DataService} from "./service/data.service";
import {OsExecutor} from "./service/os.executor";
import {adb_path} from "./constants";
import * as path from "path";
import {firstValueFrom, lastValueFrom, pipe} from "rxjs";

export class App {
    static async initialize() {
        await App.launchRecorder()
        // await App.launchReplay("data/dataStore_1671709171402.json")
    }

    private static async launchReplay(dataFile: string) {
        const adbExec = (command: string) => OsExecutor.WindowsExecute(`${adb_path} ${command}`, false, 10000)
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        await DataService.loadDatastore(dataFile)
        const actionTriggers = DataService.getActionTriggers()

        for (const at of actionTriggers) {
            for (const te of at.touchEvents) {
                if (!te.startPos || !te.endPos) continue
                if (te.endPos == te.startPos)
                    await firstValueFrom(adbExec(`shell input tap ${te.startPos.x} ${te.startPos.y}`).exit)
                else
                    await firstValueFrom(adbExec(`shell input swipe ${te.startPos.x} ${te.startPos.y} ${te.endPos.x} ${te.endPos.y} ${te.duration}`).exit)
                // await delay(250)
            }
        }
    }

    private static async launchRecorder() {
        await DataService.loadDatastore()
        const adbExec = (command: string) => OsExecutor.WindowsExecute(`${adb_path} ${command}`, false, 10000)

        const stdMon = adbExec("shell getevent -lt /dev/input/event2")
        stdMon.stdErr
            .pipe(
                tap(error => {
                    throw Error(`Error while reading touch events : ${error}`)
                })
            ).subscribe()

        const rawMonitor = AndroidRawTouchMonitor.fromEventStream(stdMon.stdOut)
        const touchEventMonitor = new AndroidTouchEventMonitor(rawMonitor)

        rawMonitor.isTouchingUpdate
            .pipe(
                share(),
                filter(touch => !touch.isTouching),
                map(async () => {
                        const time = Date.now()
                        const fileName = `screencap_${time}.raw`
                        console.log(`Taking screenshot ${fileName}`)
                        // await firstValueFrom(adbExec(`shell screencap /sdcard/${fileName}`).exit)
                        const assetPath = path.join(__dirname, "../assets/", fileName);
                        // await firstValueFrom(adbExec(`pull /sdcard/${fileName} ${assetPath}`).exit)
                        // await firstValueFrom(adbExec(`rm /sdcard/${fileName}`).exit)
                        return assetPath
                    }
                ),
                zipWith(touchEventMonitor.swipeMonitor),
                map(async ([assetPathAsync, touchEvent]) => ({
                    touchEvents: [touchEvent],
                    triggerAssetPath: await assetPathAsync
                })),
                tap(async (actionTrigger) => {
                    await DataService
                        .addActionTrigger(await actionTrigger)
                        .saveDatabase()
                })
            )
            .subscribe()
    }
}
