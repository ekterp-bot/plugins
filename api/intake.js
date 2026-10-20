// Legacy agency intake is retired only in the storefront branch.
// Historical source remains in Git at 24f0574.
module.exports = function handler(request, response) {
  response.statusCode = 410;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({ok:false,sent:false,message:'This intake service has been retired. Visit /support for current contact information.'}));
};
