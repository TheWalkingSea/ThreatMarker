import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";

export class Environment {
    record: Map<string, any>;
    parent: Environment | null;

    constructor(record = new Map(), parent = null) {
        this.record = record;
        this.parent = parent;
    }

    declare(name: string): void {
        if (this.record.has(name)) throw new DeclarationException(name);
        this.record.set(name, undefined);
    }

    assign(name: string, value: any): void {
        if (!this.record.has(name)) throw new ReferenceException(name);
        this.record.set(name, value);
    }

    get(name: string): any {
        if (this.record.get(name)) {
            return this.record.get(name);
        } else if (!this.parent) {
            throw new ReferenceException(name)
        } else {
            this.parent.get(name);
        }
    }
}