import { Controller, Get } from '@nestjs/common';
import { axiosInstance } from './axiosInstance';
import * as https from 'https';

@Controller('tinkoff')
export class TinkoffController {
  @Get('portfolio')
  async portfolio() {
    const TOKEN = process.env.TOKEN_TINKOFF;
     const agent = new https.Agent({
      rejectUnauthorized: false, // ТОЛЬКО ДЛЯ РАЗРАБОТКИ!
    });

    const resp = await axiosInstance.post(
      '/GetPortfolio',
      {
        accountId: '2133864914',
        currency: 'RUB',
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
        httpsAgent: agent
      },
    ); 

    return resp.data;
  }
}
