import { NodePath } from '@babel/traverse';

export class TaintedPath {
    path: NodePath;
    tainted: Boolean;

    constructor(path: NodePath) {
        this.path = path;
        this.tainted = false;
    }

    setTainted(): void {
        this.tainted = true;
    }
}