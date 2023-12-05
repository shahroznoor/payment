const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    fullname: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: "user",
    },
    stripeCustomerId: { type: String },
    resetPassOtp: { type: Number },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
