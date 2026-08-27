function chainable() {
  const fn: any = () => fn
  fn.default = (v: number) => fn
  fn.optional = () => fn
  return fn
}
const z: any = {
  object: (_o: any) => ({ default: () => ({}) }),
  string: () => chainable(),
  number: () => chainable(),
  boolean: () => chainable(),
  array: () => chainable(),
  enum: () => chainable(),
}
z.default = z
export default z
