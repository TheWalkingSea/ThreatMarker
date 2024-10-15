export class ReferenceException extends Error {
    constructor(name: string) {
        super(`${name} is not declared and may be tainted.`);
    }
}