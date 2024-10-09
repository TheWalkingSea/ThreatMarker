declare interface TaintedLiteral {
    value?: any,
    isTainted: Boolean | undefined
}

declare interface TaintedVariable extends TaintedLiteral {
    kind: string
}