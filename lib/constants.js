export const SF_CENTER = [37.7749, -122.4194];

// Cloudflare Turnstile sitekey for the sign-in/sign-up CAPTCHA. This is
// Cloudflare's official public test key (always passes, visible widget) --
// swap it for your own after creating a Turnstile site at
// https://dash.cloudflare.com/?to=/:account/turnstile, and enable CAPTCHA
// protection with the matching secret key in the Supabase dashboard under
// Authentication > Bot and Abuse Protection. Until both are done, this
// placeholder key means the widget renders but doesn't actually block
// anything server-side.
export const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
