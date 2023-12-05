const router = require("express").Router();
const userCtrl = require("../controllers/user.ctrl");
const verifyToken = require("../middlewares/validate-token");

router.post("/signup", userCtrl.signUp);
router.post("/login", userCtrl.login);
router.get("/userinfo", verifyToken, userCtrl.userInfo);
router.patch("/updateuserinfo", verifyToken, userCtrl.updateUserInfo);

// Passwords
router.post("/forgotPassword", userCtrl.forgotPassword);
router.post("/resetPassword", userCtrl.resetPassword);

//admin routes
router.get("/getAllUsers", verifyToken, userCtrl.getAllUsers);
router.patch("/updateUser/:id", verifyToken, userCtrl.updateUser);
router.delete("/deleteUser/:id", verifyToken, userCtrl.deleteUser);

module.exports = router;
