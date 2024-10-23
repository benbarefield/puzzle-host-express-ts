export default function(userIdHolder) {
  return (req, res, next) => {
    req.authenticatedUser = userIdHolder.id;
    next();
  };
}
