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
        this.type = type;
        this.name = name;
    }
}