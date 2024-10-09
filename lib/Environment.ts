import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";

export class Environment {

    record: Map<string, TaintedVariable>;
    parent: Environment | null;

    constructor(record = new Map(), parent = null) {
        this.record = record;
        this.parent = parent;
    }

    declare(name: string, kind: string): void {
        if (this.record.has(name)) throw new DeclarationException(name);
        this.record.set(name, {
            value: undefined,
            isTainted: false,
            kind: kind
        }); // Assumed to be untainted
    }

    assign(name: string, { value, isTainted }: TaintedLiteral): void {
        if (!this.record.has(name)) throw new ReferenceException(name);

        let entry = this.record.get(name) as TaintedVariable;

        if (isTainted === undefined) {
            isTainted = entry.isTainted;
        }

        this.record.set(name, {
            value: value,
            isTainted: isTainted,
            kind: entry.kind // Inherit kind - Only defined at declaration
        });
    }

    resolve(name: string): TaintedVariable {
        if (this.record.has(name)) {
            return this.record.get(name) as TaintedVariable; // Checked if it exists above
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