import { Environment } from "./Environment";

export class ExecutionContext {
    thisValue: any;
    environment: Environment;

    constructor(thisValue: any, environment: Environment) {
        this.thisValue = thisValue;
        this.environment = environment;
    }
}