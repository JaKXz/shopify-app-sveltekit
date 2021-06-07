import shopifyAuth from '@shopify/koa-shopify-auth';
import { ApiVersion, Shopify } from '@shopify/shopify-api';
import Cookies from 'cookies';
import dotenv from 'dotenv';
import type { DefaultContext } from 'koa';

// quirk of vite (shopifyAuth is not a function on prod build)
const createShopifyAuth = typeof shopifyAuth === 'function' ? shopifyAuth : (shopifyAuth as any).default;

dotenv.config();

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};

Shopify.Context.initialize({
	API_KEY        : process.env['SHOPIFY_API_KEY'],
	API_SECRET_KEY : process.env['SHOPIFY_API_SECRET'],
	SCOPES         : process.env['SCOPES'].split(','),
	HOST_NAME      : process.env['HOST'].replace(/https:\/\//, ''),
	API_VERSION    : ApiVersion.April21,
	IS_EMBEDDED_APP: true,
	// This should be replaced with your preferred storage strategy
	SESSION_STORAGE: new Shopify.Session.MemorySessionStorage()
});

const keys = [Shopify.Context.API_SECRET_KEY];
const auth = createShopifyAuth({
	async afterAuth (ctx) {
		// Access token and shop available in ctx.state.shopify
		const { shop, accessToken, scope } = ctx.state.shopify;
		const host = ctx.query.host;
		ACTIVE_SHOPIFY_SHOPS[shop] = { scope, host };
		const response = await Shopify.Webhooks.Registry.register({
			shop,
			accessToken,
			path          : '/webhooks',
			topic         : 'APP_UNINSTALLED',
			webhookHandler: async (topic, shop, body) => {
				delete ACTIVE_SHOPIFY_SHOPS[shop];
			}
		});

		if (!response.success) {
			console.log(`Failed to register APP_UNINSTALLED webhook: ${ response.result }`);
		}
		// Redirect to app with shop parameter upon auth
		ctx.redirect(`/?shop=${ shop }&host=${ host }`);
	}
});

function convert (request) {
	let ctx: DefaultContext = {};
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
			setHeader: (header, value) => {
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
			}
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
	ctx.cookies = new Cookies(ctx as any, ctx.res, { keys, secure: true });

	return ctx;
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle ({ request }) {
	const shop = request.query.get('shop');

	const activeShop = ACTIVE_SHOPIFY_SHOPS[shop];

	if (request.path === '/') {

		const host = request.query.get('host');

		if (!shop && !host) {
			return {
				status : 302,
				headers: {
					location: `${ process.env['HOST'] }/?shop=${ process.env['SHOP'] }`
				}
			};
		}

		if (activeShop && !host) {
			return {
				status : 302,
				headers: {
					location: `/?shop=${ shop }&host=${ activeShop.host }`
				}
			};
		}

		if (!activeShop) {
			return {
				status : 302,
				headers: {
					location: `/auth?shop=${ shop }`
				}
			};
		}
	}

	if (activeShop === undefined) {

		const ctx = convert(request);

		try {
			await auth(ctx, () => {
				return true;
			});
		} catch (e) {
			console.log(e.message);
		}

		return ctx;
	}


	// handle /auth because sveltekit doesn't know about it
	if (request.path === '/auth') {
		// if shop is already stored, redirect to root

		return {
			status : 302,
			headers: {
				location: `/?shop=${ shop }&host=${ activeShop.host }`
			}
		};
	}

}
