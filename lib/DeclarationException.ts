export class DeclarationException extends Error {
    constructor(name: string) {
        super(`${name} is already declared in this scope.`);
    }
}