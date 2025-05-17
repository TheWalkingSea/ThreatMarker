import { DeobfuscatorException } from "./DeobfuscatorException";

export class ReferenceException extends DeobfuscatorException {
    constructor(name: string) {
        super(`${name} is not declared and may be tainted.`);
    }
}