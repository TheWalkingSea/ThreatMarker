import * as t from '@babel/types';


export function Value(value: any): t.Literal {
    if (typeof value === 'number') {
        return t.numericLiteral(value);  // Create a numeric literal
    } else if (typeof value === 'boolean') {
        return t.booleanLiteral(value);  // Create a boolean literal
    } else if (value === null) {
        return t.nullLiteral();  // Handle null literals
    } else {
        throw new Error(`Unsupported type for value: ${typeof value}`);
    }
}