function chainable() {
  const fn: any = () => fn
  fn.default = (v: number | string | boolean) => fn
  fn.optional = () => fn
  return fn
}
const enumChainable = () => {
  const fc: any = () => fc
  fc.default = (v: string) => fc
  fc.optional = () => fc
  fc.enum = () => fc
  return fc
}
const z: any = {
  object: (_o: any) => ({ default: () => ({}) }),
  string: () => chainable(),
  number: () => chainable(),
  boolean: () => chainable(),
  array: () => chainable(),
  enum: enumChainable,
}
z.default = z
export default z
