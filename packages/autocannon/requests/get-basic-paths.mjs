export default [
  '/',
  '/foo',
  '/bar',
  '/bar/baz/'
].map((p) => {
  return {
    method: 'GET',
    path: p,
    headers: {}
  };
});
