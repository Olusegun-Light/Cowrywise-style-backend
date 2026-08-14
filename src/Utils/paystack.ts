import axios from "axios";
import { env } from "../Config/env";
import { AppError } from "./AppError";

export const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

export const callPaystack = async <T>(
  request: () => Promise<{ data: { data: T } }>,
): Promise<T> => {
  try {
    const response = await request();
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new AppError(
        err.response?.data?.message ?? "Payment provider request failed",
        502,
      );
    }
    throw err;
  }
};
