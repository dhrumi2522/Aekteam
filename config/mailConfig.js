const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aekads.otp@gmail.com',
    pass: 'lwvk otro rxad irbi',
  },
});

module.exports = transporter;
