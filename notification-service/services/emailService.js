const nodemailer = require("nodemailer");
const wait = require("../utils/wait");
const transporter = nodemailer.createTransport({
   host: "smtp.ethereal.email",
   port: 587,
   auth: {
      user: process.env.ETHEREAL_USER,
      pass: process.env.ETHEREAL_PASS,
   },
});

const sendEmail = async (to, subject, text) => {
   const mailOptions = {
      from: process.env.ETHEREAL_USER,
      to,
      subject,
      text,
   };
   try {
      const shouldError =
         process.env.NODE_ENV === "test" &&
         process.env.SIMULATE_EMAIL_ERROR === "true";
      if (shouldError && Math.random() < 0.05) {
         throw new Error("Simulated email sending error for testing");
      }
      const shouldSend = process.env.NODE_ENV !== "test";

      if (!shouldSend) {
         await wait(3000);
         return;
      }
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
   } catch (error) {
      console.error("Error sending email: ", error.message);
      throw error;
   }
};

module.exports = sendEmail;
