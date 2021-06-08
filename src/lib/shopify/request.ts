import { Shopify } from '@shopify/shopify-api';
import Cookies from 'cookies';
import type { DefaultContext } from 'koa';

export function convert (request) {
	let ctx: DefaultContext = {};
	let setHeader = (header, value) => {
		header = header.toLowerCase();
		const cookies: string[] = ctx.headers[header] || [];
		if (header === 'set-cookie') {
			// remove duplicates
			(value as string[]).forEach(cookie => {
				const cookie_name = cookie.split('=')?.[0];
				for (let i = cookies.length - 1; i >= 0; i--) {
					if (cookies[i].indexOf(cookie_name + '=') === 0) {
						cookies.splice(i, 1);
					}
				}
			});
			value = [...cookies, ...value];
			ctx.headers.cookie = value.join(';');
		}
		ctx.headers[header] = value;
		ctx.response.headers = ctx.headers;
	};
	ctx = {
		host      : request.host,
		path      : request.path,
		query     : Object.fromEntries(request.query),
		req       : {
			...request
		},
		res       : {
			getHeader: (header) => {
				return ctx.headers[header];
			},
			setHeader
		},
		response  : {
			status : null,
			set    : setHeader,
			headers: request.headers
		},
		header    : request.headers,
		headers   : request.headers,
		connection: {
			encrypted: true
		},
		state     : {},
		redirect  : (url) => {
			ctx.status = 302;
			ctx.headers['location'] = url;
		},
		status    : 200,
		throw     : function(code) {
			ctx.status = code;
		}
	};

	if (request.headers.cookie) {
		ctx.headers['set-cookie'] = request.headers.cookie.split(';').map((s) => s.trim());
	}
	ctx.cookies = new Cookies(
		ctx as any,
		ctx.res,
		{
			keys  : [Shopify.Context.API_SECRET_KEY],
			secure: true
		}
	);

	return ctx;
}
