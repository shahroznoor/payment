const mongoose = require("mongoose");
const BlockonomicsSchema = new mongoose.Schema(
  {
    orderPaymentAddress: {
      type: String,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    orderPaymentGateway: {
      type: String,
      required: true,
    },
    orderExpectedBtc: {
      type: String,
      required: true,
    },
    orderTotal: {
      type: String,
      required: true,
    },
    orderStatus: {
      type: String,
    },
    orderDate: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BlockonomicsOrder", BlockonomicsSchema);
