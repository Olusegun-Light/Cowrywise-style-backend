import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import Handlebars from "handlebars";
import { env } from "../Config/env";

const transport = nodemailer.createTransport({
  host: env.MAILTRAP_HOST,
  port: env.MAILTRAP_PORT,
  auth: {
    user: env.MAILTRAP_USER,
    pass: env.MAILTRAP_PASS,
  },
});

const prepareTemplate = (templateName: string) => {
  const templatePath = path.join(
    __dirname,
    "../../emailTemplates",
    `${templateName}.handlebars`,
  );
  const source = fs.readFileSync(templatePath, "utf8");
  return Handlebars.compile(source);
};

const sendMail = async (to: string, subject: string, html: string) => {
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  });
};

export const sendSignupOtpEmail = async (params: {
  email: string;
  firstName: string;
  otp: string;
}) => {
  const template = prepareTemplate("otp");
  const html = template({
    firstName: params.firstName,
    otp: params.otp,
    currentYear: new Date().getFullYear(),
  });
  await sendMail(params.email, "Verify your Cowrywise account", html);
};

export const sendResetOtpEmail = async (params: {
  email: string;
  firstName: string;
  otp: string;
}) => {
  const template = prepareTemplate("otpReset");
  const html = template({
    firstName: params.firstName,
    otp: params.otp,
    currentYear: new Date().getFullYear(),
  });
  await sendMail(params.email, "Reset your Cowrywise password", html);
};
