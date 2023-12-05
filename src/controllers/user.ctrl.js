const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const User = require("../model/User.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { checkEmail, checkPassword } = require("../utils");
const { sendEmail } = require("../utils/email");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");

exports.signUp = catchAsync(async (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string()
      .regex(/^[._@a-z0-9]+$/)
      .label("email")
      .messages({
        "string.pattern.base":
          "Email should only contain alphanumeric and these characters i.e. _ .",
      })
      .required(),
    password: Joi.string().min(8).required(),
    fullname: Joi.string(),
    phone: Joi.string(),
    country: Joi.string(),
    role: Joi.string(),
  });
  const { value, error } = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) return next(new AppError(error.message, 400));

  if (!checkEmail(value.email))
    return res.status(400).json({
      error: true,
      message: "Invalid Email Address",
    });

  if (!checkPassword(value.password))
    return res.status(400).json({
      error: true,
      message:
        "Password should be 8 characters long and should contain upper case, number and special character",
    });

  const user = await User.findOne({ email: value.email });

  if (user && user.email === value.email)
    return res.status(400).json({
      error: true,
      message: "Email Already exists. Use a different Email",
    });

  // Password hashing
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(value.password, salt);

  const newUser = await User.create({
    ...value,
    ...{
      password: hashedPassword,
    },
  });

  // appending user info on google docs
  const name = value.name;
  const email = value.email;
  const phone = "00000";
  const url = "yourapp.com";
  const message = "new User";
  const response = await axios.post(
    "{{google docs ur}}",
    {
      name,
      phone,
      email,
      url,
      message,
    },
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  if (response.data.success == true) {
    console.log("Data sent successfully:", response.data);
  }

  const token = jwt.sign(
    // payload data
    {
      email: newUser.email,
      id: newUser._id,
    },
    process.env.TOKEN_SECRET
  );

  const htmlBody = `<p>Dear ${value.name},</p>
    <br>
    <p>Congratulations and welcome to Yourapp.com! You've successfully registered and joined our community. Get ready for an exciting journey with us.</p>
    <br>
    <p>At yourapp.com, we're committed to providing you with a seamless and enriching experience. Here are a few things you can expect:</p>
    <br>
    <p>To get started, log in to your account using the credentials you provided during registration. If you have any questions or need assistance, our support team is ready to help at <a href="mailto:admin@yourapp.com">admin@yourapp.com</a>.</p>
    <br>
    <p>We're thrilled to have you on board and look forward to being part of your journey on yourapp.com!</p>
    <br>
    <p>Warm Regards,</p>
    <p>The yourapp.com Team</p>`;

  await sendEmail(value.email, "Welcome to yourapp.com!", htmlBody);

  const customer = await stripe.customers.create({
    email: value.email,
  });
  newUser.stripeCustomerId = customer.id;
  await newUser.save();
  res.json({ error: true, data: { newUser, token } });
});

exports.login = catchAsync(async (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required(),
    password: Joi.string().required(),
  });
  const result = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) return next(new AppError(result.error.message, 400));

  const user = await User.findOne({ email: result.value.email }).lean();

  if (!user)
    return res.status(404).json({
      error: true,
      message: "Invalid Email , User Not found!",
    });
  const passwordMatched = await bcrypt.compare(
    result.value.password,
    user.password
  );

  if (passwordMatched == false) {
    return res.status(400).json({
      error: true,
      message: "Invalid Password",
    });
  }

  const token = jwt.sign(
    // payload data
    {
      email: user.email,
      id: user._id,
    },
    process.env.TOKEN_SECRET
  );

  res.json({
    error: false,
    data: {
      user,
      token,
    },
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required(),
  });
  const result = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) return next(new AppError(result.error.message, 400));

  const user = await User.findOne({ email: result.value.email });

  if (!user) {
    return res.status(404).json({
      error: true,
      message: "User Not found",
    });
  }

  const resetPassOtp = Math.floor(Math.random() * 90000) + 10000;

  // SEND RESET PASSWORD EMAIL TO THE USER
  const htmlBody = ` <p>Dear ${user.name},</p>
    <br>
    <p>We noticed that you're trying to access your yourapp.com account but might have forgotten your password. No worries! We're here to help you regain access to your account quickly and securely.</p>
    <br>
    <p>Please use this OTP <b>${resetPassOtp}</b> to reset your password.</p>
    <br>
    <p>If you didn't request this password reset or believe this is an error, please ignore this email. Your account remains secure, and no changes have been made.</p>
    <br>
    <p>For any further assistance or if you have any concerns, feel free to reach out to our support team at <a href="mailto:admin@yourapp.com">admin@yourapp.com</a>. We're here to help you 24/7.</p>
    <br>
    <p>Thank you for being a part of yourapp.com! We're committed to ensuring your experience is smooth and enjoyable.</p>
    <br>
    <p>Best Regards,</p>
    <p>The yourapp.com Team.</p>`;

  await sendEmail(user.email, "Reset Your yourapp.com Password", htmlBody);

  await user.updateOne({ resetPassOtp: resetPassOtp });
  res.json({
    status: "success",
    message: "Forgot password OTP has been sent on your mail.",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required(),
    otp: Joi.number().required(),
    newPassword: Joi.string().required(),
  });
  const result = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) return next(new AppError(result.error.message, 400));

  const user = await User.findOne({ email: result.value.email });
  if (!user)
    return res.status(404).json({
      error: true,
      message: "User Not found",
    });
  else if (
    user &&
    (!user.resetPassOtp || user.resetPassOtp !== result.value.otp)
  )
    return res.status(400).json({
      error: true,
      message: "OTP is Invalid",
    });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(result.value.newPassword, salt);
  await user.updateOne({ password: hashedPassword, resetPassOtp: null });

  const htmlBody = ` <p>Dear ${user.name},</p>
    <br>
    <p>We wanted to inform you that your password for yourapp.com has been successfully reset. You can now access your account using your new credentials.</p>
    <br>
    <p>Thank you for trusting yourapp.com. Should you have any questions or need further assistance, feel free to contact our support team at <a href="mailto:admin@yourapp.com">admin@yourapp.com</a>. We're always here to help.</p>
    <br>
    <p>We appreciate your continued support and look forward to providing you with an exceptional experience on yourapp.com.</p>
    <br>
    <p>Best Regards,</p>
    <p>The yourapp.com Team.</p>`;

  await sendEmail(
    user.email,
    "Your yourapp.com Password Has Been Successfully Reset",
    htmlBody
  );

  res.json({
    status: "success",
    message: "Password updated successfully.",
  });
});

exports.userInfo = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: true,
      message: "User Not found",
    });
  }
  res.status(200).json({
    user,
  });
});

exports.updateUserInfo = catchAsync(async (req, res, next) => {
  let user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      error: true,
      message: "User Not found",
    });
  }

  const schema = Joi.object({
    name: Joi.string(),
    email: Joi.string()
      .regex(/^[._@a-z0-9]+$/)
      .label("email")
      .messages({
        "string.pattern.base":
          "Email should only contain alphanumeric and these characters i.e. _ .",
      }),
    password: Joi.string().min(8),
    fullname: Joi.string(),
    phone: Joi.string(),
    country: Joi.string(),
  });
  const { value, error } = schema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) return next(new AppError(error.message, 400));

  if (
    req.body.password !== null &&
    req.body.password !== undefined &&
    req.body.password !== ""
  ) {
    if (!checkPassword(value.password))
      return res.status(400).json({
        error: true,
        message:
          "Password should be 8 characters long and should contain upper case, number and special character",
      });
    const salt = await bcrypt.genSalt(10);
    const hashpassword = await bcrypt.hash(value.password, salt);
    user.password = hashpassword;
  }

  // update name
  if (req.body.name) {
    user.username = value.name;
  }

  //update full name
  if (req.body.fullname) {
    user.fullname = value.fullname;
  }
  if (req.body.email) {
    if (!checkEmail(value.email)) {
      return res.status(400).json({
        error: true,
        message: "Invalid Email Address",
      });
    }
    const checkemail = await User.findOne({ email: value.email });
    if (checkemail) {
      return res.status(400).json({
        error: true,
        message: "Email already Exists",
      });
    }
    user.email = value.email;
  }
  if (req.body.phone) {
    user.phone = value.phone;
  }
  if (req.body.country) {
    user.country = value.country;
  }

  await user.save();
  return res.status(200).json({
    error: false,
    user,
    message: "User info updated",
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const role = await User.findById(req.user.id);
  if (role.role == "admin") {
    const allUsers = await User.find();
    res.status(200).json({
      error: null,
      allUsers,
      message: "All users Account has been fetched",
    });
  } else {
    return res.status(400).json({
      error: true,
      message: "Only Admin Can Access This Route",
    });
  }
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const role = await User.findById(req.user.id);
  if (role.role == "admin") {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User Not Found!",
      });
    }
    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      error: false,
      message: "User Deleted",
    });
  } else {
    return res
      .status(400)
      .json({ error: true, message: "Only Admin Can Access This Route" });
  }
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const role = await User.findById(req.user.id);
  if (role.role == "admin") {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User Not Found!",
      });
    }
    const schema = Joi.object({
      name: Joi.string(),
      email: Joi.string()
        .regex(/^[._@a-z0-9]+$/)
        .label("email")
        .messages({
          "string.pattern.base":
            "Email should only contain alphanumeric and these characters i.e. _ .",
        }),
      password: Joi.string().min(8),
      fullname: Joi.string(),
      phone: Joi.string(),
      country: Joi.string(),
    });
    const { value, error } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
    });

    if (error)
      return res.status(400).json({
        error: true,
        message: error.message,
      });
    // next(new AppError(error.message, 400));

    if (
      req.body.password !== null &&
      req.body.password !== undefined &&
      req.body.password !== ""
    ) {
      if (!checkPassword(value.password))
        return res.status(400).json({
          error: true,
          message:
            "Password should be 8 characters long and should contain upper case, number and special character",
        });
      const salt = await bcrypt.genSalt(10);
      const hashpassword = await bcrypt.hash(value.password, salt);
      user.password = hashpassword;
    }

    // update name
    if (req.body.name) {
      user.username = value.name;
    }

    if (req.body.email) {
      if (!checkEmail(value.email)) {
        return res.status(400).json({
          error: true,
          message: "Invalid Email Address",
        });
      }
      const checkemail = await User.findOne({ email: value.email });
      if (checkemail) {
        return res.status(400).json({
          error: true,
          message: "Email ALready Exists",
        });
      }
      user.email = value.email;
    }

    //update full name
    if (req.body.fullname) {
      user.fullname = value.fullname;
    }

    if (req.body.phone) {
      user.phone = value.phone;
    }
    if (req.body.country) {
      user.country = value.country;
    }

    await user.save();
    return res.status(200).json({
      error: false,
      user,
      message: "User info updated",
    });
  } else {
    return res.status(400).json("Only Admin Can Access This Route");
  }
});
