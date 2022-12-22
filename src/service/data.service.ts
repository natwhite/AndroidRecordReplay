import {FileService} from "./file.service";
import {ActionTrigger} from "../models/actionTrigger";

class DataStorage {
    public static actionTriggers: ActionTrigger[] = [];
}

const dataFile = `data/dataStore_${Date.now()}.json`;

export class DataService {
    public static async loadDatastore(altDataFile = dataFile): Promise<DataStorage> {
        const dataStoreExists = await FileService.fileExists(altDataFile);

        if (!dataStoreExists) {
            await DataService.saveDatabase();
        } else {
            const dataStore = await FileService.loadFile<DataStorage>(altDataFile);
            Object.assign(DataStorage, dataStore);
        }

        return DataService;
    };

    public static async saveDatabase(): Promise<void> {
        await FileService.saveFile<DataStorage>(dataFile, DataStorage);
    };

    // NOTE : We are using slice here to create a copy of the array before releasing it so we don't expose the underlying DataStore

    // public static getTouchEvents(): readonly TouchEvent[] {
    //     return DataStorage.touchEvents.slice();
    // }

    // NOTE : Functions that affect the state of the DataStorage return the DataService to allow command chaining.

    // public static addTouchEvent(touchEvent: TouchEvent): DataService {
    //     DataStorage.touchEvents.push(touchEvent);
    //     return DataService;
    // };

    public static addActionTrigger(actionTrigger: ActionTrigger): DataService {
        DataStorage.actionTriggers.push(actionTrigger);
        return DataService;
    };

    public static getActionTriggers(): ActionTrigger[] {
        return DataStorage.actionTriggers;
    };

    saveDatabase = () => DataService.saveDatabase();
}
