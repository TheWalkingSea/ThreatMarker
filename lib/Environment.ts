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
        if (this.record.has(name)) throw new DeclarationException(name);
        this.record.set(name, {
            value: undefined,
            isTainted: false
        }); // Assumed to be untainted
    }

    assign(name: string, { value, isTainted }: TaintedLiteral): void {
        if (!this.record.has(name)) throw new ReferenceException(name);

        if (isTainted === undefined) {
            isTainted = (this.record.get(name) as TaintedLiteral).isTainted;
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
}