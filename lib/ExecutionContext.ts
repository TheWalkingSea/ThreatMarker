import { is } from "@babel/types";
import { Environment } from "./Environment";

export class ExecutionContext {
    thisValue: any;
    environment: Environment;
    type: string;
    name: string;

    constructor(thisValue: any, environment: Environment, type: string="", name: string="") {
        this.thisValue = thisValue;
        this.environment = environment;
        this.type = type; // Node type encapsulating environment
        this.name = name; // Used for LabeledStatement
    }
}