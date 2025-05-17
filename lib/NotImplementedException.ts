import { DeobfuscatorException } from "./DeobfuscatorException";

export class NotImplementedException extends DeobfuscatorException {
    constructor(name: string) {
        super(`${name} has not been implemented`);
    }
}