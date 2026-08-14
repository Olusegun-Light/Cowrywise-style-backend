import otpGenerator from "otp-generator";
import { createHash } from "crypto";
import { redisClient } from "../Config/redis";

const OTP_TTL_SECONDS = 10 * 60;

const hashOtp = (otp: string) => createHash("sha256").update(otp).digest("hex");

const otpKey = (scope: string, identifier: string) =>
  `otp:${scope}:${identifier.trim().toLowerCase()}`;

export const generateAndStoreOtp = async (
  scope: string,
  identifier: string,
) => {
  const otp = otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  await redisClient.setEx(
    otpKey(scope, identifier),
    OTP_TTL_SECONDS,
    hashOtp(otp),
  );

  return otp;
};

export const verifyStoredOtp = async (
  scope: string,
  identifier: string,
  otp: string,
) => {
  const key = otpKey(scope, identifier);
  const storedHash = await redisClient.get(key);
  if (!storedHash || storedHash !== hashOtp(otp)) {
    return false;
  }

  await redisClient.del(key);
  return true;
};
