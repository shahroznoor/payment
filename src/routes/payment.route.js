const router = require("express").Router();
const stripeCtrl = require("../controllers/stripe.ctrl");
const verifyToken = require("../middlewares/validate-token");
const bodyParser = require("body-parser");

router.post("/stripe/payFund", verifyToken, stripeCtrl.paymentMethod);
router.get("/stripe/paymentList", verifyToken, stripeCtrl.transactions);

//admin

router.get(
  "/stripe/allUsersPaymentList",
  verifyToken,
  stripeCtrl.allUserstransactions
);

//webhook
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripeCtrl.webhook
);

//blockonimcs route
router.post("/blocknomics/Pay", verifyToken, stripeCtrl.blocknomicsOrder);

router.post("/blocknomics/checkout", verifyToken, stripeCtrl.confirmOrder);

module.exports = router;
