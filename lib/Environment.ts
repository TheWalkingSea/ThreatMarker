import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";
import * as t from '@babel/types';
export class Environment {

    record: Map<string, TaintedLiteral>;
    parent: Environment | null;
    taint_parent_writes: boolean;
    taint_parent_reads: boolean;
    ignore_reference_exception: boolean

    constructor(
        record = new Map(), 
        parent: Environment | null = null, 
        taint_parent_writes = false, 
        taint_parent_reads = false, 
        ignore_reference_exception = false
    ) {
        this.record = record;
        this.parent = parent;
        this.taint_parent_writes = taint_parent_writes; // For tainted if blocks, any writes outside of block is auto tainted
        this.taint_parent_reads = taint_parent_reads; // For function blocks, any reads outside of Environment is auto tainted
        this.ignore_reference_exception = ignore_reference_exception; // For function blocks running in isolation, any parent references that are undefined are ignored
    }

    is_tainted_environment(): Boolean {
        if (this.parent) {
            return this.taint_parent_writes || this.parent.is_tainted_environment();
        }
        
        // If no parent, just return taint_parent_writes
        return this.taint_parent_writes;
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

        if (this.taint_parent_writes && env !== this) { // If parent is not the current env & taint_parent_writes is defined, set taint to identifier
            env.record.set(name, {
                node: t.identifier(name),
                isTainted: true
            });
            return;
        }

        if (isTainted === undefined) { // If isTainted is undefined, implicitly flow taint from identifier
            let entry = env.record.get(name) as TaintedLiteral; // Gets identifier data
            isTainted = entry.isTainted;
        }
        
        if (value !== undefined) {
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
        const env: Environment = this._resolve_parent(name); // Get the correct environment

        // Check for taint_parent_reads
        if (this.taint_parent_reads && env !== this) { // If parent is not the current env & taint_parent_reads is defined, return tainted identifier
            return {
                node: t.identifier(name),
                isTainted: true
            }
        }

        return env.record.get(name) as TaintedLiteral;
    }

    get_deep_copy(records: Map<string, TaintedLiteral> = new Map()): Map<string, TaintedLiteral> {
        this.record.forEach((value, key) => {
            records.set(key, value);
        })
        
        if (!this.parent) return records;

        return this.parent.get_deep_copy(records);
    }

    _resolve_parent(name: string): Environment {
        if (this.record.has(name)) {
            return this; // Checked if it exists above
        } else if (!this.parent) { // If parent is null, id is undefined
            if (this.ignore_reference_exception) { // declare variable as tainted and return environment
                this.record.set(name, {
                    node: t.identifier(name),
                    isTainted: true
                });
                return this;
            }
            
            // error if special flag is not set
            throw new ReferenceException(name)
        } else { // If parent exists, try to resolve
            return this.parent._resolve_parent(name);
        }
    }

}