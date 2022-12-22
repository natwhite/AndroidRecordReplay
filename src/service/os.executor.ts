import {ChildProcessWithoutNullStreams, spawn} from "child_process";
import {fromEvent, Observable} from "rxjs";
import {
    filter,
    map,
    switchMap,
    tap,
} from "rxjs/operators";

export type StdStream<T = string> = {
    stdOut: Observable<T>;
    stdErr: Observable<string>;
    exit: Observable<number>;
}

enum OsType {
    Windows,
    Linux,
    Unix
}

export class OsExecutor {

    static WindowsExecute = (command: string, raw = false, lifeSpan = 0) =>
        OsExecutor.OSExecute(OsType.Windows, command, raw, lifeSpan)

    static LinuxExecute = (command: string, raw = false, lifeSpan = 0) =>
        OsExecutor.OSExecute(OsType.Linux, command, raw, lifeSpan)

    // static LinuxExecute(command: string, raw = false, lifeSpan = 0)
    private static OSExecute(osType: OsType, command: string, raw: boolean, lifeSpan: number): StdStream {
        // loggerService.info(`Executing system command '${command}' raw is ${raw ? 'true' : 'false'}`);

        let child: ChildProcessWithoutNullStreams
        if (raw)
            child = spawn(command)
        else
            switch (osType) {
                case OsType.Windows:
                    child = spawn('cmd', ['/c', command, ""]);
                    break
                case OsType.Linux:
                    child = spawn('bash', ['-c', command]);
                    break
                default:
                    throw Error("Failed to spawn child process! Unrecognized OS Type")
            }

        let timeoutId: NodeJS.Timeout;

        if (lifeSpan > 0)
            timeoutId = setTimeout(() => {
                child.removeAllListeners()
                // child.disconnect();
                child.kill();
            }, lifeSpan)

        return {
            stdOut: fromEvent(child.stdout, 'data')
                .pipe(
                    map<any, string>(data => String.fromCharCode.apply(null, data)),
                    map<string, string[]>(value => value.split('\n')),
                    switchMap((value: string[]) => value),
                    filter((value: string) => !!value),
                ),
            stdErr: fromEvent(child.stderr, 'data')
                .pipe(
                    map<any, string>(data => String.fromCharCode.apply(null, data)),
                    map<string, string[]>(value => value.split('\n')),
                    switchMap((value: string[]) => value),
                    filter((value: string) => !!value),
                ),
            exit: fromEvent(child, 'exit')
                .pipe(
                    map<any, number>(data => parseInt(data)),
                    tap(() => clearTimeout(timeoutId)),
                )
        };
    }
}
