import * as t from '@babel/types';


export function Value(value: any): t.Literal | t.Expression {
    if (typeof value === 'string') {
        return t.stringLiteral(value);  // Create a numeric literal
    } else if (typeof value === 'number') {
        return t.numericLiteral(value);  // Create a numeric literal
    } else if (typeof value === 'boolean') {
        return t.booleanLiteral(value);  // Create a boolean literal
    } else if (value === null) {
        return t.nullLiteral();  // Handle null literals
    } else if (value instanceof RegExp) {
        return t.regExpLiteral(value.source, value.flags);
    } else if (typeof value == 'object') {
        return t.arrayExpression(
            value.map((x: TaintedLiteral) => get_repr(x))
        );
    } else if (typeof value == 'function') {
        return value;
    }
    else {
        console.debug(value);
        console.debug(typeof value);
        throw new Error(`Unsupported type for value: ${value}, type: ${typeof value}`);
    }
}


// Technically returns t.Node | t.Literal but babel hasn't updated the Expression statements to accept said types
export function get_repr(tl: TaintedLiteral): t.Expression {
    if (!tl.hasOwnProperty('node') && !tl.hasOwnProperty('value')) throw new Error(`Representation of TaintedLiteral: ${JSON.stringify(tl)} not defined. Node or value undefined`)

    return tl?.node || Value(tl.value);
}