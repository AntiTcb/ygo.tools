import type { RequestHandler } from '@sveltejs/kit';
import * as sitemap from 'super-sitemap';

export const GET: RequestHandler = async ({ params }) => {
  return await sitemap.response({
    origin: 'https://ygo.tools',
    page: params.page,
  });
};
