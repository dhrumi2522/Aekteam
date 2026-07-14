const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'aekads.otp@gmail.com',
          pass: "yjya gyzx jnrt vtfu",
    },
});

module.exports = transporter;
