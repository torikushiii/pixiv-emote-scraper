# pixiv-emote-scraper

This is a simple tool that fetch and download user custom emoji from [Pixiv Emoji Month](https://www.pixiv.net/special/pixiv-emoooji)

## Prerequisites

- [Node.js](https://nodejs.org/): ^16.0.0
- [Yarn](https://yarnpkg.com/) similar to Node.js
- [NPM](https://npmjs.org/) or any other Node.js package manager

## Installation

Install packages with your preferred package manager, e.g. npm:

```
yarn/npm install
```

## Usage
Please create folder named `emotes` before running the script.

To get your `refresh_token`, Please follow this [guide](https://gist.github.com/ZipFile/c9ebedb224406f4f11845ab700124362) to obtain your refresh token.

To get your cookie, go to Pixiv and use dev tools to obtain your cookie from request header.

After that your `config.js` should look like this:
```js
const config = {
    // Cookie should starts with first_visit_datetime_pc or PHPSESSID=
    "cookie": "YOUR_PIXIV_COOKIE",
    "access_token": "Cxnw92XXXXXXXXXXXXX",
    "refresh_token": "KylASXXXXXXXXXXXXX",
    "userAgent": "", // Use this if you encountered cloudflare (use the user agent from your browser where you are logged in)
    "expires_in": 0
};

module.exports = config;
```

To download all user emojis, use:
```
const api = new Pixiv(config);

await api.getAll();
```

To search for specific emote, use:
```
const api = new Pixiv(config);

const res = await api.getEmojisBySearch("gura");
```