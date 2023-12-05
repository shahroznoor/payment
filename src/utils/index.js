const mongoose = require("mongoose");

const isMongoId = (id) => {
  return function (req, res, next) {
    let paramId = req.params[`${id}`];
    if (!mongoose.isValidObjectId(paramId))
      return res
        .status(400)
        .json({ status: "failed", message: `Invalid ${id}: ${paramId}` });
    next();
  };
};

const checkPassword = (p) => {
  const re = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
  return re.test(p);
};

const checkEmail = (p) => {
  const re =
    /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  let email = String(p).toLowerCase();
  return re.test(email);
};

module.exports = {
  isMongoId,
  checkPassword,
  checkEmail,
};
