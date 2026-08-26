export const paystack = {
  post: jest.fn(),
  get: jest.fn(),
};

export const callPaystack = jest.fn().mockResolvedValue({
  authorization_url: "https://mock-paystack.test/pay/mock",
  status: "success",
  recipient_code: "RCP_mock",
});
