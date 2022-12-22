import fs from 'fs';

export class FileService {
    private static indent = 4;

    static async fileExists(path: string) {
        return new Promise<boolean>((resolve, reject) => {
            try {
                resolve(fs.existsSync(path))
            } catch (err) {
                reject(err);
            }
        });
    }

    static async loadFile<T extends object>(fileName: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            fs.readFile(fileName, (err, data) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                }

                const result: T = {} as T;

                Object.assign(result, JSON.parse(data.toString()));
                // console.log(`Configuration : ${JSON.stringify(Object.assign({}, Configuration))}`);
                console.log(`Loaded data file ${fileName} successfully.`);
                // console.log(JSON.stringify(result));
                return resolve(result);
            });
        });
    };

    static saveFile<T>(fileName: string, fileData: T) {
        return new Promise<boolean>((resolve, reject) => {
            fs.writeFile(fileName, JSON.stringify(Object.assign({}, fileData), null, FileService.indent), (err) => {
                if (err) {
                    reject(err);
                    console.error(err);
                }

                console.log(`Saved object to ${fileName} successfully`);
                resolve(true);
            });
        });
    }
}
