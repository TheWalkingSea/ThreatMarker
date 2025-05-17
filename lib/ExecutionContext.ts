import { is } from "@babel/types";
import { Environment } from "./Environment";

export class ExecutionContext {
    thisValue: any;
    environment: Environment;

    constructor(thisValue: any, environment: Environment, is_breakable: boolean=false) {
        this.thisValue = thisValue;
        this.environment = environment;
    }
}