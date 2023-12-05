const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Joi = require("joi");
const User = require("../model/User.model");
const BlockonomicsOrder = require("../model/blockonomicsOrder.model");
const { sendEmail } = require("../utils/email");
const axios = require("axios").default;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const WebSocket = require("ws");

exports.paymentMethod = catchAsync(async (req, res, next) => {
  const schema = Joi.object({
    amount: Joi.number().required(),
  });

  const { value, error } = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) return next(new AppError(error.message, 400));

  const user = await User.findById(req.user.id);

  const customer = user.stripeCustomerId;

  const product = await stripe.products.create({
    name: "Funds",
  });

  const amountinDollor = value.amount * 100;
  const price = await stripe.prices.create({
    unit_amount: amountinDollor,
    currency: "usd",
    product: product.id,
  });

  const session = await stripe.checkout.sessions.create({
    success_url: "https://dashboard.yourapp.com/dashboard",
    customer: customer,
    customer_email: customer.email,
    line_items: [{ price: price.id, quantity: 1 }],
    mode: "payment",
  });
  res.status(200).json(session);
});

exports.transactions = catchAsync(async (req, res, next) => {
  const customer = await User.findById(req.user.id);
  const sessions = await stripe.checkout.sessions.list({
    customer: customer.stripeCustomerId,
  });

  res.status(200).send(sessions);
});

exports.allUserstransactions = catchAsync(async (req, res, next) => {
  const role = await User.findById(req.user.id);
  if (role.role == "admin") {
    const sessions = await stripe.checkout.sessions.list();

    res.status(200).send(sessions);
  } else {
    return res
      .status(400)
      .json({ error: true, message: "Only admin can access this route" });
  }
});

exports.webhook = catchAsync(async (req, res, next) => {
  let event;

  event = req.body;

  if (event.type === "checkout.session.completed") {
    const customer = event.data.object.customer;
    const user = await User.findOne({
      stripeCustomerId: customer,
    });
    const htmlBody = ` <p>Dear ${user.name},</p>
    <br>
    <p>Thank you for choosing yourapp.com! We're excited to confirm your recent purchase and extend our heartfelt appreciation for your trust in our services.</p>
    <br>
    <p>Here are the details of your purchase:</p>
    <ul>
        <li>Order Number: ${event.data.object.id}</li>
        <li>Total Amount: ${event.data.object.amount_total}</li>
        <li>Payment Method: Card</li>
    </ul>
    <p>Your support means a lot to us. We're dedicated to ensuring your satisfaction with our products/services. If you have any questions regarding your purchase or need assistance, feel free to contact our support team at <a href="mailto:admin@yourapp.com">admin@yourapp.com</a>. We're here to help you every step of the way.</p>
    <br>
    <p>As a valued customer, your feedback is invaluable. Share your experience with us, and let us know how we can continue improving our services to meet your needs better.</p>
    <br>
    <p>Thank you once again for choosing yourapp.com. We look forward to serving you again in the future.</p>
    <br>
    <p>Best Regards,</p>
    <p>The yourapp.com Team</p>`;

    await sendEmail(
      user.email,
      "Thank You for Your Purchase on yourapp.com!",
      htmlBody,
      "admin@yourapp.com"
    );
    const amount = event.data.object.amount_subtotal / 100;
    var updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { balance: amount } },
      { new: true }
    );
  }
  res.send(updatedUser);
});

//BLOCKONIMICS
exports.blocknomicsOrder = catchAsync(async (req, res, next) => {
  try {
    const totalAmount = req.body.amount;
    const url =
      "https://www.blockonomics.co" +
      process.env.PRICE_API +
      process.env.currencyISO;

    // Get the current BTC rate
    const response = await axios.get(
      "https://www.blockonomics.co/api/price?currency=USD"
    );
    const btcRate = response.data.price;

    // Calculate the expected BTC based on the total subscription amount
    const expectedBtc = Math.round((totalAmount / btcRate) * 1e8) / 1e8;

    // Get a new BTC address from Blockonomics
    const addressUrl = "https://www.blockonomics.co/api/new_address";
    const addressResponse = await axios.post(
      addressUrl,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "blockonomics",
          Accept: "application/json",
          Authorization: `Bearer api_key`,
        },
      }
    );

    const address = addressResponse.data.address;

    // Create a new subscription order with status Pending
    const orderDoc = {
      orderPaymentAddress: address,
      user_id: req.user.id,
      orderPaymentGateway: "Blockonomics",
      orderExpectedBtc: expectedBtc,
      orderTotal: totalAmount,
      orderStatus: "Pending",
      orderDate: new Date(),
    };
    await BlockonomicsOrder.create(orderDoc);
    return res.status(200).json({
      error: null,
      orderDoc,
      message: "Please transfer the funds on given address",
    });
  } catch (error) {
    console.error("Error during subscription:", error);
    res.status(500).json({ err: "Error during subscription" });
  }
});

// 10 minute timer is set , user has to pay within 10 minutes on given address , after 10 minutes it will expire
exports.confirmOrder = catchAsync(async (req, res, next) => {
  const address = req.body.orderPaymentAddress;
  const status = req.body.status;
  const amount = req.body.amountInBTC;
  var blSocket = new WebSocket("wss://www.blockonomics.co/payment/" + address);
  blSocket.onopen = function (msg) {};
  var timeOutMinutes = 10;
  setTimeout(function () {
    blSocket.close();
    return res.status(400).json({
      error: true,
      message: "Payment expired",
    });
  }, 1000 * 60 * timeOutMinutes);

  blSocket.onmessage = async function (msg) {
    var data = JSON.parse(msg.data);
    if (data.status === 0 || data.status === 1 || data.status === 2) {
      if (status == "Paid") {
        const order = await BlockonomicsOrder.findOne({
          orderPaymentAddress: address,
        });
        if (amount >= order.orderExpectedBtc) {
          await BlockonomicsOrder.findByIdAndUpdate(
            {
              _id: order._id,
            },
            {
              $set: {
                orderStatus: "Paid",
              },
            },
            { multi: false }
          );
          await User.findByIdAndUpdate(
            {
              _id: req.user.id,
            },
            { $inc: { balance: order.orderTotal } },
            { multi: false }
          );
          const user = await User.findById(req.user.id);
          const htmlBody = ` <p>Dear ${user.name},</p>
        <br>
        <p>Thank you for choosing yourapp.com! We're excited to confirm your recent purchase and extend our heartfelt appreciation for your trust in our services.</p>
        <br>
        <p>Here are the details of your purchase:</p>
        <ul>
            <li>Order Number: ${order.orderPaymentId}</li>
            <li>Total Amount In USD: ${order.orderTotal}</li>
            <li>Total Amount In BTC: ${amount}</li>
            <li>Payment Method: BTC</li>
        </ul>
        <p>Your support means a lot to us. We're dedicated to ensuring your satisfaction with our products/services. If you have any questions regarding your purchase or need assistance, feel free to contact our support team at <a href="mailto:admin@yourapp.com">admin@yourapp.com</a>. We're here to help you every step of the way.</p>
        <br>
        <p>As a valued customer, your feedback is invaluable. Share your experience with us, and let us know how we can continue improving our services to meet your needs better.</p>
        <br>
        <p>Thank you once again for choosing yourapp.com. We look forward to serving you again in the future.</p>
        <br>
        <p>Best Regards,</p>
        <p>The yourapp.com Team</p>`;
          await sendEmail(
            user.email,
            "Thank You for Your Purchase on yourapp.com!",
            htmlBody,
            "admin@yourapp.com"
          );
          res.status(200).json({
            error: null,
            message: "Transaction Successfull",
          });
        }
      }
    }
  };
});
