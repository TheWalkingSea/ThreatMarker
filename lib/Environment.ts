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

    assign(name: string, { value, node, isTainted }: TaintedLiteral): void {
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
        
        if (value) {
            env.record.set(name, {
                value: value,
                isTainted: isTainted
            });
        } else if (node) {
            env.record.set(name, {
                node: node,
                isTainted: isTainted
            });
        }

        if (value && node) throw new Error(`value and node are both defined when assigning ${name}`)
    }

    setTaint(name: string, isTainted: Boolean): void {
        // Sets the taint of the identifier without modifying the value / node

        let env = this._resolve_parent(name); // Get the environment with the identifier defined

        let entry = env.record.get(name);
        if (entry?.value) {
            env.record.set(name, {
                value: entry.value,
                isTainted: isTainted
            })
        } else if (entry?.node) {
            env.record.set(name, {
                node: entry.node,
                isTainted: isTainted
            })
        }

        if (entry?.value && entry?.node) throw new Error(`value and node are both defined when trying to set taint ${name}`)        
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