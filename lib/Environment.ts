import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";

export class Environment {

    record: Map<string, TaintedLiteral>;
    parent: Environment | null;
    taint_parent_writes: boolean;

    constructor(record = new Map(), parent = null, taint_parent_writes = false) {
        this.record = record;
        this.parent = parent;
        this.taint_parent_writes = taint_parent_writes; // For tainted if blocks, any writes outside of block is auto tainted
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
        if (!this.record.has(name)) throw new ReferenceException(name); // Undefined

        let env = this._resolve_parent(name); // Get the environment with the identifier defined

        if (this.taint_parent_writes && env.parent !== this) { // If parent is not the current env & taint_parent_writes is defined, set taint to identifier
            env.record.set(name, {
                isTainted: true
            });
            return;
        }

        if (isTainted === undefined) { // If isTainted is undefined, implicitly flow taint from identifier
            let entry = env.record.get(name) as TaintedLiteral; // Gets identifier data
            isTainted = entry.isTainted;
        }

        env.record.set(name, {
            value: value,
            isTainted: isTainted
        });
    }

    resolve(name: string): TaintedLiteral {
        let env: Environment = this._resolve_parent(name);
        return env.record.get(name) as TaintedLiteral;
    }

    _resolve_parent(name: string): Environment {
        if (this.record.has(name)) {
            return this; // Checked if it exists above
        } else if (!this.parent) { // If parent is null, id is undefined
            throw new ReferenceException(name)
        } else { // If parent exists, try to resolve
            return this.parent._resolve_parent(name);
        }
    }
}