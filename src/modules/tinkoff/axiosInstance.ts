import axios from "axios";

const TOKEN = process.env.TOKEN_TINKOFF;

export const axiosInstance = axios.create({
  baseURL: 'https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.OperationsService',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
  }
});