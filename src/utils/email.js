const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: "smtp user",
    pass: "smtp user generated password",
  },
});

const sendEmail = async (to, subject, htmlBody, cc = null) => {
  return new Promise((resolve, reject) => {
    const option = {
      from: "noreply@yourapp.com",
      to,
      subject,
      html: htmlBody,
    };

    if (cc) {
      option.cc = cc;
    }

    transporter.sendMail(option, async (error, info) => {
      if (error) {
        console.log(error);
      }
      if (error) return reject("Email sending failed.");

      resolve("Email sent.");
    });
  });
};

module.exports = {
  sendEmail,
};
