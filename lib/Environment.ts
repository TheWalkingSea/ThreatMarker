import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";

export class Environment {

    record: Map<string, TaintedLiteral>;
    parent: Environment | null;

    constructor(record = new Map(), parent = null) {
        this.record = record;
        this.parent = parent;
    }

    declare(name: string): void {
        // We will disregard this error due to assumptions about the program
        // if (this.record.has(name)) throw new DeclarationException(name);
        
        this.record.set(name, {
            value: undefined,
            isTainted: false
        }); // Assumed to be untainted
    }

    assign(name: string, { value, isTainted }: TaintedLiteral): void {
        if (!this.record.has(name)) throw new ReferenceException(name);

        let entry = this.record.get(name) as TaintedLiteral;

        if (isTainted === undefined) {
            isTainted = entry.isTainted;
        }

        this.record.set(name, {
            value: value,
            isTainted: isTainted
        });
    }

    resolve(name: string): TaintedLiteral {
        if (this.record.has(name)) {
            return this.record.get(name) as TaintedLiteral; // Checked if it exists above
        } else if (!this.parent) {
            throw new ReferenceException(name)
        } else {
            return this.parent.resolve(name);
        }
    }

    has(name: string): Boolean {
        return this.record.has(name);
    }
}