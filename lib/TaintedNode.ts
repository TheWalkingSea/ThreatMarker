import * as t from '@babel/types';

export class TaintedNode {
    node: t.Node;
    tainted: Boolean;

    constructor(node: t.Node) {
        this.node = node;
        this.tainted = false;
    }

    setTainted(): void {
        this.tainted = true;
    }
}