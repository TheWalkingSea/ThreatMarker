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

    assign(name: string, value: any, isTainted: Boolean | undefined = undefined): void {
        if (!this.record.has(name)) throw new ReferenceException(name);

        if (isTainted === undefined) {
            // @ts-ignore - Explicitly above
            isTainted = this.record.get(name).isTainted;
        }

        this.record.set(name, {
            value: value,
            isTainted: isTainted
        });
    }

    resolve(name: string): TaintedLiteral {
        if (this.record.has(name)) {
            // @ts-ignore - Explicitly handled
            return this.record.get(name);
        } else if (!this.parent) {
            throw new ReferenceException(name)
        } else {
            return this.parent.resolve(name);
        }
    }
}