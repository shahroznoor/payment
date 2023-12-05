const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const cors = require("cors");
const logger = require("morgan");

dotenv.config();
const PORT = process.env.PORT || 3000;
// app.use(cookieParser());
app.use(logger("dev"));
// allow cors requests from any origin and with credentials
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

// middlewares
app.use(express.json()); // for body parser

//routes import
const userRoute = require("./src/routes/user.route");
const paymentRoute = require("./src/routes/payment.route");

//defining  routes
app.use("/api/v1/user", userRoute);

app.use("/api/v1/payment", paymentRoute);

app.use("*", (req, res) => {
  res.status(400).json({
    status: "failed",
    message: "You landed on Mars",
  });
});
// connect to db
// Database connection
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URI, {});

console.log(`[*] Databae connected`);

// middlewares
app.use(express.json()); // for body parser

// Set the timeout to 10 minutes (600,000 milliseconds)
app.timeout = 600000;

app.listen(PORT, () => console.log(`server is running on PORT ${PORT}...`));

process.on("uncaughtException", (err) => {
  console.log("[-] uncaughtException: ", err);
  // process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.log("[-] unhandledRejection: ", err);
  // process.exit(1);
});
