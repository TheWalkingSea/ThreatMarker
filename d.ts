import { Node, Expression } from '@babel/types';

declare global {
    interface TaintedLiteral {
        value?: any,
        node?: Expression,
        isTainted: Boolean | undefined
    }
    
}