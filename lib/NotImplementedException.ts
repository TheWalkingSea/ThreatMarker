export class NotImplementedException extends Error {
    constructor(name: string) {
        super(`${name} has not been implemented`);
    }
}