export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@airlock/core') {
    return {
      shortCircuit: true,
      url: new URL('../packages/core/dist/index.js', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
