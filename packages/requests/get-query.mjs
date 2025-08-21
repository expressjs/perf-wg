export default [
  '/',
  '/?foo=boo',
  '/?foo=boo&bar=far',
  '/?foz=baz&foz=faz'
].map((p) => {
  return {
    method: 'GET',
    path: p,
    headers: {}
  };
});
