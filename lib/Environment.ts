import { ReferenceException } from "./ReferenceException";
import { DeclarationException } from "./DeclarationException";
import * as t from '@babel/types';
export class Environment {

    private record: Map<string, TaintedLiteral>;
    private parent: Environment | null;
    taint_parent_writes: boolean;
    taint_parent_reads: boolean;
    private ignore_reference_exception: boolean

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


    getLocalRecord(): Map<string, TaintedLiteral> {
        return this.record;
    }

    is_tainted(): Boolean {
        return this.taint_parent_writes;
    }

    is_tainted_environment(limit: Environment | null=null): Boolean {
        if (limit && this === limit) {
            return false;
        }

        if (this.parent) {
            return this.is_tainted() || this.parent.is_tainted_environment();
        }
        
        // If no parent, just return taint_parent_writes
        return this.is_tainted()
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

        if (value && node) {
            env.record.set(name, {
                node: node,
                value: value,
                isTainted: isTainted
            })
        }
    }

    setTaint(name: string, isTainted: Boolean): void {
        // Sets the taint of the identifier without modifying the value / node

        let env = this._resolve_parent(name); // Get the environment with the identifier defined

        let entry = env.record.get(name);
        env.record.set(name, {
            node: entry?.node ? entry.node : t.identifier(name),
            isTainted: isTainted
        })
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

    /**
     * Assigns a value to a member expression property (e.g., obj[key] = value)
     * Handles taint propagation for parent scope objects
     * @param objectName - The name of the object variable
     * @param propertyKey - The property key to assign (NOT A NODE)
     * @param value - The TaintedLiteral value to assign
     * @param propertyNode - Optional node representation of the member expression
     */
    assignMemberProperty(objectName: string, propertyKey: any, value: TaintedLiteral, propertyNode?: t.Node): void {
        let env = this._resolve_parent(objectName); // Get environment where object is defined
        let object_tl = env.record.get(objectName) as TaintedLiteral;

        // Case 1: OBJECT is already tainted -> Can't set property of tainted object -> return taint
        if (object_tl.isTainted) {
            return;
        }

        // Case 2: PropertyKey is null or undefined (meaning .value is null)
        if (propertyKey === null || propertyKey === undefined) {
            return;
        }

        // Case 3: Value is tainted -> return taint
        if (propertyKey.isTainted) {
            return;
        }

        // Case 4: OBJECT is NOT tainted & key is CONSTANT
        // If taint_parent_writes is true and object is in parent scope, taint the property
        if (this.taint_parent_writes && env !== this) {
            (object_tl.value)[propertyKey] = {
                node: propertyNode,
                isTainted: true
            };
            // Set node on object to prevent inlining when it contains tainted elements
            env.record.set(objectName, {
                node: t.identifier(objectName),
                value: object_tl.value,
                isTainted: false
            });
        } else {
            // Normal assignment
            (object_tl.value)[propertyKey] = value;
        }
    }

    /**
     * Assigns a value to a nested member property (e.g., arr[0][1] = value)
     * Handles both tainted and untainted environments, navigating through the property path
     * to reach the final property to assign.
     *
     * @param objectName - The name of the root identifier (e.g., "arr")
     * @param propertyPath - Array of property keys to navigate (e.g., [0, 1] for arr[0][1]); must be of type TaintedLiteral[]
     * @param value - The TaintedLiteral value to assign
     * @param propertyNode - Optional AST node for the property (used in tainted environments)
     */
    assignNestedMemberProperty(objectName: string, propertyPath: TaintedLiteral[], value: TaintedLiteral, propertyNode?: t.Expression): void {
        let env = this._resolve_parent(objectName);
        let root_object_tl = env.record.get(objectName) as TaintedLiteral;

        // Case 1: Object is tainted; return
        if (root_object_tl.isTainted) {
            return;
        }

        // Navigate to the **parent** of the final property
        let target_object = root_object_tl;
        for (let i = 0; i < propertyPath.length - 1; i++) {
            // Case 2.1: Property path is tainted -> Taint target_object
            if (propertyPath[i].isTainted) {
                target_object.isTainted = true;
                target_object.value = undefined;
                target_object.node = propertyNode || value.node;
                return;
            }
            // Case 2.2: We run into a tainted target object; return
            if (target_object.isTainted) {
                return;
            }
            // Case 2.3: Both target_object and propertyPath[i] are untainted -> We can index!
            target_object = (target_object.value)[propertyPath[i].value];

            // Case 2.4: target_object is undefined -> must wrap in a TaintedLiteral
            if (target_object === undefined) {
                target_object = {
                    value: undefined,
                    isTainted: false
                }
            }
        }

        const final_property = propertyPath[propertyPath.length - 1];

        // Case 3.1: final_property is tainted -> Taint target_object
        if (final_property.isTainted) {
                target_object.isTainted = true;
                target_object.value = undefined;
                target_object.node = propertyNode || value.node;
                return;
        }

        // Case 3.2: target_object is tainted; return
        if (target_object.isTainted) {
            return;
        }

        // Case 3.3: target_object and final_property are untainted -> set value
        // If taint_parent_writes is true and object is in parent scope, taint the property
        if (this.taint_parent_writes && env !== this) {
            (target_object.value)[final_property.value] = {
                node: propertyNode || value.node,
                isTainted: true
            };
            // __Set node__ on root object to prevent inlining when it contains tainted elements
            // While `objectName` is "untainted", there is a variable in it that is -> Cannot be correctly rendered
            env.record.set(objectName, {
                node: t.identifier(objectName),
                value: root_object_tl.value,
                isTainted: false // Guarenteed by Case 1
            });
        } else {
            // Normal assignment
            (target_object.value)[final_property.value] = value;
        }
    }

}