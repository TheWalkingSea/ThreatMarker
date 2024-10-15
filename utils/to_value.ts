import * as t from '@babel/types';


export function Value(value: any): t.Literal {
    if (typeof value === 'string') {
        return t.stringLiteral(value);  // Create a numeric literal
    } else if (typeof value === 'number') {
        return t.numericLiteral(value);  // Create a numeric literal
    } else if (typeof value === 'boolean') {
        return t.booleanLiteral(value);  // Create a boolean literal
    } else if (value === null) {
        return t.nullLiteral();  // Handle null literals
    } else {
        throw new Error(`Unsupported type for value: ${typeof value}`);
    }
}


// Technically returns t.Node | t.Literal but babel hasn't updated the Expression statements to accept said types
export function get_repr(tl: TaintedLiteral): t.Expression {
    if (!tl?.node && !tl?.value) throw new Error(`Representation of TaintedLiteral: ${tl} not defined`)

    return tl?.node || Value(tl.value);
}